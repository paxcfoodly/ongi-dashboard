# Phase 3: 관리 기능 (Admin CRUD + Alarm Engine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6개 admin 페이지(LOT 관리 / 클레임 / 장비 / 알람 규칙 / 목표값 / 사용자)가 실제 CRUD로 동작하고, 알람 엔진이 메트릭 수신 시 임계값을 자동 평가해 `alarms` 테이블에 기록하며, 프론트에서 Realtime 구독으로 새 알람을 토스트로 알린다. 사용자 초대는 GoTrue Admin API를 호출하는 Edge Function으로 처리한다.

**Architecture:** DB 트리거(`fn_evaluate_alarms`)가 메트릭 INSERT 후 활성 규칙을 순회하며 뷰 현재값과 비교해 `alarms`에 INSERT. 프론트는 `alarms` 테이블 Realtime 채널을 구독해 새 row가 들어오면 toast. Admin 페이지는 RLS(`admin write`) + react-query mutation으로 CRUD. 사용자 초대는 `POST /functions/v1/invite-user`가 service role로 GoTrue Admin API 호출.

**Tech Stack (추가):** `sonner` (toast 라이브러리), 기존 Supabase Realtime + react-query.

**Phase 3 완료 조건:**
- 6개 admin 페이지 모두 실제 CRUD 동작
- 임계값 초과 메트릭 주입 시 알람 자동 생성 + 프론트에서 토스트로 표시
- admin이 사용자 초대 시 GoTrue에 계정 생성되고 이메일로 설정 링크 발송(로컬은 Mailpit에서 확인)
- `pnpm test`, `supabase test db`, `pnpm test:integration` 모두 녹색
- `phase-3-complete` 태그

**스펙 문서:** `docs/superpowers/specs/2026-04-23-ongi-dashboard-design.md`  
**이전 Phase:** `docs/superpowers/plans/2026-04-23-phase-2-dashboards.md` (태그 `phase-2-complete`)

**교훈 (Phase 2에서 확인):** `auth.users`에 직접 INSERT 하면 GoTrue가 NULL 컬럼 때문에 로그인 실패한다. 반드시 **GoTrue Admin API(`POST /auth/v1/admin/users`)** 또는 **supabase.auth.signUp()** 를 사용할 것. 본 Phase의 `invite-user` Edge Function도 Admin API 경유.

---

## 파일 구조 (Phase 3 종료 시점 추가분)

```
supabase/
├── migrations/
│   ├── 20260424000001_alarm_trigger.sql
│   └── 20260424000002_updated_at_trigger.sql
├── functions/
│   └── invite-user/
│       ├── index.ts
│       └── schemas.ts
└── tests/
    ├── 11_alarm_trigger.sql
    └── 12_updated_at_trigger.sql

src/
├── lib/
│   └── toast.ts                          sonner 래퍼 (success/error 헬퍼)
├── hooks/
│   ├── useAlarms.ts                      (수정 — Realtime 구독 추가)
│   ├── useAdminLots.ts                   CRUD 뮤테이션
│   ├── useAdminClaims.ts
│   ├── useAdminDevices.ts
│   ├── useAdminAlarmRules.ts
│   ├── useAdminTargets.ts
│   └── useAdminUsers.ts
├── components/
│   ├── common/
│   │   ├── Modal.tsx
│   │   ├── FormField.tsx
│   │   ├── Button.tsx
│   │   ├── Select.tsx
│   │   └── ConfirmDialog.tsx
│   └── alarm/
│       └── AlarmToast.tsx                Realtime → toast dispatcher
└── pages/
    └── admin/
        ├── LotManagePage.tsx             (실구현)
        ├── ClaimPage.tsx                 (실구현)
        ├── DevicePage.tsx                (실구현)
        ├── AlarmRulePage.tsx             (실구현)
        ├── TargetPage.tsx                (실구현)
        └── UserPage.tsx                  (실구현)

tests/
└── invite-user.test.ts                   통합 테스트
```

---

## 전제 조건

```bash
git branch --show-current     # phase-3-admin
git log --oneline | head -3   # phase-2-complete 태그 존재
supabase status               # 기동 중
pnpm lint && pnpm typecheck && pnpm test            # 기존 그린
supabase test db                                     # 48 tests green
pnpm test:integration                                # 7 tests green
```

---

## Task 1: 알람 평가 트리거 + pgTAP

**Files:**
- Create: `supabase/migrations/20260424000001_alarm_trigger.sql`
- Create: `supabase/tests/11_alarm_trigger.sql`

- [ ] **Step 1.1: 마이그레이션**

Create `supabase/migrations/20260424000001_alarm_trigger.sql`:
```sql
-- 알람 평가 트리거: 메트릭 INSERT 시 활성 규칙을 순회하며 뷰 현재값과 비교
create or replace function fn_evaluate_alarms() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r alarm_rules%rowtype;
  v numeric;
  msg text;
begin
  for r in select * from alarm_rules where enabled loop
    -- metric 이름에 따라 현재 값 조회
    case r.metric
      when 'defect_rate'  then select defect_rate_pct   into v from v_daily_kpi;
      when 'cost_ratio'   then select cost_ratio_pct    into v from v_cost_ratio;
      when 'recheck_rate' then select recheck_rate_pct  into v from v_ai_metrics;
      else continue;
    end case;

    -- 조건 평가
    if (r.operator = '>'  and v >  r.threshold) or
       (r.operator = '>=' and v >= r.threshold) or
       (r.operator = '<'  and v <  r.threshold) or
       (r.operator = '<=' and v <= r.threshold) or
       (r.operator = '='  and v =  r.threshold) then
      msg := replace(
               replace(r.message_template, '{{value}}', round(v, 2)::text),
               '{{threshold}}', r.threshold::text
             );
      -- 30분 내 동일 규칙 중복 방지
      if not exists (
        select 1 from alarms
        where rule_id = r.id and created_at > now() - interval '30 minutes'
      ) then
        insert into alarms (rule_id, severity, source, message, metadata)
        values (
          r.id, r.severity, 'auto', msg,
          jsonb_build_object('metric', r.metric, 'value', v, 'threshold', r.threshold)
        );
      end if;
    end if;
  end loop;
  return new;
exception
  -- 트리거 실패가 메트릭 삽입 자체를 막지 않도록 예외 흡수
  when others then
    insert into alarms (severity, source, message, metadata)
    values ('info', 'system',
            'alarm evaluator failed: ' || SQLERRM,
            jsonb_build_object('sqlstate', SQLSTATE));
    return new;
end; $$;

create trigger trg_vision_alarms
  after insert on vision_inspector_metrics
  for each row execute function fn_evaluate_alarms();

create trigger trg_equipment_alarms
  after insert on equipment_metrics
  for each row execute function fn_evaluate_alarms();

comment on function fn_evaluate_alarms() is
  '메트릭 INSERT 시 활성 알람 규칙을 평가하고 alarms 테이블에 기록';
```

- [ ] **Step 1.2: pgTAP 테스트**

Create `supabase/tests/11_alarm_trigger.sql`:
```sql
begin;
select plan(4);

select has_function('fn_evaluate_alarms');

-- 임계값 초과 시나리오: defect_rate > 1.0 규칙이 seed되어 있음
-- 비전검사기에 고불량 데이터 삽입 → alarms 생성되어야 함
insert into devices (code, name, type, role, process_order, api_key_hash)
values ('alarm_test_vision', 'alarm test vim', 'vision_inspector', null, 99, 'h')
returning id \gset vim_

insert into vision_inspector_metrics
  (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
values (:'vim_id',
        (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + interval '10 hours',
        100, 70, 25, 5, 60);  -- 불량률 25% → 1% 초과

select ok(
  (select count(*) from alarms where source = 'auto' and metadata->>'metric' = 'defect_rate') >= 1,
  'auto alarm created for defect_rate over threshold'
);

-- 중복 방지: 같은 규칙이 30분 내 재삽입되지 않음
insert into vision_inspector_metrics
  (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
values (:'vim_id',
        (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + interval '11 hours',
        100, 50, 45, 5, 60);

select is(
  (select count(*)::int from alarms where source = 'auto' and metadata->>'metric' = 'defect_rate'),
  1,
  'duplicate alarm suppressed within 30 minutes'
);

-- 정상 범위 삽입 시 새 알람 없음
insert into devices (code, name, type, role, process_order, api_key_hash)
values ('alarm_test_ok', 'alarm test ok', 'equipment', null, 98, 'h')
returning id \gset eq_

-- 기존 alarm row 개수 스냅샷 후 정상 데이터 삽입
select count(*)::int as before_count from alarms where source = 'auto' \gset
insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
values (:'eq_id',
        (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + interval '12 hours',
        60, 2000);

select is(
  (select count(*)::int from alarms where source = 'auto'),
  :before_count,
  'no new auto alarm when within threshold'
);

select * from finish();
rollback;
```

- [ ] **Step 1.3: 적용 및 테스트**
```bash
supabase db reset
supabase test db
```
Expected: 48 prior + 4 new = **52 tests pass**.

- [ ] **Step 1.4: 커밋**
```bash
git add -A
git commit -m "feat(db): add alarm evaluation trigger on metric inserts"
```

---

## Task 2: updated_at 자동 갱신 트리거

모든 `updated_at` 컬럼이 UPDATE 시 자동 갱신되도록 공통 트리거 추가.

**Files:**
- Create: `supabase/migrations/20260424000002_updated_at_trigger.sql`
- Create: `supabase/tests/12_updated_at_trigger.sql`

- [ ] **Step 2.1: 마이그레이션**

Create `supabase/migrations/20260424000002_updated_at_trigger.sql`:
```sql
create or replace function fn_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

-- updated_at 컬럼이 있는 모든 테이블에 트리거 부착
create trigger trg_devices_updated_at
  before update on devices
  for each row execute function fn_set_updated_at();
create trigger trg_lots_updated_at
  before update on lots
  for each row execute function fn_set_updated_at();
create trigger trg_claims_updated_at
  before update on claims
  for each row execute function fn_set_updated_at();
create trigger trg_targets_updated_at
  before update on targets
  for each row execute function fn_set_updated_at();
create trigger trg_alarm_rules_updated_at
  before update on alarm_rules
  for each row execute function fn_set_updated_at();
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function fn_set_updated_at();
```

- [ ] **Step 2.2: 테스트**

Create `supabase/tests/12_updated_at_trigger.sql`:
```sql
begin;
select plan(2);

select has_function('fn_set_updated_at');

-- 장비 UPDATE → updated_at이 created_at 이후로 갱신되어야 함
insert into devices (code, name, type, process_order, api_key_hash)
values ('updated_test', 'updated test', 'equipment', 99, 'h')
returning id \gset dev_

-- 1초 대기 대신 created_at을 과거로 수동 세팅
update devices set created_at = now() - interval '1 minute',
                   updated_at = now() - interval '1 minute'
 where id = :'dev_id';

update devices set name = 'updated' where id = :'dev_id';

select ok(
  (select updated_at > created_at from devices where id = :'dev_id'),
  'updated_at advances on UPDATE'
);

select * from finish();
rollback;
```

- [ ] **Step 2.3: 검증 + 커밋**
```bash
supabase db reset
supabase test db                      # 54 tests total
git add -A
git commit -m "feat(db): add updated_at auto-advance trigger on 6 tables"
```

---

## Task 3: invite-user Edge Function + 통합 테스트

**Files:**
- Create: `supabase/functions/invite-user/index.ts`, `schemas.ts`
- Create: `tests/invite-user.test.ts`

- [ ] **Step 3.1: 초기화**
```bash
supabase functions new invite-user
```

- [ ] **Step 3.2: schemas**

Create `supabase/functions/invite-user/schemas.ts`:
```ts
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export const InviteUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(100),
  role: z.enum(['admin', 'viewer']).default('viewer'),
  password: z.string().min(8).max(128).optional(),
});

export type InviteUser = z.infer<typeof InviteUserSchema>;
```

- [ ] **Step 3.3: index.ts**

Replace `supabase/functions/invite-user/index.ts`:
```ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZodError } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { InviteUserSchema } from './schemas.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerJwt = authHeader.replace(/^Bearer\s+/, '');
  if (!callerJwt) return json({ error: 'missing_auth' }, 401);

  // 호출자 admin 권한 확인 (is_admin() RPC)
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin');
  if (adminErr || !isAdmin) {
    return json({ error: 'forbidden' }, 403);
  }

  // 바디 파싱 + 검증
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  let parsed;
  try {
    parsed = InviteUserSchema.parse(payload);
  } catch (e) {
    if (e instanceof ZodError) {
      return json({ error: 'schema_invalid', details: e.flatten() }, 400);
    }
    return json({ error: 'internal' }, 500);
  }

  // GoTrue Admin API로 사용자 생성
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.full_name },
  });

  if (createErr || !created.user) {
    const code = createErr?.status === 422 ? 409 : 500;
    return json({
      error: createErr?.code ?? 'create_failed',
      message: createErr?.message ?? 'unknown error',
    }, code);
  }

  // 프로필 role 설정 (handle_new_user 트리거가 'viewer'로 생성 → 필요 시 admin 승격)
  if (parsed.role === 'admin') {
    const { error: roleErr } = await admin
      .from('profiles')
      .update({ role: 'admin', full_name: parsed.full_name })
      .eq('id', created.user.id);
    if (roleErr) {
      return json({ error: 'profile_update_failed', message: roleErr.message }, 500);
    }
  }

  return json({
    ok: true,
    user_id: created.user.id,
    email: created.user.email,
    role: parsed.role,
  });
});
```

- [ ] **Step 3.4: config.toml 업데이트**

Ensure `supabase/config.toml` has (the `supabase functions new` command usually adds this automatically):
```toml
[functions.invite-user]
enabled = true
verify_jwt = false
import_map = "./functions/invite-user/deno.json"
entrypoint = "./functions/invite-user/index.ts"
```

Confirm with `grep -A4 'functions.invite-user' supabase/config.toml`.

- [ ] **Step 3.5: 통합 테스트**

Create `tests/invite-user.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const INVITE_URL = 'http://127.0.0.1:54321/functions/v1/invite-user';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE);

async function createTestAdmin(): Promise<string> {
  const email = `admin-test-${Date.now()}@example.com`;
  const { data } = await admin.auth.admin.createUser({
    email, password: 'pw-adm1n-test', email_confirm: true,
  });
  await admin.from('profiles').update({ role: 'admin' }).eq('id', data.user!.id);
  return email;
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`signin failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

describe('invite-user edge function', () => {
  let adminJwt: string;
  const inviteeEmails: string[] = [];

  beforeAll(async () => {
    const adminEmail = await createTestAdmin();
    adminJwt = await signIn(adminEmail, 'pw-adm1n-test');
  });

  afterAll(async () => {
    // 테스트 사용자 정리
    for (const email of inviteeEmails) {
      const { data } = await admin.auth.admin.listUsers();
      const u = data.users.find((x) => x.email === email);
      if (u) await admin.auth.admin.deleteUser(u.id);
    }
  });

  it('rejects missing auth with 401', async () => {
    const res = await fetch(INVITE_URL, { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
  });

  it('rejects viewer with 403', async () => {
    // 신규 viewer 계정 생성 후 로그인
    const viewerEmail = `viewer-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email: viewerEmail, password: 'pw-view3r-test', email_confirm: true,
    });
    const viewerJwt = await signIn(viewerEmail, 'pw-view3r-test');

    const res = await fetch(INVITE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${viewerJwt}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'x@y.com', full_name: '테스트', role: 'viewer' }),
    });
    expect(res.status).toBe(403);
    await admin.auth.admin.deleteUser(data.user!.id);
  });

  it('invites a viewer successfully', async () => {
    const email = `invitee-${Date.now()}@example.com`;
    inviteeEmails.push(email);
    const res = await fetch(INVITE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email, full_name: '홍길동', role: 'viewer', password: 'tempPass123',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.email).toBe(email);
    expect(body.role).toBe('viewer');
  });

  it('invites an admin and promotes role', async () => {
    const email = `admin-invitee-${Date.now()}@example.com`;
    inviteeEmails.push(email);
    const res = await fetch(INVITE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email, full_name: '관리자2', role: 'admin', password: 'tempPass123',
      }),
    });
    expect(res.status).toBe(200);

    // DB에서 role=admin 확인
    const { data } = await admin.auth.admin.listUsers();
    const user = data.users.find((u) => u.email === email);
    expect(user).toBeDefined();
    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', user!.id).maybeSingle();
    expect(profile?.role).toBe('admin');
  });

  it('rejects invalid email with 400', async () => {
    const res = await fetch(INVITE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'not-an-email', full_name: 'X' }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3.6: 실행 및 확인**

Edge Function serve + 통합 테스트:
```bash
supabase functions serve invite-user --env-file ./supabase/.env.local &
sleep 3
export SUPABASE_ANON_KEY=$(supabase status -o env | grep "^ANON_KEY=" | cut -d'"' -f2)
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep "^SERVICE_ROLE_KEY=" | cut -d'"' -f2)
pnpm test:integration
```

Expected: 기존 7(ingest) + 5(invite-user) = **12 integration tests pass**.

- [ ] **Step 3.7: 커밋**
```bash
git add -A
git commit -m "feat(edge): add invite-user function with GoTrue admin API and RBAC check"
```

---

## Task 4: Toast 시스템 + 공통 Form 컴포넌트

**Files:**
- Create: `src/lib/toast.ts`, `src/components/common/Modal.tsx`, `FormField.tsx`, `Button.tsx`, `Select.tsx`, `ConfirmDialog.tsx`

- [ ] **Step 4.1: 설치**
```bash
pnpm add sonner
```

- [ ] **Step 4.2: toast 래퍼**

Create `src/lib/toast.ts`:
```ts
import { toast as sonner } from 'sonner';

export const toast = {
  success: (message: string) =>
    sonner.success(message, { duration: 3000 }),
  error: (message: string) =>
    sonner.error(message, { duration: 5000 }),
  info: (message: string) =>
    sonner.message(message, { duration: 3000 }),
  warn: (message: string) =>
    sonner.warning(message, { duration: 4000 }),
};
```

- [ ] **Step 4.3: Toaster 마운트**

Modify `src/main.tsx` — add Toaster inside the provider tree:

Before the `<App />`, import and mount:
```tsx
import { Toaster } from 'sonner';
```

Then in the `createRoot(...).render(...)`:
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 4.4: Button**

Create `src/components/common/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary:   'bg-primary text-white hover:bg-primary-dark disabled:opacity-50',
  secondary: 'bg-surface border border-border text-text hover:border-primary hover:text-primary disabled:opacity-50',
  danger:    'bg-danger text-white hover:bg-danger-dark disabled:opacity-50',
  ghost:     'text-text-dim hover:text-text',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4.5: FormField**

Create `src/components/common/FormField.tsx`:
```tsx
import type { InputHTMLAttributes, ReactNode } from 'react';

export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-text-dim block mb-1">{label}</span>
      {children}
      {hint && !error && <span className="text-[10px] text-text-muted block mt-1">{hint}</span>}
      {error && <span className="text-[10px] text-danger block mt-1">{error}</span>}
    </label>
  );
}

export function TextInput({
  error,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none ${
        error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary'
      } ${className}`}
      {...rest}
    />
  );
}

export function TextArea({
  error,
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none min-h-[60px] ${
        error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary'
      } ${className}`}
      {...rest}
    />
  );
}
```

- [ ] **Step 4.6: Select**

Create `src/components/common/Select.tsx`:
```tsx
import type { SelectHTMLAttributes } from 'react';

interface Option {
  value: string;
  label: string;
}

export function Select({
  options,
  error,
  className = '',
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; error?: boolean }) {
  return (
    <select
      className={`w-full border rounded px-2.5 py-1.5 text-xs bg-surface focus:outline-none ${
        error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary'
      } ${className}`}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4.7: Modal**

Create `src/components/common/Modal.tsx`:
```tsx
import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="text-text-dim hover:text-danger text-lg leading-none" aria-label="닫기">
            ×
          </button>
        </header>
        <div className="p-4 space-y-3">{children}</div>
        {footer && <footer className="px-4 py-3 border-t border-border flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4.8: ConfirmDialog**

Create `src/components/common/ConfirmDialog.tsx`:
```tsx
import { Modal } from './Modal';
import { Button } from './Button';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-xs text-text leading-relaxed">{message}</p>
    </Modal>
  );
}
```

- [ ] **Step 4.9: 검증 + 커밋**
```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(ui): add toast, Modal, FormField, Button, Select, ConfirmDialog"
```

---

## Task 5: 알람 Realtime 구독 + AlarmToast

**Files:**
- Modify: `src/hooks/useAlarms.ts` (Realtime 추가)
- Create: `src/components/alarm/AlarmToast.tsx`
- Modify: `src/components/layout/AppLayout.tsx` (AlarmToast 마운트)

- [ ] **Step 5.1: useAlarms 확장**

Read `src/hooks/useAlarms.ts` and append (do NOT remove existing `useAlarms` hook):
```ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useAlarmRealtime(onNew: (a: AlarmRow) => void) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel('alarms-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alarms' },
        (payload) => {
          const row = payload.new as AlarmRow;
          onNew(row);
          qc.invalidateQueries({ queryKey: ['alarms'] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onNew, qc]);
}
```

`import { useEffect } from 'react';` and `import { useQueryClient } from '@tanstack/react-query';` should be at the top of the file (add if not present).

- [ ] **Step 5.2: AlarmToast 컴포넌트**

Create `src/components/alarm/AlarmToast.tsx`:
```tsx
import { useCallback } from 'react';
import { useAlarmRealtime } from '../../hooks/useAlarms';
import { toast } from '../../lib/toast';
import type { AlarmRow } from '../../hooks/useAlarms';

export function AlarmToast() {
  const onNew = useCallback((a: AlarmRow) => {
    const title = a.source === 'manual' ? '알람 (수동)' : '알람';
    const body = a.message;
    if (a.severity === 'danger')       toast.error(`${title}: ${body}`);
    else if (a.severity === 'warning') toast.warn(`${title}: ${body}`);
    else                               toast.info(`${title}: ${body}`);
  }, []);

  useAlarmRealtime(onNew);
  return null;
}
```

- [ ] **Step 5.3: AppLayout 수정**

Read `src/components/layout/AppLayout.tsx`. Add import:
```tsx
import { AlarmToast } from '../alarm/AlarmToast';
```

Inside the `<div className="min-h-screen flex flex-col">` wrapper, add `<AlarmToast />` (it renders null but subscribes):
```tsx
<div className="min-h-screen flex flex-col">
  <AlarmToast />
  <Header />
  ...
</div>
```

- [ ] **Step 5.4: Realtime Publication 확인**

`alarms` 테이블이 `supabase_realtime` publication에 포함되어야 Realtime이 동작. Supabase 기본 publication은 모든 테이블을 포함하지만, 명시적 추가가 필요한 경우:

Create `supabase/migrations/20260424000003_alarms_realtime.sql`:
```sql
-- alarms 테이블의 Realtime 이벤트를 구독자에게 전달
alter publication supabase_realtime add table alarms;
```

If the publication already covers `alarms` (e.g., `supabase_realtime for all tables`), this `alter` will error. In that case, wrap with check:
```sql
do $$
begin
  alter publication supabase_realtime add table alarms;
exception
  when duplicate_object then null;
  when others then raise notice 'alarms realtime add skipped: %', SQLERRM;
end $$;
```

Use the safe version.

- [ ] **Step 5.5: 검증 + 커밋**
```bash
supabase db reset
pnpm lint && pnpm typecheck && pnpm build
```

Commit:
```bash
git add -A
git commit -m "feat(alarm): realtime subscription and toast notifications"
```

---

## Task 6: LotManagePage (CRUD)

**Files:**
- Create: `src/hooks/useAdminLots.ts`
- Modify: `src/pages/admin/LotManagePage.tsx`

- [ ] **Step 6.1: 뮤테이션 훅**

Create `src/hooks/useAdminLots.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface LotInput {
  lot_no: string;
  client_id: string;
  product_name?: string | null;
  target_quantity?: number | null;
  notes?: string | null;
}

export function useCreateLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LotInput) => {
      const { data, error } = await supabase
        .from('lots')
        .insert({ ...input, status: 'planned' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }),
  });
}

export function useUpdateLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<LotInput> & { status?: string } }) => {
      const { data, error } = await supabase
        .from('lots')
        .update(changes)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }),
  });
}

export function useStartLot() {
  const update = useUpdateLot();
  return (id: string) => update.mutateAsync({ id, changes: { status: 'running', started_at: new Date().toISOString() } });
}

export function useEndLot() {
  const update = useUpdateLot();
  return (id: string) => update.mutateAsync({ id, changes: { status: 'completed', ended_at: new Date().toISOString() } });
}

export function useDeleteLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lots').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }),
  });
}

export interface ClientRow {
  id: string;
  name: string;
}

export async function fetchClients(): Promise<ClientRow[]> {
  const { data, error } = await supabase.from('clients').select('id, name').order('name');
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 6.2: LotManagePage**

Replace `src/pages/admin/LotManagePage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLots } from '../../hooks/useLots';
import type { LotSummary } from '../../hooks/useLots';
import {
  useCreateLot, useUpdateLot, useDeleteLot,
  useStartLot, useEndLot, fetchClients,
} from '../../hooks/useAdminLots';
import type { ClientRow } from '../../hooks/useAdminLots';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { FormField, TextInput, TextArea } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { toast } from '../../lib/toast';
import { fmt } from '../../utils/formatting';

interface FormState {
  lot_no: string;
  client_id: string;
  product_name: string;
  target_quantity: string;
  notes: string;
}

const EMPTY: FormState = { lot_no: '', client_id: '', product_name: '', target_quantity: '', notes: '' };

export function LotManagePage() {
  const { data: rows = [], isLoading } = useLots();
  const { data: clients = [] } = useQuery<ClientRow[]>({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });

  const createMut = useCreateLot();
  const updateMut = useUpdateLot();
  const deleteMut = useDeleteLot();
  const startLot  = useStartLot();
  const endLot    = useEndLot();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<LotSummary | null>(null);

  useEffect(() => {
    if (!modalOpen) return;
    if (editId) {
      const row = rows.find((r) => r.id === editId);
      if (row) setForm({
        lot_no: row.lot_no,
        client_id: row.client_id,
        product_name: row.product_name ?? '',
        target_quantity: row.target_quantity?.toString() ?? '',
        notes: row.notes ?? '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [modalOpen, editId, rows]);

  async function onSubmit() {
    if (!form.lot_no || !form.client_id) {
      toast.error('LOT번호와 납품처는 필수입니다.');
      return;
    }
    const payload = {
      lot_no: form.lot_no,
      client_id: form.client_id,
      product_name: form.product_name || null,
      target_quantity: form.target_quantity ? Number(form.target_quantity) : null,
      notes: form.notes || null,
    };
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, changes: payload });
        toast.success('LOT 수정됨');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('LOT 생성됨');
      }
      setModalOpen(false);
      setEditId(null);
    } catch (e: unknown) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    }
  }

  async function onDelete(row: LotSummary) {
    try {
      await deleteMut.mutateAsync(row.id);
      toast.success(`${row.lot_no} 삭제됨`);
    } catch (e: unknown) {
      toast.error(`삭제 실패: ${(e as Error).message}`);
    }
    setConfirmDel(null);
  }

  const columns: Column<LotSummary>[] = [
    { key: 'lot_no',   header: 'LOT번호', render: (r) => <span className="font-mono">{r.lot_no}</span> },
    { key: 'client',   header: '납품처',  render: (r) => r.client_name },
    { key: 'product',  header: '제품',    render: (r) => r.product_name ?? '-' },
    { key: 'target',   header: '목표수량', align: 'right', render: (r) => r.target_quantity != null ? fmt.int(r.target_quantity) : '-' },
    { key: 'status',   header: '상태',    align: 'center', render: (r) =>
      r.status === 'running'   ? <Pill variant="info">진행중</Pill> :
      r.status === 'completed' ? <Pill variant="ok">완료</Pill> :
      r.status === 'paused'    ? <Pill variant="warn">일시중지</Pill> :
      <Pill variant="info">계획</Pill>
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {r.status === 'planned' && (
            <Button variant="primary" onClick={async () => { await startLot(r.id); toast.success('LOT 시작됨'); }}>
              시작
            </Button>
          )}
          {r.status === 'running' && (
            <Button variant="primary" onClick={async () => { await endLot(r.id); toast.success('LOT 종료됨'); }}>
              종료
            </Button>
          )}
          <Button variant="secondary" onClick={() => { setEditId(r.id); setModalOpen(true); }}>
            편집
          </Button>
          <Button variant="danger" onClick={() => setConfirmDel(r)}>
            삭제
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">LOT 관리</h1>
        <Button onClick={() => { setEditId(null); setModalOpen(true); }}>+ 신규 LOT</Button>
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditId(null); }}
        title={editId ? 'LOT 편집' : '신규 LOT'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditId(null); }}>취소</Button>
            <Button onClick={onSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editId ? '저장' : '생성'}
            </Button>
          </>
        }
      >
        <FormField label="LOT번호 *">
          <TextInput value={form.lot_no} onChange={(e) => setForm({ ...form, lot_no: e.target.value })}
            placeholder="LOT-20260424-001" />
        </FormField>
        <FormField label="납품처 *">
          <Select
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            options={[{ value: '', label: '-- 선택 --' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </FormField>
        <FormField label="제품명">
          <TextInput value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
        </FormField>
        <FormField label="목표 수량 (ea)">
          <TextInput
            type="number" min={1}
            value={form.target_quantity}
            onChange={(e) => setForm({ ...form, target_quantity: e.target.value })}
          />
        </FormField>
        <FormField label="비고">
          <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="LOT 삭제"
        message={confirmDel ? `${confirmDel.lot_no} 을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.` : ''}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={() => confirmDel && onDelete(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
```

- [ ] **Step 6.3: 검증 + 커밋**
```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(admin): implement LOT management CRUD with create/edit/start/end/delete"
```

---

## Task 7: ClaimPage (CRUD)

**Files:**
- Create: `src/hooks/useAdminClaims.ts`
- Modify: `src/pages/admin/ClaimPage.tsx`

- [ ] **Step 7.1: 뮤테이션 훅**

Create `src/hooks/useAdminClaims.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface ClaimRow {
  id: string;
  lot_id: string | null;
  client_id: string;
  client_name?: string;
  received_at: string;
  defect_type: string | null;
  quantity: number | null;
  description: string | null;
  status: 'open' | 'investigating' | 'resolved';
  created_at: string;
}

export interface ClaimInput {
  client_id: string;
  lot_id?: string | null;
  received_at: string;
  defect_type?: string | null;
  quantity?: number | null;
  description?: string | null;
}

export function useClaims() {
  return useQuery<ClaimRow[]>({
    queryKey: ['claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('*, clients(name)')
        .order('received_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c: Record<string, unknown>) => ({
        ...(c as ClaimRow),
        client_name: (c.clients as { name: string } | null)?.name,
      }));
    },
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClaimInput) => {
      const { data, error } = await supabase.from('claims').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });
}

export function useUpdateClaimStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ClaimRow['status'] }) => {
      const { error } = await supabase.from('claims').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });
}

export function useDeleteClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('claims').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });
}
```

- [ ] **Step 7.2: ClaimPage**

Replace `src/pages/admin/ClaimPage.tsx`:
```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useClaims, useCreateClaim, useUpdateClaimStatus, useDeleteClaim,
} from '../../hooks/useAdminClaims';
import type { ClaimRow } from '../../hooks/useAdminClaims';
import { fetchClients } from '../../hooks/useAdminLots';
import type { ClientRow } from '../../hooks/useAdminLots';
import { useLots } from '../../hooks/useLots';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField, TextInput, TextArea } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { toast } from '../../lib/toast';
import { fmt } from '../../utils/formatting';

interface FormState {
  client_id: string;
  lot_id: string;
  received_at: string;
  defect_type: string;
  quantity: string;
  description: string;
}

const EMPTY: FormState = {
  client_id: '', lot_id: '', received_at: new Date().toISOString().slice(0, 16),
  defect_type: '', quantity: '', description: '',
};

export function ClaimPage() {
  const { data: rows = [], isLoading } = useClaims();
  const { data: clients = [] } = useQuery<ClientRow[]>({ queryKey: ['clients'], queryFn: fetchClients });
  const { data: lots = [] } = useLots();

  const createMut = useCreateClaim();
  const updateStatusMut = useUpdateClaimStatus();
  const deleteMut = useDeleteClaim();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<ClaimRow | null>(null);

  async function onSubmit() {
    if (!form.client_id) { toast.error('납품처는 필수입니다.'); return; }
    try {
      await createMut.mutateAsync({
        client_id: form.client_id,
        lot_id: form.lot_id || null,
        received_at: new Date(form.received_at).toISOString(),
        defect_type: form.defect_type || null,
        quantity: form.quantity ? Number(form.quantity) : null,
        description: form.description || null,
      });
      toast.success('클레임 등록됨');
      setModalOpen(false);
      setForm(EMPTY);
    } catch (e: unknown) {
      toast.error(`등록 실패: ${(e as Error).message}`);
    }
  }

  async function onStatusChange(row: ClaimRow, status: ClaimRow['status']) {
    try {
      await updateStatusMut.mutateAsync({ id: row.id, status });
      toast.success('상태 변경됨');
    } catch (e: unknown) {
      toast.error(`변경 실패: ${(e as Error).message}`);
    }
  }

  const columns: Column<ClaimRow>[] = [
    { key: 'received_at', header: '접수일시', render: (r) => new Date(r.received_at).toLocaleString('ko-KR') },
    { key: 'client',      header: '납품처', render: (r) => r.client_name ?? '-' },
    { key: 'defect_type', header: '불량 유형', render: (r) => r.defect_type ?? '-' },
    { key: 'quantity',    header: '수량', align: 'right', render: (r) => r.quantity != null ? fmt.int(r.quantity) : '-' },
    { key: 'description', header: '설명', render: (r) => <span className="truncate max-w-[300px] inline-block">{r.description ?? '-'}</span> },
    { key: 'status', header: '상태', align: 'center', render: (r) =>
      r.status === 'resolved'      ? <Pill variant="ok">완료</Pill> :
      r.status === 'investigating' ? <Pill variant="warn">조사중</Pill> :
                                      <Pill variant="danger">미처리</Pill>
    },
    { key: 'actions', header: '작업', align: 'right', render: (r) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <Select
          value={r.status}
          onChange={(e) => onStatusChange(r, e.target.value as ClaimRow['status'])}
          options={[
            { value: 'open', label: '미처리' },
            { value: 'investigating', label: '조사중' },
            { value: 'resolved', label: '완료' },
          ]}
          className="!py-1 !text-[11px] w-[90px]"
        />
        <Button variant="danger" onClick={() => setConfirmDel(r)}>삭제</Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">클레임 관리</h1>
        <Button onClick={() => setModalOpen(true)}>+ 신규 클레임</Button>
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} empty="등록된 클레임이 없습니다." />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="신규 클레임"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button onClick={onSubmit} disabled={createMut.isPending}>등록</Button>
          </>
        }
      >
        <FormField label="납품처 *">
          <Select
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            options={[{ value: '', label: '-- 선택 --' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </FormField>
        <FormField label="관련 LOT (선택)">
          <Select
            value={form.lot_id}
            onChange={(e) => setForm({ ...form, lot_id: e.target.value })}
            options={[
              { value: '', label: '-- 없음 --' },
              ...lots.map((l) => ({ value: l.id, label: `${l.lot_no} / ${l.client_name}` })),
            ]}
          />
        </FormField>
        <FormField label="접수일시">
          <TextInput type="datetime-local" value={form.received_at}
            onChange={(e) => setForm({ ...form, received_at: e.target.value })} />
        </FormField>
        <FormField label="불량 유형">
          <TextInput value={form.defect_type} onChange={(e) => setForm({ ...form, defect_type: e.target.value })} />
        </FormField>
        <FormField label="수량">
          <TextInput type="number" min={0} value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </FormField>
        <FormField label="설명">
          <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="클레임 삭제"
        message="이 클레임을 삭제하시겠습니까?"
        confirmLabel="삭제"
        variant="danger"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await deleteMut.mutateAsync(confirmDel.id);
            toast.success('삭제됨');
          } catch (e: unknown) {
            toast.error(`삭제 실패: ${(e as Error).message}`);
          }
          setConfirmDel(null);
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
```

- [ ] **Step 7.3: 검증 + 커밋**
```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(admin): implement claim CRUD with status workflow"
```

---

## Task 8: DevicePage

**Files:**
- Create: `src/hooks/useAdminDevices.ts`
- Modify: `src/pages/admin/DevicePage.tsx`

- [ ] **Step 8.1: 훅**

Create `src/hooks/useAdminDevices.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface DeviceRow {
  id: string;
  code: string;
  name: string;
  type: 'vision_inspector' | 'equipment';
  role: string | null;
  process_order: number;
  active: boolean;
  last_seen_at: string | null;
  api_key_hash: string;
}

export interface DeviceInput {
  code: string;
  name: string;
  type: 'vision_inspector' | 'equipment';
  role: string | null;
  process_order: number;
}

export function useDevices() {
  return useQuery<DeviceRow[]>({
    queryKey: ['admin', 'devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('process_order');
      if (error) throw error;
      return (data ?? []) as DeviceRow[];
    },
  });
}

function generateApiKey(): string {
  // Phase 1 스펙: 평문 비교 → Phase 4에서 bcrypt 도입. 일단 예측 불가한 문자열 생성.
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeviceInput) => {
      const apiKey = generateApiKey();
      const { data, error } = await supabase
        .from('devices')
        .insert({ ...input, api_key_hash: apiKey, active: true })
        .select()
        .single();
      if (error) throw error;
      return { device: data, apiKey };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'devices'] }),
  });
}

export function useRegenerateDeviceKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const apiKey = generateApiKey();
      const { error } = await supabase
        .from('devices')
        .update({ api_key_hash: apiKey })
        .eq('id', id);
      if (error) throw error;
      return apiKey;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'devices'] }),
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<DeviceInput> & { active?: boolean } }) => {
      const { error } = await supabase.from('devices').update(changes).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'devices'] }),
  });
}
```

- [ ] **Step 8.2: DevicePage**

Replace `src/pages/admin/DevicePage.tsx`:
```tsx
import { useState } from 'react';
import {
  useDevices, useCreateDevice, useRegenerateDeviceKey, useUpdateDevice,
} from '../../hooks/useAdminDevices';
import type { DeviceRow } from '../../hooks/useAdminDevices';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField, TextInput } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { toast } from '../../lib/toast';

interface FormState {
  code: string;
  name: string;
  type: 'vision_inspector' | 'equipment';
  role: string;
  process_order: string;
}

const EMPTY: FormState = { code: '', name: '', type: 'equipment', role: '', process_order: '99' };

export function DevicePage() {
  const { data: rows = [], isLoading } = useDevices();
  const createMut = useCreateDevice();
  const regenMut  = useRegenerateDeviceKey();
  const updateMut = useUpdateDevice();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [newKey, setNewKey]       = useState<{ code: string; key: string } | null>(null);
  const [confirmRegen, setConfirmRegen] = useState<DeviceRow | null>(null);

  async function onSubmit() {
    if (!form.code || !form.name) { toast.error('code와 name은 필수입니다.'); return; }
    try {
      const { device, apiKey } = await createMut.mutateAsync({
        code: form.code,
        name: form.name,
        type: form.type,
        role: form.role || null,
        process_order: Number(form.process_order),
      });
      setNewKey({ code: device.code, key: apiKey });
      setModalOpen(false);
      setForm(EMPTY);
    } catch (e: unknown) {
      toast.error(`생성 실패: ${(e as Error).message}`);
    }
  }

  async function onRegenerate(row: DeviceRow) {
    try {
      const apiKey = await regenMut.mutateAsync(row.id);
      setNewKey({ code: row.code, key: apiKey });
    } catch (e: unknown) {
      toast.error(`재발급 실패: ${(e as Error).message}`);
    }
    setConfirmRegen(null);
  }

  const columns: Column<DeviceRow>[] = [
    { key: 'order', header: '순서', align: 'center', render: (r) => r.process_order },
    { key: 'code',  header: '코드', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: 'name',  header: '이름', render: (r) => r.name },
    { key: 'type',  header: '타입', render: (r) => r.type === 'vision_inspector' ? 'AI 비전' : '일반 장비' },
    { key: 'role',  header: 'Role', render: (r) => r.role ?? '-' },
    { key: 'active', header: '활성', align: 'center', render: (r) =>
      r.active ? <Pill variant="ok">활성</Pill> : <Pill variant="danger">비활성</Pill>
    },
    { key: 'last_seen', header: '마지막 수신', render: (r) =>
      r.last_seen_at ? new Date(r.last_seen_at).toLocaleString('ko-KR') : '-'
    },
    { key: 'actions', header: '작업', align: 'right', render: (r) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" onClick={() => updateMut.mutate({ id: r.id, changes: { active: !r.active } })}>
          {r.active ? '비활성화' : '활성화'}
        </Button>
        <Button variant="secondary" onClick={() => setConfirmRegen(r)}>키 재발급</Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">장비 관리</h1>
        <Button onClick={() => setModalOpen(true)}>+ 신규 장비</Button>
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="신규 장비"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button onClick={onSubmit} disabled={createMut.isPending}>생성</Button>
          </>
        }
      >
        <FormField label="장비 코드 *" hint="장비가 /ingest 호출 시 X-Device-Code 헤더로 보낼 식별자">
          <TextInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="packaging_02" />
        </FormField>
        <FormField label="장비 이름 *">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="타입 *">
          <Select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as FormState['type'] })}
            options={[
              { value: 'equipment', label: '일반 장비' },
              { value: 'vision_inspector', label: 'AI 비전검사기' },
            ]}
          />
        </FormField>
        <FormField label="Role" hint="primary_output = 일일 생산량 기준, inspection = AI 검사, 공란 = 보조">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: '', label: '(없음)' },
              { value: 'primary_output', label: 'primary_output' },
              { value: 'inspection', label: 'inspection' },
            ]}
          />
        </FormField>
        <FormField label="공정 순서 *">
          <TextInput type="number" min={1} value={form.process_order}
            onChange={(e) => setForm({ ...form, process_order: e.target.value })} />
        </FormField>
      </Modal>

      <Modal
        open={!!newKey}
        onClose={() => setNewKey(null)}
        title="API 키 발급 완료"
        footer={<Button onClick={() => setNewKey(null)}>확인</Button>}
      >
        <p className="text-xs text-text mb-2">
          장비 <strong>{newKey?.code}</strong>의 API 키입니다. <strong className="text-danger">이 화면을 닫으면 다시 볼 수 없습니다.</strong> 안전한 곳에 복사해두세요.
        </p>
        <code className="block bg-surface2 border border-border rounded p-2 text-[11px] font-mono break-all">
          {newKey?.key}
        </code>
      </Modal>

      <ConfirmDialog
        open={!!confirmRegen}
        title="API 키 재발급"
        message={confirmRegen
          ? `${confirmRegen.code}의 API 키를 재발급합니다. 기존 키는 즉시 무효화되며, 장비 쪽 설정을 바로 갱신해야 합니다. 계속하시겠습니까?`
          : ''}
        confirmLabel="재발급"
        variant="danger"
        onConfirm={() => confirmRegen && onRegenerate(confirmRegen)}
        onCancel={() => setConfirmRegen(null)}
      />
    </div>
  );
}
```

- [ ] **Step 8.3: 검증 + 커밋**
```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(admin): implement device management with API key (re)generation"
```

---

## Task 9: AlarmRulePage

**Files:**
- Create: `src/hooks/useAdminAlarmRules.ts`
- Modify: `src/pages/admin/AlarmRulePage.tsx`

- [ ] **Step 9.1: 훅**

Create `src/hooks/useAdminAlarmRules.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AlarmRule {
  id: string;
  name: string;
  metric: string;
  operator: '>' | '>=' | '<' | '<=' | '=';
  threshold: number;
  severity: 'info' | 'warning' | 'danger';
  message_template: string;
  enabled: boolean;
}

export interface AlarmRuleInput {
  name: string;
  metric: string;
  operator: AlarmRule['operator'];
  threshold: number;
  severity: AlarmRule['severity'];
  message_template: string;
}

export function useAlarmRules() {
  return useQuery<AlarmRule[]>({
    queryKey: ['admin', 'alarm_rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('alarm_rules').select('*').order('metric');
      if (error) throw error;
      return (data ?? []) as AlarmRule[];
    },
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AlarmRuleInput) => {
      const { error } = await supabase.from('alarm_rules').insert({ ...input, enabled: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'alarm_rules'] }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<AlarmRuleInput> & { enabled?: boolean } }) => {
      const { error } = await supabase.from('alarm_rules').update(changes).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'alarm_rules'] }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alarm_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'alarm_rules'] }),
  });
}
```

- [ ] **Step 9.2: AlarmRulePage**

Replace `src/pages/admin/AlarmRulePage.tsx`:
```tsx
import { useState } from 'react';
import {
  useAlarmRules, useCreateRule, useUpdateRule, useDeleteRule,
} from '../../hooks/useAdminAlarmRules';
import type { AlarmRule } from '../../hooks/useAdminAlarmRules';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField, TextInput, TextArea } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { toast } from '../../lib/toast';

interface FormState {
  name: string;
  metric: string;
  operator: AlarmRule['operator'];
  threshold: string;
  severity: AlarmRule['severity'];
  message_template: string;
}

const EMPTY: FormState = {
  name: '', metric: 'defect_rate', operator: '>', threshold: '1.0',
  severity: 'warning', message_template: '{{metric}} {{value}} — 목표 {{threshold}} 초과',
};

const METRIC_OPTS = [
  { value: 'defect_rate',  label: 'defect_rate (불량률 %)' },
  { value: 'cost_ratio',   label: 'cost_ratio (제조원가 %)' },
  { value: 'recheck_rate', label: 'recheck_rate (재검율 %)' },
];

export function AlarmRulePage() {
  const { data: rules = [], isLoading } = useAlarmRules();
  const createMut = useCreateRule();
  const updateMut = useUpdateRule();
  const deleteMut = useDeleteRule();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<AlarmRule | null>(null);

  function openNew() {
    setEditId(null); setForm(EMPTY); setModalOpen(true);
  }

  function openEdit(r: AlarmRule) {
    setEditId(r.id);
    setForm({
      name: r.name, metric: r.metric, operator: r.operator,
      threshold: r.threshold.toString(), severity: r.severity,
      message_template: r.message_template,
    });
    setModalOpen(true);
  }

  async function onSubmit() {
    if (!form.name || !form.metric || !form.message_template) {
      toast.error('이름/지표/메시지 템플릿은 필수입니다.');
      return;
    }
    const payload = {
      name: form.name,
      metric: form.metric,
      operator: form.operator,
      threshold: Number(form.threshold),
      severity: form.severity,
      message_template: form.message_template,
    };
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, changes: payload });
        toast.success('규칙 수정됨');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('규칙 추가됨');
      }
      setModalOpen(false);
      setEditId(null);
    } catch (e: unknown) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    }
  }

  const columns: Column<AlarmRule>[] = [
    { key: 'name',     header: '이름', render: (r) => r.name },
    { key: 'metric',   header: '지표', render: (r) => <span className="font-mono text-xs">{r.metric}</span> },
    { key: 'op',       header: '조건', align: 'center', render: (r) =>
      <span className="font-mono">{r.operator} {r.threshold}</span>
    },
    { key: 'severity', header: '심각도', align: 'center', render: (r) =>
      r.severity === 'danger'  ? <Pill variant="danger">danger</Pill> :
      r.severity === 'warning' ? <Pill variant="warn">warning</Pill> :
                                  <Pill variant="info">info</Pill>
    },
    { key: 'enabled', header: '활성', align: 'center', render: (r) =>
      r.enabled ? <Pill variant="ok">ON</Pill> : <Pill variant="danger">OFF</Pill>
    },
    { key: 'actions', header: '작업', align: 'right', render: (r) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" onClick={() => updateMut.mutate({ id: r.id, changes: { enabled: !r.enabled } })}>
          {r.enabled ? '끄기' : '켜기'}
        </Button>
        <Button variant="secondary" onClick={() => openEdit(r)}>편집</Button>
        <Button variant="danger" onClick={() => setConfirmDel(r)}>삭제</Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">알람 규칙</h1>
        <Button onClick={openNew}>+ 신규 규칙</Button>
      </div>

      <DataTable columns={columns} rows={rules} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? '규칙 편집' : '신규 규칙'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button onClick={onSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editId ? '저장' : '생성'}
            </Button>
          </>
        }
      >
        <FormField label="규칙 이름 *">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="불량률 상한 초과" />
        </FormField>
        <FormField label="지표 *">
          <Select
            value={form.metric}
            onChange={(e) => setForm({ ...form, metric: e.target.value })}
            options={METRIC_OPTS}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="연산자">
            <Select
              value={form.operator}
              onChange={(e) => setForm({ ...form, operator: e.target.value as AlarmRule['operator'] })}
              options={[
                { value: '>', label: '>' }, { value: '>=', label: '>=' },
                { value: '<', label: '<' }, { value: '<=', label: '<=' },
                { value: '=', label: '=' },
              ]}
            />
          </FormField>
          <FormField label="임계값">
            <TextInput type="number" step="0.01" value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
          </FormField>
        </div>
        <FormField label="심각도">
          <Select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value as AlarmRule['severity'] })}
            options={[
              { value: 'info', label: 'info' },
              { value: 'warning', label: 'warning' },
              { value: 'danger', label: 'danger' },
            ]}
          />
        </FormField>
        <FormField label="메시지 템플릿 *" hint="{{value}}, {{threshold}} 치환자 사용 가능">
          <TextArea value={form.message_template}
            onChange={(e) => setForm({ ...form, message_template: e.target.value })} />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="규칙 삭제"
        message={confirmDel ? `"${confirmDel.name}" 규칙을 삭제하시겠습니까?` : ''}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await deleteMut.mutateAsync(confirmDel.id);
            toast.success('삭제됨');
          } catch (e: unknown) {
            toast.error(`삭제 실패: ${(e as Error).message}`);
          }
          setConfirmDel(null);
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
```

- [ ] **Step 9.3: 검증 + 커밋**
```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(admin): implement alarm rule CRUD with enable toggle"
```

---

## Task 10: TargetPage (인라인 편집)

**Files:**
- Create: `src/hooks/useAdminTargets.ts`
- Modify: `src/pages/admin/TargetPage.tsx`

- [ ] **Step 10.1: 훅**

Create `src/hooks/useAdminTargets.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface TargetRow {
  key: string;
  value: number;
  unit: string | null;
  description: string | null;
}

export function useTargets() {
  return useQuery<TargetRow[]>({
    queryKey: ['admin', 'targets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('targets').select('*').order('key');
      if (error) throw error;
      return (data ?? []) as TargetRow[];
    },
  });
}

export function useUpdateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const { error } = await supabase.from('targets').update({ value }).eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'targets'] }),
  });
}
```

- [ ] **Step 10.2: TargetPage**

Replace `src/pages/admin/TargetPage.tsx`:
```tsx
import { useState } from 'react';
import { useTargets, useUpdateTarget } from '../../hooks/useAdminTargets';
import type { TargetRow } from '../../hooks/useAdminTargets';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { TextInput } from '../../components/common/FormField';
import { toast } from '../../lib/toast';

export function TargetPage() {
  const { data: rows = [], isLoading } = useTargets();
  const updateMut = useUpdateTarget();

  const [editKey, setEditKey]   = useState<string | null>(null);
  const [editValue, setEditVal] = useState<string>('');

  function startEdit(r: TargetRow) {
    setEditKey(r.key);
    setEditVal(r.value.toString());
  }

  async function saveEdit() {
    if (editKey == null) return;
    const num = Number(editValue);
    if (Number.isNaN(num)) {
      toast.error('숫자만 입력 가능합니다.');
      return;
    }
    try {
      await updateMut.mutateAsync({ key: editKey, value: num });
      toast.success('저장됨');
      setEditKey(null);
    } catch (e: unknown) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    }
  }

  const columns: Column<TargetRow>[] = [
    { key: 'key',         header: '키', render: (r) => <span className="font-mono text-xs">{r.key}</span> },
    { key: 'description', header: '설명', render: (r) => r.description ?? '-' },
    { key: 'value',       header: '값', align: 'right', render: (r) =>
      editKey === r.key ? (
        <div className="flex gap-1 items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <TextInput
            type="number" step="0.01"
            value={editValue}
            onChange={(e) => setEditVal(e.target.value)}
            className="!w-24"
          />
          <Button onClick={saveEdit} disabled={updateMut.isPending}>저장</Button>
          <Button variant="secondary" onClick={() => setEditKey(null)}>취소</Button>
        </div>
      ) : (
        <span className="font-mono">{r.value} {r.unit ?? ''}</span>
      )
    },
    { key: 'actions', header: '', align: 'right', render: (r) =>
      editKey === r.key ? null : (
        <Button variant="secondary" onClick={() => startEdit(r)}>편집</Button>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text">목표값 관리</h1>
      <DataTable columns={columns} rows={rows} loading={isLoading} />
    </div>
  );
}
```

- [ ] **Step 10.3: 검증 + 커밋**
```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(admin): implement target value inline editing"
```

---

## Task 11: UserPage (invite + 역할 관리)

**Files:**
- Create: `src/hooks/useAdminUsers.ts`
- Modify: `src/pages/admin/UserPage.tsx`

- [ ] **Step 11.1: 훅**

Create `src/hooks/useAdminUsers.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface UserRow {
  id: string;
  full_name: string | null;
  role: 'admin' | 'viewer';
  active: boolean;
  created_at: string;
  email?: string;
}

export function useUsers() {
  return useQuery<UserRow[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      // profiles + auth.users 조인은 RLS 때문에 직접 불가 → profiles만 조회
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });
}

export interface InviteInput {
  email: string;
  full_name: string;
  role: 'admin' | 'viewer';
  password?: string;
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteInput) => {
      const { data, error } = await supabase.functions.invoke('invite-user', { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useUpdateUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, changes,
    }: { id: string; changes: Partial<Pick<UserRow, 'role' | 'active' | 'full_name'>> }) => {
      const { error } = await supabase.from('profiles').update(changes).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
```

- [ ] **Step 11.2: UserPage**

Replace `src/pages/admin/UserPage.tsx`:
```tsx
import { useState } from 'react';
import {
  useUsers, useInviteUser, useUpdateUserProfile,
} from '../../hooks/useAdminUsers';
import type { UserRow } from '../../hooks/useAdminUsers';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField, TextInput } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { toast } from '../../lib/toast';

interface InviteForm {
  email: string;
  full_name: string;
  role: 'admin' | 'viewer';
  password: string;
}

const EMPTY: InviteForm = { email: '', full_name: '', role: 'viewer', password: '' };

export function UserPage() {
  const { data: rows = [], isLoading } = useUsers();
  const inviteMut = useInviteUser();
  const updateMut = useUpdateUserProfile();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<InviteForm>(EMPTY);

  async function onInvite() {
    if (!form.email || !form.full_name) {
      toast.error('이메일과 이름은 필수입니다.');
      return;
    }
    try {
      await inviteMut.mutateAsync({
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        password: form.password || undefined,
      });
      toast.success(`${form.email} 초대됨`);
      setModalOpen(false);
      setForm(EMPTY);
    } catch (e: unknown) {
      toast.error(`초대 실패: ${(e as Error).message}`);
    }
  }

  const columns: Column<UserRow>[] = [
    { key: 'name',    header: '이름', render: (r) => r.full_name ?? '-' },
    { key: 'role',    header: '권한', align: 'center', render: (r) =>
      r.role === 'admin' ? <Pill variant="danger">admin</Pill> : <Pill variant="info">viewer</Pill>
    },
    { key: 'active',  header: '상태', align: 'center', render: (r) =>
      r.active ? <Pill variant="ok">활성</Pill> : <Pill variant="danger">비활성</Pill>
    },
    { key: 'created', header: '생성일', render: (r) =>
      new Date(r.created_at).toLocaleDateString('ko-KR')
    },
    { key: 'actions', header: '작업', align: 'right', render: (r) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <Select
          value={r.role}
          onChange={(e) => updateMut.mutate({ id: r.id, changes: { role: e.target.value as UserRow['role'] } })}
          options={[
            { value: 'viewer', label: 'viewer' },
            { value: 'admin', label: 'admin' },
          ]}
          className="!py-1 !text-[11px] w-[80px]"
        />
        <Button variant="secondary" onClick={() => updateMut.mutate({ id: r.id, changes: { active: !r.active } })}>
          {r.active ? '비활성화' : '활성화'}
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">사용자 관리</h1>
        <Button onClick={() => setModalOpen(true)}>+ 사용자 초대</Button>
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="사용자 초대"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button onClick={onInvite} disabled={inviteMut.isPending}>초대</Button>
          </>
        }
      >
        <FormField label="이메일 *">
          <TextInput type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </FormField>
        <FormField label="이름 *">
          <TextInput value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </FormField>
        <FormField label="권한">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'viewer' })}
            options={[
              { value: 'viewer', label: 'viewer (읽기 + 알람 acknowledge)' },
              { value: 'admin', label: 'admin (전체 관리)' },
            ]}
          />
        </FormField>
        <FormField label="초기 비밀번호 (선택)" hint="미입력 시 사용자가 이메일 확인 후 스스로 설정">
          <TextInput type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="8자 이상" />
        </FormField>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 11.3: 검증 + 커밋**
```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(admin): implement user management with invite via edge function"
```

---

## Task 12: Admin 플로우 스모크 테스트

**Files:**
- Create: `src/pages/admin/LotManagePage.test.tsx`, `UserPage.test.tsx`

- [ ] **Step 12.1: LotManagePage 스모크**

Create `src/pages/admin/LotManagePage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LotManagePage } from './LotManagePage';

vi.mock('../../hooks/useLots', () => ({
  useLots: () => ({
    data: [{
      id: 'l1', lot_no: 'LOT-TEST-1', client_id: 'c1', client_name: '삼성웰스토리',
      product_name: '온열팩', status: 'planned', started_at: null, ended_at: null,
      target_quantity: 3000, notes: null,
      inspected: 0, good_count: 0, defect_count: 0, unknown_count: 0,
      defect_rate_pct: 0, judgment: '미검사',
    }],
    isLoading: false,
  }),
}));

vi.mock('../../hooks/useAdminLots', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAdminLots')>('../../hooks/useAdminLots');
  return {
    ...actual,
    useCreateLot: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateLot: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteLot: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useStartLot: () => vi.fn(),
    useEndLot: () => vi.fn(),
    fetchClients: () => Promise.resolve([{ id: 'c1', name: '삼성웰스토리' }]),
  };
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

describe('LotManagePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders LOT table with action buttons', () => {
    render(wrap(<LotManagePage />));
    expect(screen.getByText('LOT 관리')).toBeInTheDocument();
    expect(screen.getByText('LOT-TEST-1')).toBeInTheDocument();
    expect(screen.getByText('+ 신규 LOT')).toBeInTheDocument();
  });

  it('opens create modal on button click', () => {
    render(wrap(<LotManagePage />));
    fireEvent.click(screen.getByText('+ 신규 LOT'));
    expect(screen.getByText('신규 LOT')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('LOT-20260424-001')).toBeInTheDocument();
  });
});
```

- [ ] **Step 12.2: UserPage 스모크**

Create `src/pages/admin/UserPage.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserPage } from './UserPage';

vi.mock('../../hooks/useAdminUsers', () => ({
  useUsers: () => ({
    data: [{
      id: 'u1', full_name: '관리자', role: 'admin', active: true,
      created_at: '2026-04-01T00:00:00Z',
    }],
    isLoading: false,
  }),
  useInviteUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateUserProfile: () => ({ mutate: vi.fn() }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

describe('UserPage', () => {
  it('renders user list with role pill', () => {
    render(wrap(<UserPage />));
    expect(screen.getByText('사용자 관리')).toBeInTheDocument();
    expect(screen.getByText('관리자')).toBeInTheDocument();
    expect(screen.getAllByText('admin').length).toBeGreaterThan(0);
  });

  it('opens invite modal', () => {
    render(wrap(<UserPage />));
    fireEvent.click(screen.getByText('+ 사용자 초대'));
    expect(screen.getByText('사용자 초대')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('8자 이상')).toBeInTheDocument();
  });
});
```

- [ ] **Step 12.3: 검증 + 커밋**
```bash
pnpm test
```
Expected: 기존 7 + 2 (LotManage) + 2 (User) = **11 unit tests**.

```bash
git add -A
git commit -m "test(admin): smoke tests for LotManagePage and UserPage"
```

---

## Task 13: README Phase 3 업데이트

- [ ] **Step 13.1: README 보강**

Read `README.md`. After the `**Phase 2 범위:** ...` line, add:
```markdown
**Phase 3 범위:** 관리 기능 — admin CRUD 6개 페이지 + 알람 엔진(임계값 초과 시 자동 토스트) + 사용자 초대 Edge Function.
```

- [ ] **Step 13.2: 커밋**
```bash
git add README.md
git commit -m "docs: describe Phase 3 scope in README"
```

---

## Task 14: Phase 3 회귀 + 태그

- [ ] **Step 14.1: 전체 회귀**
```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test                   # 11 unit tests

supabase stop
supabase start
supabase db reset           # 23 migrations
supabase test db            # 54 pgTAP tests
pnpm db:mock

pnpm types:gen
git status --short          # db.ts diff? → commit
```

통합 테스트 (invite-user 포함):
```bash
export SUPABASE_ANON_KEY=$(supabase status -o env | grep "^ANON_KEY=" | cut -d'"' -f2)
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep "^SERVICE_ROLE_KEY=" | cut -d'"' -f2)
pnpm test:integration       # 12 tests (7 ingest + 5 invite-user)
```

- [ ] **Step 14.2: 수동 브라우저 플로우**

`pnpm dev` → 로그인 → 확인 포인트:
- `/admin/lots`에서 LOT 생성·편집·삭제·시작/종료
- `/admin/claims`에서 클레임 등록·상태 변경
- `/admin/devices`에서 장비 추가 → API 키 모달 1회 표시 → 재발급도 OK
- `/admin/alarm-rules`에서 임계값 수정 → enable/disable
- `/admin/targets`에서 값 인라인 편집
- `/admin/users`에서 사용자 초대 (Mailpit `http://127.0.0.1:54324`에서 이메일 확인 가능)
- **알람 토스트**: 임계값 초과 메트릭 주입 테스트
  ```bash
  psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -c "
    insert into vision_inspector_metrics
      (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
    values
      ((select id from devices where code='vision_01'),
       now(), 100, 50, 45, 5, 60);"
  ```
  → 브라우저에 "불량률 ... 목표 1% 초과" 토스트가 즉시 떠야 함.

- [ ] **Step 14.3: 태그**
```bash
git tag phase-3-complete
git log --oneline | head -25
git tag --list
```

---

## Phase 3 완료 체크리스트

- [x] `pnpm lint && typecheck && build && test` 그린
- [x] `supabase db reset && supabase test db` 그린 (54 tests)
- [x] `pnpm test:integration` 그린 (12 tests)
- [x] 6 admin 페이지 모두 동작 (CRUD + 상태 변경)
- [x] 알람 트리거 + Realtime 토스트 동작 확인
- [x] `invite-user` Edge Function으로 사용자 초대 성공
- [x] `phase-3-complete` 태그

**다음 단계 (Phase 4):** PDF 리포트 생성 + LLM 분석 연동 + CI/CD + 배포 체크리스트.
