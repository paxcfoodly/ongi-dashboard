# Phase 4: 리포트 생성 + LLM 분석 + 배포 준비

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) LOT 품질 성적서 · 클레임 대응 보고서를 PDF로 출력할 수 있다. (2) 제조원가 개선방안 · 클레임 대응문을 Claude API로 자동 생성한다. (3) 장비 API 키를 bcrypt 해시로 저장한다. (4) 장비 오프라인 감지 자동 알람. (5) GitHub Actions CI + Supabase 클라우드 배포 가이드가 정리되어 있다. (6) Playwright로 핵심 플로우 E2E 회귀 가능.

**Architecture:**
- PDF: Supabase Edge Function(Deno) + pdfmake + Noto Sans KR 폰트를 Supabase Storage에 업로드해 런타임 로드. 생성된 PDF는 Storage에 업로드하고 signed URL 반환.
- LLM: 별도 Edge Function이 Anthropic Claude API 호출. 호출자 JWT로 admin 권한 확인, 시스템 프롬프트 + KPI 컨텍스트를 조합. `ANTHROPIC_API_KEY` 없으면 mock 응답 fallback.
- bcrypt: `pgcrypto` extension의 `crypt()` / `gen_salt('bf')` 사용. 기존 장비 6대는 재발급 유도.
- Offline detection: `pg_cron` 매 1분 실행되는 함수가 last_seen_at 지연 장비를 찾아 alarm insert.
- CI: GitHub Actions lint/typecheck/test/build. `supabase db push` 는 수동 트리거 워크플로 별도.
- 배포: Supabase Cloud + Vercel(또는 Cloudflare Pages) — 코드와 문서만 준비, 실제 프로비저닝은 사용자 수동 단계.
- E2E: Playwright로 로그인 → KPI 렌더 → 알람 토스트 3가지 시나리오.

**Tech Stack (추가):**
- `@anthropic-ai/sdk` (Edge Function에서 import via esm.sh)
- `pdfmake` (Edge Function)
- `@playwright/test`
- `@supabase/supabase-js` 기존 사용

**Phase 4 완료 조건:**
- LOT 이력 탭의 **PDF 출력** 버튼이 실제 PDF를 생성·다운로드
- 제조원가 탭의 **개선 방안 분석 요청** 버튼이 Claude 응답을 토스트·모달로 표시
- 장비 2분 이상 미수신 시 `source='system'` warning 알람 자동 발생
- API 키가 bcrypt 해시로 저장되고 /ingest가 이를 검증
- `.github/workflows/ci.yml` 로 PR CI 통과
- `docs/DEPLOYMENT.md` 가 실제 배포 절차를 단계별로 설명
- Playwright E2E 3건 통과
- 전체 테스트: 기존 77 + 신규 ~10 = ~87 green
- `phase-4-complete` 태그

**스펙 문서:** `docs/superpowers/specs/2026-04-23-ongi-dashboard-design.md`
**이전 Phase:** Phase 3 완료 (태그 `phase-3-complete`, main HEAD)

**중요 주의:**
- LLM은 **내장 API 키가 없으면 mock 응답**을 반환하도록 구현해 테스트 통과 보장. 실제 키는 사용자가 `supabase/.env.local` 에 `ANTHROPIC_API_KEY=...` 로 주입.
- Supabase Cloud 배포는 **사용자 계정·프로젝트가 필요**하므로 본 Phase에서는 코드·문서만 준비하고 실제 `supabase link && db push` 는 user action.

---

## 파일 구조 (Phase 4 종료 시점 추가분)

```
supabase/
├── migrations/
│   ├── 20260424000005_api_key_bcrypt.sql
│   └── 20260424000006_device_offline_cron.sql
├── functions/
│   ├── generate-pdf/
│   │   ├── index.ts
│   │   ├── templates.ts              LOT/클레임 템플릿
│   │   └── fonts.ts                  Noto Sans KR 로드
│   └── llm-analyze/
│       ├── index.ts
│       └── prompts.ts                시스템 프롬프트 템플릿
└── tests/
    └── 13_device_offline.sql

src/
├── hooks/
│   ├── usePdfReport.ts               PDF 생성 요청
│   └── useLlmAnalyze.ts              LLM 분석 요청
└── components/
    └── common/
        └── ResponseModal.tsx         LLM 응답 표시용 마크다운 모달

tests/
├── generate-pdf.test.ts              통합 테스트 (1~2건)
└── llm-analyze.test.ts               통합 테스트 (mock 모드)

e2e/                                   Playwright 루트
├── login.spec.ts
├── kpi-render.spec.ts
└── alarm-toast.spec.ts
playwright.config.ts

.github/
└── workflows/
    └── ci.yml

docs/
├── DEPLOYMENT.md                     Supabase Cloud + Vercel 배포 가이드
└── OPERATIONS.md                     운영 체크리스트 (백업·모니터링·장비 키 로테이션)

scripts/
└── upload-fonts.sh                   Noto Sans KR TTF를 Storage에 업로드
```

---

## 전제 조건

```bash
git branch --show-current          # phase-4-reports
git log --oneline | head -3        # phase-3-complete 태그 확인
supabase status                    # 기동 중
pnpm lint && pnpm typecheck && pnpm test
supabase test db                   # 54 tests green
pnpm test:integration              # 12 tests green
```

---

## Task 1: API 키 bcrypt 해시 + 검증 업데이트

**Files:**
- Create: `supabase/migrations/20260424000005_api_key_bcrypt.sql`
- Modify: `supabase/functions/ingest/handlers.ts` (verifyApiKey를 bcrypt 비교로)
- Modify: `src/hooks/useAdminDevices.ts` (생성·재발급 시 DB 함수 호출로 해시)

- [ ] **Step 1.1: pgcrypto + 해시 함수**

Create `supabase/migrations/20260424000005_api_key_bcrypt.sql`:
```sql
create extension if not exists pgcrypto;

-- 새 키를 받아 bcrypt 해시로 변환해 저장하는 헬퍼 RPC
-- admin만 호출 가능
create or replace function fn_set_device_api_key(
  p_device_id uuid,
  p_plain_key text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only admin can set device api key';
  end if;
  update devices
     set api_key_hash = crypt(p_plain_key, gen_salt('bf', 10))
   where id = p_device_id;
end; $$;

grant execute on function fn_set_device_api_key(uuid, text) to authenticated;

-- 검증 헬퍼 (Edge Function에서 service_role로 호출)
create or replace function fn_verify_device_api_key(
  p_device_id uuid,
  p_plain_key text
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from devices
     where id = p_device_id
       and api_key_hash = crypt(p_plain_key, api_key_hash)
  );
$$;

-- 서비스롤만 직접 호출 (authenticated는 불허)
revoke execute on function fn_verify_device_api_key(uuid, text) from public, authenticated;
grant execute on function fn_verify_device_api_key(uuid, text) to service_role;

-- 기존 seed 장비 6대는 평문 문자열이 저장되어 있음 → 로그인-후-재발급 유도
-- 여기서는 placeholder 플래그를 두지 않고, 관리자가 장비 페이지에서 각 장비의 키를
-- 재발급하면 자동으로 bcrypt 해시로 교체된다.
```

- [ ] **Step 1.2: Edge Function 검증 로직 갱신**

Read `supabase/functions/ingest/handlers.ts`. Replace `verifyApiKey`:
```ts
export async function verifyApiKey(
  admin: SupabaseClient,
  deviceId: string,
  provided: string
): Promise<boolean> {
  const { data, error } = await admin.rpc('fn_verify_device_api_key', {
    p_device_id: deviceId,
    p_plain_key: provided,
  });
  if (error) return false;
  return data === true;
}
```

Then in `index.ts`, update the call site:
```ts
if (!(await verifyApiKey(admin, device.id, apiKey))) {
  ...
}
```

**Backward compat for seed devices**: seed `api_key_hash = 'seed-hash-replace-on-first-use'` is raw text. `crypt('seed-hash-replace-on-first-use', 'seed-hash-replace-on-first-use')` will compare the plain text against itself as if it were a hash — pgcrypto returns the input truncated/hashed which **won't equal** the plain text. So seed devices cannot auth until re-issued. Document this in DEPLOYMENT.md.

Re-issued keys go through `fn_set_device_api_key` RPC → stored as proper bcrypt hash.

- [ ] **Step 1.3: useAdminDevices.ts 수정**

Change `useCreateDevice` and `useRegenerateDeviceKey` to call the RPC after generating the plain key:
```ts
export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeviceInput) => {
      const apiKey = generateApiKey();
      // 1) 일단 placeholder로 insert
      const { data: device, error } = await supabase.from('devices')
        .insert({ ...input, api_key_hash: 'pending', active: true })
        .select().single();
      if (error) throw error;
      // 2) RPC로 bcrypt 해시 설정
      const { error: setErr } = await supabase.rpc('fn_set_device_api_key', {
        p_device_id: device.id, p_plain_key: apiKey,
      });
      if (setErr) throw setErr;
      return { device, apiKey };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'devices'] }),
  });
}

export function useRegenerateDeviceKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const apiKey = generateApiKey();
      const { error } = await supabase.rpc('fn_set_device_api_key', {
        p_device_id: id, p_plain_key: apiKey,
      });
      if (error) throw error;
      return apiKey;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'devices'] }),
  });
}
```

- [ ] **Step 1.4: 검증**

```bash
supabase db reset
supabase test db                                 # 54 여전히 녹색

# Edge Function 통합 테스트는 seed 키 기반이라 실패할 것 → 통합 테스트 update 필요
# Modify tests/ingest.test.ts: beforeAll에서 device api_key를 새로 설정
```

Modify `tests/ingest.test.ts` — add a `beforeAll` step that calls RPC to set keys for `packaging_01` and `vision_01`. Example:
```ts
beforeAll(async () => {
  // 테스트용 device 키를 평문 'test-plain-key-123'으로 설정 (RPC는 admin이 필요하므로 service role 직접 SQL)
  await admin.rpc('fn_set_device_api_key', { p_device_id: <packaging_01 id>, p_plain_key: 'test-plain-key-123' });
  await admin.rpc('fn_set_device_api_key', { p_device_id: <vision_01 id>, p_plain_key: 'test-plain-key-123' });
  ...
});
```

service_role client는 `is_admin()` 체크를 통과하지 못하므로, 대신 `update devices set api_key_hash = crypt(...)` 를 직접 실행:
```ts
const { data: vision } = await admin.from('devices').select('id').eq('code', 'vision_01').single();
await admin.rpc('exec_sql', { ... }); // 없음 — 대신:
// service role JWT는 postgres 직접 쿼리 가능한 권한 가짐 → SQL 실행
// 통합 테스트에서는 bcrypt hash를 TS에서 계산하기 어려우니,
// 테스트용 엔드포인트 또는 환경 훅을 만드는 대신:
// → admin service role이 fn_set_device_api_key를 호출하도록 is_admin 체크를 완화:
//   "is_admin() OR current_user = 'postgres'"
```

실질적으로 가장 간단한 경로는 `fn_set_device_api_key` 함수에서 권한 체크를 `is_admin() OR (auth.role() = 'service_role')` 으로 확장하는 것:

Update migration 20260424000005 함수 정의:
```sql
if not is_admin() and coalesce(auth.role(), '') <> 'service_role' then
  raise exception 'only admin or service_role can set device api key';
end if;
```

그러면 통합 테스트에서 service_role 클라이언트로 RPC 호출 가능.

Test beforeAll:
```ts
const TEST_KEY = 'test-plain-key-123';
const { data: vision } = await admin.from('devices').select('id').eq('code','vision_01').single();
await admin.rpc('fn_set_device_api_key', { p_device_id: vision!.id, p_plain_key: TEST_KEY });
```

Then tests use `headers(..., TEST_KEY)` everywhere instead of the seed string.

- [ ] **Step 1.5: 테스트 및 커밋**

```bash
pnpm test:integration                # 12 tests still green (ingest + invite-user)
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(security): bcrypt hash device API keys via fn_set_device_api_key RPC"
```

---

## Task 2: Noto Sans KR 폰트 Storage 업로드 스크립트

**Files:**
- Create: `scripts/upload-fonts.sh`
- Create: `supabase/migrations/20260424000007_fonts_bucket.sql`

- [ ] **Step 2.1: 버킷 생성 마이그레이션**

Create `supabase/migrations/20260424000007_fonts_bucket.sql`:
```sql
-- Private bucket for system assets (fonts etc.). Only service_role reads.
insert into storage.buckets (id, name, public)
values ('system-assets', 'system-assets', false)
on conflict (id) do nothing;

-- RLS: service_role만 전체 접근
create policy "service role only" on storage.objects
  for all to service_role
  using (bucket_id = 'system-assets')
  with check (bucket_id = 'system-assets');
```

(Supabase는 `storage.objects`에 기본 정책이 있으므로 위 정책이 추가되어 service_role 이외 접근은 차단됨.)

- [ ] **Step 2.2: 폰트 다운로드 + 업로드 스크립트**

Create `scripts/upload-fonts.sh`:
```bash
#!/usr/bin/env bash
# Noto Sans KR TTF를 Supabase Storage 'system-assets' 버킷에 업로드.
# Supabase 로컬이 기동 중이어야 한다.
set -euo pipefail

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"

# Google Fonts GitHub 미러에서 Noto Sans KR Regular/Bold 다운로드
echo "Downloading Noto Sans KR..."
curl -sSLf -o NotoSansKR-Regular.ttf \
  "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf" || \
  curl -sSLf -o NotoSansKR-Regular.ttf \
  "https://fonts.google.com/download?family=Noto%20Sans%20KR"

curl -sSLf -o NotoSansKR-Bold.ttf \
  "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf" || true

ANON="$(supabase status -o env | grep '^ANON_KEY=' | cut -d'"' -f2)"
SERVICE="$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)"

upload() {
  local src="$1" dst="$2"
  echo "Uploading $src -> $dst"
  curl -sSLf -X POST "http://127.0.0.1:54321/storage/v1/object/system-assets/$dst" \
    -H "apikey: $SERVICE" \
    -H "Authorization: Bearer $SERVICE" \
    -H "Content-Type: font/ttf" \
    --data-binary "@$src"
  echo
}

upload NotoSansKR-Regular.ttf fonts/NotoSansKR-Regular.ttf
[ -f NotoSansKR-Bold.ttf ] && upload NotoSansKR-Bold.ttf fonts/NotoSansKR-Bold.ttf || true

echo "Done."
```

`chmod +x scripts/upload-fonts.sh`

**Note**: Noto Sans KR 라이선스는 SIL OFL — 재배포·임베드 허용. 다운로드 URL이 막히면 로컬 `~/Library/Fonts/NotoSansKR-Regular.otf` 등을 사용하도록 가이드 추가 (DEPLOYMENT.md).

- [ ] **Step 2.3: 검증**

```bash
supabase db reset
bash scripts/upload-fonts.sh 2>&1
# 성공 시: HTTP 200 + {"Key":"system-assets/fonts/NotoSansKR-Regular.ttf"}
```

- [ ] **Step 2.4: 커밋**

```bash
git add -A
git commit -m "chore(storage): add system-assets bucket and font upload script"
```

---

## Task 3: generate-pdf Edge Function — 스켈레톤 + LOT 템플릿

**Files:**
- Create: `supabase/functions/generate-pdf/index.ts`, `templates.ts`, `fonts.ts`
- Modify: `supabase/config.toml` (함수 등록)

- [ ] **Step 3.1: 초기화**

```bash
supabase functions new generate-pdf
```

- [ ] **Step 3.2: fonts.ts**

Create `supabase/functions/generate-pdf/fonts.ts`:
```ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function loadKoreanFonts(admin: SupabaseClient) {
  const { data: reg, error: e1 } = await admin.storage
    .from('system-assets').download('fonts/NotoSansKR-Regular.ttf');
  if (e1 || !reg) throw new Error('failed to load NotoSansKR-Regular: ' + (e1?.message ?? 'no data'));
  const regularBuf = new Uint8Array(await reg.arrayBuffer());

  let boldBuf = regularBuf;
  const { data: bold } = await admin.storage
    .from('system-assets').download('fonts/NotoSansKR-Bold.ttf');
  if (bold) boldBuf = new Uint8Array(await bold.arrayBuffer());

  return {
    NotoSansKR: {
      normal: regularBuf,
      bold: boldBuf,
      italics: regularBuf,
      bolditalics: boldBuf,
    },
  };
}
```

- [ ] **Step 3.3: templates.ts — LOT 성적서**

Create `supabase/functions/generate-pdf/templates.ts`:
```ts
import type { TDocumentDefinitions } from 'https://esm.sh/pdfmake@0.2.10/interfaces.d.ts';

interface LotDocInput {
  lot_no: string;
  client_name: string;
  product_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  target_quantity: number | null;
  inspected: number;
  good_count: number;
  defect_count: number;
  unknown_count: number;
  defect_rate_pct: number;
  judgment: string;
}

function fmt(n: number | null | undefined) {
  return n == null ? '-' : n.toLocaleString('ko-KR');
}

function date(s: string | null) {
  return s ? new Date(s).toLocaleString('ko-KR') : '-';
}

export function lotReportDoc(input: LotDocInput): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [48, 56, 48, 48],
    defaultStyle: { font: 'NotoSansKR', fontSize: 10, color: '#0F2340' },
    header: {
      margin: [48, 24, 48, 0],
      columns: [
        { text: '온기코퍼레이션', bold: true, fontSize: 13, color: '#1E64B4' },
        { text: '품질 성적서', alignment: 'right', fontSize: 10, color: '#5F708A' },
      ],
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage}/${pageCount}`,
      alignment: 'center',
      margin: [0, 8, 0, 0],
      fontSize: 8,
      color: '#8CA0B8',
    }),
    content: [
      { text: `LOT 품질 성적서`, bold: true, fontSize: 16, margin: [0, 0, 0, 12] },
      {
        columns: [
          [
            { text: 'LOT 번호', color: '#5F708A', fontSize: 9 },
            { text: input.lot_no, bold: true, fontSize: 12, margin: [0, 2, 0, 0] },
          ],
          [
            { text: '납품처', color: '#5F708A', fontSize: 9 },
            { text: input.client_name, bold: true, fontSize: 12, margin: [0, 2, 0, 0] },
          ],
          [
            { text: '발행일시', color: '#5F708A', fontSize: 9 },
            { text: new Date().toLocaleString('ko-KR'), fontSize: 11, margin: [0, 2, 0, 0] },
          ],
        ],
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          widths: ['30%', '*'],
          body: [
            ['제품명', input.product_name ?? '-'],
            ['생산 시작', date(input.started_at)],
            ['생산 종료', date(input.ended_at)],
            ['목표 수량', input.target_quantity != null ? `${fmt(input.target_quantity)} ea` : '-'],
            ['검사 수량', `${fmt(input.inspected)} ea`],
            ['양품 수량', `${fmt(input.good_count)} ea`],
            ['불량 수량', `${fmt(input.defect_count)} ea`],
            ['판정불가', `${fmt(input.unknown_count)} ea`],
            ['불량률', `${input.defect_rate_pct.toFixed(2)}%`],
            [{ text: '판정', bold: true }, { text: input.judgment, bold: true, color: judgmentColor(input.judgment) }],
          ],
        },
        layout: {
          fillColor: (row: number) => (row % 2 === 0 ? '#F5F8FC' : null),
          hLineColor: () => '#DCE6F2',
          vLineColor: () => '#DCE6F2',
        },
        margin: [0, 0, 0, 24],
      },
      {
        columns: [
          { text: '품질관리 책임자', alignment: 'center', fontSize: 9, color: '#5F708A' },
          { text: '(서명)', alignment: 'center', fontSize: 9, color: '#8CA0B8' },
        ],
        margin: [0, 40, 0, 0],
      },
    ],
  };
}

function judgmentColor(j: string): string {
  if (j === '정상') return '#1D9E75';
  if (j === '주의') return '#E8933A';
  if (j === '불합격') return '#D94444';
  return '#5F708A';
}
```

- [ ] **Step 3.4: index.ts**

Replace `supabase/functions/generate-pdf/index.ts`:
```ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import pdfMake from 'https://esm.sh/pdfmake@0.2.10/build/pdfmake.js';
import { loadKoreanFonts } from './fonts.ts';
import { lotReportDoc } from './templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'missing_auth' }, 401);

  // 호출자 인증 확인 (뷰어 이상)
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'unauthorized' }, 401);

  // Body: { type: 'lot_report', id: <uuid> }
  let body: { type?: string; id?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!body.type || !body.id) return json({ error: 'missing_params' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (body.type !== 'lot_report') {
    return json({ error: 'unknown_type' }, 400);
  }

  // LOT 데이터 조회
  const { data: lot, error: lotErr } = await admin
    .from('v_lot_summary').select('*').eq('id', body.id).maybeSingle();
  if (lotErr || !lot) return json({ error: 'lot_not_found' }, 404);

  // 폰트 로드
  let vfs: Record<string, Uint8Array>;
  try {
    const fonts = await loadKoreanFonts(admin);
    vfs = {
      'NotoSansKR-Regular.ttf': fonts.NotoSansKR.normal,
      'NotoSansKR-Bold.ttf': fonts.NotoSansKR.bold,
    };
  } catch (e) {
    return json({ error: 'fonts_unavailable', message: (e as Error).message }, 500);
  }

  const pdfmake = pdfMake as unknown as {
    createPdf: (doc: unknown, tableLayouts?: unknown, fonts?: unknown, vfs?: unknown) => {
      getBuffer: (cb: (buf: Uint8Array) => void) => void;
    };
  };

  const doc = lotReportDoc(lot);
  const buf: Uint8Array = await new Promise((resolve, reject) => {
    try {
      pdfmake.createPdf(doc, undefined, {
        NotoSansKR: {
          normal: 'NotoSansKR-Regular.ttf',
          bold: 'NotoSansKR-Bold.ttf',
          italics: 'NotoSansKR-Regular.ttf',
          bolditalics: 'NotoSansKR-Bold.ttf',
        },
      }, vfs).getBuffer((b: Uint8Array) => resolve(b));
    } catch (e) { reject(e); }
  });

  // Storage 업로드
  const fileName = `lot/${lot.lot_no}-${Date.now()}.pdf`;
  const { error: upErr } = await admin.storage
    .from('reports').upload(fileName, buf, {
      contentType: 'application/pdf', upsert: true,
    });
  if (upErr) return json({ error: 'upload_failed', message: upErr.message }, 500);

  const { data: signed } = await admin.storage
    .from('reports').createSignedUrl(fileName, 60 * 15);
  return json({ ok: true, url: signed?.signedUrl, file: fileName });
});
```

- [ ] **Step 3.5: reports 버킷 migration**

Append to `supabase/migrations/20260424000007_fonts_bucket.sql` (or separate 20260424000008):
```sql
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- 인증 사용자가 자신이 생성 요청한 리포트 다운로드 가능 (signed URL로 전달됨)
-- Storage 정책은 signed URL이 service_role로 pre-signed 되므로 별도 정책 불필요
```

- [ ] **Step 3.6: config.toml 확인**

Ensure `[functions.generate-pdf] verify_jwt=false` (호출자 JWT는 함수 내부에서 재검증).

- [ ] **Step 3.7: 검증 + 커밋**

```bash
supabase db reset
bash scripts/upload-fonts.sh
supabase stop && supabase start   # 새 함수 로드
# 수동 테스트는 Task 4 (프론트 연동) 때 시행

git add -A
git commit -m "feat(edge): add generate-pdf function with Noto Sans KR and LOT report template"
```

---

## Task 4: 프론트 PDF 버튼 연결 + LOT 이력 다운로드

**Files:**
- Create: `src/hooks/usePdfReport.ts`
- Modify: `src/pages/LotHistoryPage.tsx` (PDF 버튼 실제 동작)

- [ ] **Step 4.1: usePdfReport 훅**

Create `src/hooks/usePdfReport.ts`:
```ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface PdfReportResponse {
  ok: boolean;
  url?: string;
  file?: string;
  error?: string;
}

export function useGeneratePdf() {
  return useMutation<PdfReportResponse, Error, { type: 'lot_report'; id: string }>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: input,
      });
      if (error) throw error;
      return data as PdfReportResponse;
    },
  });
}
```

- [ ] **Step 4.2: LotHistoryPage 버튼 실제 동작**

Read `src/pages/LotHistoryPage.tsx`. Replace the detail panel's PDF 버튼 onClick:
```tsx
// 이전:
// <button onClick={() => alert('PDF 출력은 Phase 4에서 구현됩니다.')} ...>
// 변경:
<button
  onClick={async () => {
    toast.info('PDF 생성 중…');
    const res = await pdfMut.mutateAsync({ type: 'lot_report', id: selected.id }).catch(() => null);
    if (res?.ok && res.url) {
      window.open(res.url, '_blank');
      toast.success('PDF 생성됨');
    } else {
      toast.error('PDF 생성 실패');
    }
  }}
  className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary-dark"
>
  PDF 출력
</button>
```

Add imports:
```tsx
import { useGeneratePdf } from '../hooks/usePdfReport';
import { toast } from '../lib/toast';
```

Inside LotHistoryPage:
```tsx
const pdfMut = useGeneratePdf();
```

Also update the top-of-page filter "PDF 출력" 버튼 — leave it disabled or change message (spec에서는 LOT 상세용이 핵심).

- [ ] **Step 4.3: 검증**

```bash
pnpm dev
supabase functions serve generate-pdf --env-file ./supabase/.env.local --no-verify-jwt &
```

브라우저에서:
1. 로그인 → `/lot`
2. LOT 행 클릭 → 상세 패널 → **PDF 출력**
3. 새 탭에 PDF 렌더링 (한글 표시되는지)

- [ ] **Step 4.4: 커밋**

```bash
git add -A
git commit -m "feat(lot): wire PDF output button on LOT detail panel"
```

---

## Task 5: llm-analyze Edge Function + Claude API 연동

**Files:**
- Create: `supabase/functions/llm-analyze/index.ts`, `prompts.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 5.1: 프롬프트 모듈**

Create `supabase/functions/llm-analyze/prompts.ts`:
```ts
export const SYSTEM_PROMPTS = {
  cost_improvement: `당신은 한국어로 소통하는 온열팩 제조업 운영 개선 컨설턴트입니다.
입력으로 주어지는 실시간 KPI·재공재고·공정 흐름 데이터를 분석해 다음을 작성하세요:
1) 현재 상황 진단 (3~5 bullet)
2) 우선순위 높은 개선 과제 3가지 (과제명 / 근거 / 예상 효과)
3) 1주일 내 실행 가능한 액션 아이템 3가지 (담당 부서 추정 포함)
결과는 간결한 마크다운으로 작성하고 데이터에 없는 가정은 피하세요.`,

  claim_response: `당신은 B2B 식품 납품사 고객 응대 담당자입니다.
아래 클레임 정보와 관련 LOT 품질 데이터를 기반으로 **고객사에 보낼 공식 대응문**을 한국어 존댓말로 작성하세요.
- 사과 + 원인 추정 + 후속 조치 + 재발 방지 약속 4단 구조
- 수치는 반드시 제공된 값만 사용
- 1~2 문단, 과장 없이 책임감 있는 톤
- 끝에 품질관리팀 서명을 남기세요.`,
};

export function buildCostImprovementContext(input: {
  kpi: { today_production: number; defect_rate_pct: number; hourly_production: number };
  cost: { wip_total: number; total_production: number; cost_ratio_pct: number };
  wip: Array<{ from_name: string; wip_quantity: number }>;
}): string {
  const wipList = input.wip
    .filter((w) => w.wip_quantity > 0)
    .map((w) => `- ${w.from_name}: 재공 ${w.wip_quantity.toLocaleString('ko-KR')}ea`)
    .join('\n');
  return `## 현재 KPI
- 오늘 생산량: ${input.kpi.today_production.toLocaleString('ko-KR')}ea
- 시간당 생산량: ${input.kpi.hourly_production.toLocaleString('ko-KR')}ea/hr
- 불량률: ${input.kpi.defect_rate_pct.toFixed(2)}%

## 제조원가
- 재공재고 합계: ${input.cost.wip_total.toLocaleString('ko-KR')}ea
- 총 생산량: ${input.cost.total_production.toLocaleString('ko-KR')}ea
- 제조원가 비율: ${input.cost.cost_ratio_pct.toFixed(2)}% (목표 10.0%)

## 공정별 재공재고
${wipList || '- 현재 재공재고 없음'}`;
}

export function buildClaimResponseContext(claim: {
  client_name: string;
  received_at: string;
  defect_type: string | null;
  quantity: number | null;
  description: string | null;
  lot?: { lot_no: string; inspected: number; defect_count: number; defect_rate_pct: number } | null;
}): string {
  const lotBlock = claim.lot
    ? `## 관련 LOT
- LOT 번호: ${claim.lot.lot_no}
- 검사 수량: ${claim.lot.inspected.toLocaleString('ko-KR')}ea
- 불량 수량: ${claim.lot.defect_count.toLocaleString('ko-KR')}ea
- 불량률: ${claim.lot.defect_rate_pct.toFixed(2)}%`
    : '## 관련 LOT\n- 연결된 LOT 없음';
  return `## 클레임 정보
- 납품처: ${claim.client_name}
- 접수일시: ${new Date(claim.received_at).toLocaleString('ko-KR')}
- 불량 유형: ${claim.defect_type ?? '미지정'}
- 수량: ${claim.quantity ?? '미지정'}
- 설명: ${claim.description ?? '(없음)'}

${lotBlock}`;
}
```

- [ ] **Step 5.2: index.ts**

Create `supabase/functions/llm-analyze/index.ts`:
```ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SYSTEM_PROMPTS, buildCostImprovementContext, buildClaimResponseContext } from './prompts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
}

async function callClaude(system: string, userMessage: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    // Mock 응답 — 운영자가 API 키를 아직 넣지 않은 경우
    return `(MOCK — ANTHROPIC_API_KEY 가 설정되지 않아 샘플 응답을 반환합니다)

### 현재 상황 진단
- 입력 컨텍스트 길이: ${userMessage.length}자
- 실제 연동 시 Claude sonnet-4-6 또는 claude-opus-4-7 에서 한국어 응답을 생성합니다.

### 개선 과제 (예시)
1. 재공재고 관리 강화
2. 불량률 모니터링 대시보드 고도화
3. 공정 간 물류 타임 단축

### 실행 아이템
- 품질팀: 금일부터 재공재고 4시간 주기 집계
- 생산팀: 내포장 공정 배치 간격 20% 축소 검토
- 엔지니어링: 자동화 장비 가동률 일일 보고`;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`anthropic_${res.status}: ${err.slice(0, 200)}`);
  }
  const body = await res.json();
  const text = (body.content?.[0]?.text ?? '') as string;
  return text;
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'missing_auth' }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: user } = await userClient.auth.getUser();
  if (!user.user) return json({ error: 'unauthorized' }, 401);

  let payload: { type?: string; context?: unknown; claim_id?: string };
  try { payload = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (payload.type === 'cost_improvement') {
      // 최신 KPI 컨텍스트 직접 조회 (클라이언트 신뢰 대신)
      const [{ data: kpi }, { data: cost }, { data: wip }] = await Promise.all([
        admin.from('v_daily_kpi').select('*').maybeSingle(),
        admin.from('v_cost_ratio').select('*').maybeSingle(),
        admin.from('v_wip_flow').select('*'),
      ]);
      const ctx = buildCostImprovementContext({
        kpi: kpi as never, cost: cost as never,
        wip: (wip ?? []) as never,
      });
      const text = await callClaude(SYSTEM_PROMPTS.cost_improvement, ctx);
      return json({ ok: true, text, model: ANTHROPIC_API_KEY ? 'claude-sonnet-4-6' : 'mock' });
    }
    if (payload.type === 'claim_response') {
      if (!payload.claim_id) return json({ error: 'missing_claim_id' }, 400);
      const { data: claimRow } = await admin
        .from('claims')
        .select('*, clients(name), lot_id')
        .eq('id', payload.claim_id).maybeSingle();
      if (!claimRow) return json({ error: 'claim_not_found' }, 404);
      const { data: lotRow } = claimRow.lot_id
        ? await admin.from('v_lot_summary').select('lot_no, inspected, defect_count, defect_rate_pct')
            .eq('id', claimRow.lot_id).maybeSingle()
        : { data: null };
      const ctx = buildClaimResponseContext({
        client_name: (claimRow.clients as { name: string } | null)?.name ?? '납품처',
        received_at: claimRow.received_at,
        defect_type: claimRow.defect_type,
        quantity: claimRow.quantity,
        description: claimRow.description,
        lot: lotRow as never,
      });
      const text = await callClaude(SYSTEM_PROMPTS.claim_response, ctx);
      return json({ ok: true, text, model: ANTHROPIC_API_KEY ? 'claude-sonnet-4-6' : 'mock' });
    }
    return json({ error: 'unknown_type' }, 400);
  } catch (e) {
    return json({ error: 'llm_error', message: (e as Error).message }, 500);
  }
});
```

- [ ] **Step 5.3: config.toml**

Add/confirm:
```toml
[functions.llm-analyze]
enabled = true
verify_jwt = true
```

- [ ] **Step 5.4: 통합 테스트 (mock 모드)**

Create `tests/llm-analyze.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const LLM_URL = `${URL}/functions/v1/llm-analyze`;
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE);

async function createAndSignIn(): Promise<string> {
  const email = `llm-test-${Date.now()}@example.com`;
  await admin.auth.admin.createUser({ email, password: 'pw-llm-test', email_confirm: true });
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'pw-llm-test' }),
  });
  const b = await res.json();
  return b.access_token;
}

describe('llm-analyze', () => {
  let jwt: string;
  beforeAll(async () => { jwt = await createAndSignIn(); });

  it('rejects missing auth', async () => {
    const r = await fetch(LLM_URL, { method: 'POST', body: '{}' });
    expect(r.status).toBe(401);
  });

  it('returns text for cost_improvement (mock or real)', async () => {
    const r = await fetch(LLM_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cost_improvement' }),
    });
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.ok).toBe(true);
    expect(typeof b.text).toBe('string');
    expect(b.text.length).toBeGreaterThan(10);
  });

  it('handles unknown type with 400', async () => {
    const r = await fetch(LLM_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'nope' }),
    });
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 5.5: 검증 + 커밋**

```bash
supabase stop && supabase start   # 새 함수 반영
pnpm test:integration              # 12 + 3 = 15 tests green (mock)
git add -A
git commit -m "feat(edge): add llm-analyze function with Claude API and cost/claim prompts"
```

---

## Task 6: ResponseModal + 프론트 LLM 버튼 연결

**Files:**
- Create: `src/components/common/ResponseModal.tsx`, `src/hooks/useLlmAnalyze.ts`
- Modify: `src/pages/CostPage.tsx`, `src/pages/admin/ClaimPage.tsx`

- [ ] **Step 6.1: ResponseModal**

Create `src/components/common/ResponseModal.tsx`:
```tsx
import { Modal } from './Modal';
import { Button } from './Button';

export function ResponseModal({
  open, onClose, title, text, loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={<Button onClick={onClose}>닫기</Button>}
    >
      {loading ? (
        <div className="text-text-dim text-sm">응답 생성 중… (10~30초 소요)</div>
      ) : (
        <pre className="whitespace-pre-wrap text-xs text-text font-sans leading-relaxed max-h-[60vh] overflow-auto">
          {text}
        </pre>
      )}
    </Modal>
  );
}
```

- [ ] **Step 6.2: useLlmAnalyze**

Create `src/hooks/useLlmAnalyze.ts`:
```ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface LlmResponse { ok: boolean; text: string; model: string }

export function useCostImprovement() {
  return useMutation<LlmResponse, Error, void>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('llm-analyze', {
        body: { type: 'cost_improvement' },
      });
      if (error) throw error;
      return data as LlmResponse;
    },
  });
}

export function useClaimResponse() {
  return useMutation<LlmResponse, Error, { claim_id: string }>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('llm-analyze', {
        body: { type: 'claim_response', claim_id: input.claim_id },
      });
      if (error) throw error;
      return data as LlmResponse;
    },
  });
}
```

- [ ] **Step 6.3: CostPage 버튼 연결**

Read `src/pages/CostPage.tsx`. Replace the "제조원가 개선 방안 분석 요청" button:
```tsx
<Button
  variant="secondary"
  onClick={async () => {
    setLlmOpen(true);
    setLlmText('');
    try {
      const r = await llmMut.mutateAsync();
      setLlmText(r.text);
    } catch (e) {
      setLlmText(`실패: ${(e as Error).message}`);
    }
  }}
  disabled={llmMut.isPending}
>
  {llmMut.isPending ? '분석 중…' : '제조원가 개선 방안 분석 요청'}
</Button>

<ResponseModal
  open={llmOpen}
  onClose={() => setLlmOpen(false)}
  title="제조원가 개선 방안 분석"
  text={llmText}
  loading={llmMut.isPending}
/>
```

Add imports:
```tsx
import { useState } from 'react';
import { Button } from '../components/common/Button';
import { ResponseModal } from '../components/common/ResponseModal';
import { useCostImprovement } from '../hooks/useLlmAnalyze';
```

State:
```tsx
const [llmOpen, setLlmOpen] = useState(false);
const [llmText, setLlmText] = useState('');
const llmMut = useCostImprovement();
```

Remove the placeholder `<button onClick={() => alert(...)}`.

- [ ] **Step 6.4: ClaimPage — 클레임 대응 보고서 버튼**

Read `src/pages/admin/ClaimPage.tsx`. Add a "대응문 생성" 버튼 per row in the 작업 column (또는 상세 패널이 있다면 거기에).

Table column `actions`:
```tsx
<Button variant="secondary" onClick={async () => { /* call llm, show modal */ }}>
  대응문
</Button>
```

State and hook wiring identical to CostPage but calling `useClaimResponse({ claim_id: r.id })`.

- [ ] **Step 6.5: 검증 + 커밋**

`pnpm dev` → 제조원가 탭 → 버튼 → 모달에 (mock 또는 실제) 응답 표시. 클레임 탭에서도 동일.

```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(llm): wire cost improvement and claim response UI with ResponseModal"
```

---

## Task 7: 장비 오프라인 감지 (pg_cron)

**Files:**
- Create: `supabase/migrations/20260424000008_device_offline_cron.sql`
- Create: `supabase/tests/13_device_offline.sql`

- [ ] **Step 7.1: 마이그레이션**

Create `supabase/migrations/20260424000008_device_offline_cron.sql`:
```sql
create extension if not exists pg_cron;

-- 오프라인 감지 함수: last_seen_at이 2분 이상 공백인 active 장비에 대해 알람 생성
create or replace function fn_check_device_offline() returns void
language plpgsql security definer set search_path = public as $$
declare
  d record;
begin
  for d in
    select id, code, name, last_seen_at
      from devices
     where active
       and (last_seen_at is null or last_seen_at < now() - interval '2 minutes')
  loop
    -- 같은 device에 30분 내 오프라인 알람이 없을 때만 추가
    if not exists (
      select 1 from alarms
       where source = 'system'
         and device_id = d.id
         and metadata->>'kind' = 'device_offline'
         and created_at > now() - interval '30 minutes'
    ) then
      insert into alarms (severity, source, device_id, message, metadata)
      values (
        'warning', 'system', d.id,
        format('장비 %s (%s) 2분 이상 수신 없음', d.name, d.code),
        jsonb_build_object(
          'kind', 'device_offline',
          'last_seen_at', d.last_seen_at
        )
      );
    end if;
  end loop;
end; $$;

-- pg_cron 스케줄: 매 1분 실행
-- 기존 동명 job이 있으면 한 번 취소
select cron.unschedule('device-offline-check') where exists (
  select 1 from cron.job where jobname = 'device-offline-check'
);
select cron.schedule('device-offline-check', '*/1 * * * *', $$select fn_check_device_offline();$$);
```

- [ ] **Step 7.2: pgTAP 테스트**

Create `supabase/tests/13_device_offline.sql`:
```sql
begin;
select plan(2);

select has_function('fn_check_device_offline');

-- 오프라인 장비 시나리오: last_seen_at 5분 전 + active
insert into devices (code, name, type, process_order, api_key_hash, last_seen_at)
values ('offline_test', 'offline test', 'equipment', 99, 'h', now() - interval '5 minutes')
returning id \gset off_

select fn_check_device_offline();

select ok(
  (select count(*) from alarms where source='system' and device_id = :'off_id') >= 1,
  'offline alarm created'
);

select * from finish();
rollback;
```

- [ ] **Step 7.3: 검증**

```bash
supabase db reset
supabase test db                 # 54 + 2 = 56 tests green

# pg_cron은 supabase local에서 1분 주기로 실제 실행되므로,
# 2분 대기 후 alarms 테이블에 system 알람 생성 확인:
sleep 120
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "select severity, source, message from alarms where source='system' order by created_at desc limit 5;"
```

- [ ] **Step 7.4: 커밋**

```bash
git add -A
git commit -m "feat(alarm): schedule pg_cron device offline detection every minute"
```

---

## Task 8: Playwright E2E 테스트 설정

**Files:**
- Create: `playwright.config.ts`, `e2e/login.spec.ts`, `e2e/kpi-render.spec.ts`, `e2e/alarm-toast.spec.ts`
- Modify: `package.json` (scripts)
- Modify: `.gitignore` (test-results already ignored)

- [ ] **Step 8.1: 설치**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 8.2: config**

Create `playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
```

- [ ] **Step 8.3: e2e/login.spec.ts**

Create `e2e/login.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';

test('login → redirects to /kpi', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/kpi/);
  await expect(page.getByText('실시간 KPI', { exact: false })).toBeVisible();
});

test('wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill('wrongpass');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByText(/Invalid/i)).toBeVisible();
});
```

- [ ] **Step 8.4: e2e/kpi-render.spec.ts**

Create `e2e/kpi-render.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/kpi/);
});

test('KPI page renders 6 cards with formulas', async ({ page }) => {
  await expect(page.getByText('오늘 생산량')).toBeVisible();
  await expect(page.getByText('시간당 생산량')).toBeVisible();
  await expect(page.getByText('불량률')).toBeVisible();
  await expect(page.getByText('제조원가 비율')).toBeVisible();
  await expect(page.getByText('고객 클레임')).toBeVisible();

  const formulas = page.getByText(/산출식:/);
  await expect(formulas.first()).toBeVisible();
});

test('tab navigation works', async ({ page }) => {
  await page.getByRole('link', { name: 'AI 성능지표' }).click();
  await expect(page).toHaveURL(/\/ai/);
  await page.getByRole('link', { name: '제조원가' }).click();
  await expect(page).toHaveURL(/\/cost/);
  await page.getByRole('link', { name: 'LOT 이력' }).click();
  await expect(page).toHaveURL(/\/lot/);
});
```

- [ ] **Step 8.5: e2e/alarm-toast.spec.ts**

Create `e2e/alarm-toast.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const URL = 'http://127.0.0.1:54321';

test('threshold-crossing metric triggers toast', async ({ page }) => {
  // 0) 로그인
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/kpi/);

  // 1) 기존 auto 알람 클리어
  const admin = createClient(URL, SERVICE);
  await admin.from('alarms').delete().eq('source', 'auto');

  // 2) 30초 창에서 dedup 회피 위해 bucket_at을 고유 값으로
  const { data: device } = await admin.from('devices').select('id').eq('code', 'vision_01').single();
  await admin.from('vision_inspector_metrics').insert({
    device_id: device!.id,
    bucket_at: new Date().toISOString(),
    total_inspected: 100, good_count: 50,
    defect_count: 45, unknown_count: 5, inspection_time_seconds: 60,
  });

  // 3) 토스트 표시 기다림 (sonner)
  await expect(page.getByText(/불량률.*목표.*초과/)).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 8.6: package.json scripts**

Add:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 8.7: E2E admin 계정 준비 스크립트**

E2E 실행 전 admin 계정이 있어야 함. `scripts/seed-admin.sh` (또는 README에 커맨드):
```bash
SERVICE=$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)
# idempotent: 실패해도 무시
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" \
  -d '{"email":"admin@ongi.kr","password":"ongi1234","email_confirm":true,"user_metadata":{"full_name":"관리자"}}' > /dev/null || true
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "update profiles set role='admin' where id=(select id from auth.users where email='admin@ongi.kr');"
```

- [ ] **Step 8.8: 실행**

```bash
# 1. Supabase 기동
supabase start
supabase db reset
pnpm db:mock
bash scripts/seed-admin.sh

# 2. E2E
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)
pnpm test:e2e
```

Expected: 4 tests pass (login × 2 + KPI render + navigation + alarm toast — 실제로는 spec 파일 기준 5 tests).

- [ ] **Step 8.9: 커밋**

```bash
git add -A
git commit -m "test(e2e): add Playwright config and 3 spec files (login/kpi/alarm)"
```

---

## Task 9: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 9.1: ci.yml**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  static:
    name: lint / typecheck / build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
        env:
          VITE_SUPABASE_URL: http://placeholder.test
          VITE_SUPABASE_ANON_KEY: placeholder

  supabase-tests:
    name: pgTAP + integration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: pnpm install --frozen-lockfile
      - run: supabase start
      - run: supabase test db
      - run: |
          export SUPABASE_ANON_KEY=$(supabase status -o env | grep '^ANON_KEY=' | cut -d'"' -f2)
          export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)
          pnpm test:integration
```

Note: pg_cron + pgcrypto extensions must be available on the GitHub Actions supabase container. `supabase/setup-cli@v1` uses the standard image which includes both.

- [ ] **Step 9.2: 커밋**

```bash
git add -A
git commit -m "ci: add GitHub Actions workflow for lint/test/build and Supabase tests"
```

---

## Task 10: DEPLOYMENT.md + OPERATIONS.md

**Files:**
- Create: `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`

- [ ] **Step 10.1: DEPLOYMENT.md**

Create `docs/DEPLOYMENT.md` documenting:
- Supabase 클라우드 프로젝트 생성
- `supabase link --project-ref <ref>`
- `supabase db push` (마이그레이션 적용)
- `supabase functions deploy ingest invite-user generate-pdf llm-analyze`
- `supabase secrets set ANTHROPIC_API_KEY=...`
- 폰트 업로드 (`bash scripts/upload-fonts.sh` — 로컬용, 클라우드용 변형 추가)
- Vercel 배포 단계 (GitHub 연결, 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정)
- 초기 admin 계정 생성 (Supabase Studio)
- 장비 등록·API 키 발급 절차
- 장비 담당자에게 공유할 API 계약서 링크

(전체 내용은 약 200줄, 구체 커맨드·이미지 placeholder 포함.)

- [ ] **Step 10.2: OPERATIONS.md**

Create `docs/OPERATIONS.md`:
- 일일 체크리스트 (admin)
- 장비 오프라인 대응
- API 키 로테이션 주기 (권장: 분기 1회)
- 클레임 처리 플로우
- 백업 (Supabase 자동 백업 + 주요 테이블 pg_dump 스크립트)
- 알람 규칙 튜닝 가이드
- LLM 비용 관리 (Anthropic console, max_tokens 조절)

- [ ] **Step 10.3: 커밋**

```bash
git add -A
git commit -m "docs: add DEPLOYMENT and OPERATIONS guides"
```

---

## Task 11: README 최종화 + Phase 4 섹션

- [ ] **Step 11.1: README 업데이트**

Add after Phase 3 section:
```markdown
**Phase 4 범위:** PDF 리포트(LOT 성적서), LLM 분석(제조원가·클레임 대응), 장비 오프라인 자동 감지, bcrypt API 키, E2E 테스트, GitHub Actions CI, 배포·운영 문서.
```

And add new sections:
- "## 배포" → `docs/DEPLOYMENT.md` 링크
- "## 운영" → `docs/OPERATIONS.md` 링크
- "## E2E 테스트" → `pnpm test:e2e` 명령과 전제 조건

- [ ] **Step 11.2: 커밋**

```bash
git add README.md
git commit -m "docs: finalize README with Phase 4 scope, deployment and E2E links"
```

---

## Task 12: Phase 4 회귀 + 태그

- [ ] **Step 12.1: 전체 회귀**

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test                              # 11 unit tests

supabase stop
supabase start
supabase db reset                      # 27+ migrations
supabase test db                       # 56+ pgTAP tests
pnpm db:mock
bash scripts/upload-fonts.sh
bash scripts/seed-admin.sh

pnpm types:gen
git status --short                     # diff? → commit
```

통합 테스트:
```bash
export SUPABASE_ANON_KEY=$(supabase status -o env | grep '^ANON_KEY=' | cut -d'"' -f2)
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)
pnpm test:integration                  # 12 + 3 = 15 tests
pnpm test:e2e                          # 5 tests
```

- [ ] **Step 12.2: 수동 플로우 체크**

`pnpm dev` + `supabase functions serve` → 로그인 → 확인:
- `/cost` → 분석 요청 버튼 → 응답 모달
- `/lot` → LOT 상세 → PDF 출력 → 새 탭에 PDF 열림 (한글 렌더 OK)
- `/admin/devices` → 신규 장비 → 키 발급 → /ingest 실제 호출해도 인증 통과
- 오프라인 테스트: `packaging_01`의 last_seen_at을 수동으로 과거로 세팅 → 1분 내 system 알람 생성 확인

- [ ] **Step 12.3: 태그**

```bash
git tag phase-4-complete
git log --oneline | head -30
git tag --list
```

main 머지는 사용자 판단 (PR 또는 직접).

---

## Phase 4 완료 체크리스트

- [x] `pnpm lint && typecheck && build && test` 그린
- [x] `supabase db reset && supabase test db` 그린 (~56 tests)
- [x] `pnpm test:integration` 그린 (~15 tests)
- [x] `pnpm test:e2e` 그린 (~5 tests)
- [x] LOT PDF 출력 작동 (한글 포함 렌더링)
- [x] LLM 분석 버튼 작동 (mock 또는 실제)
- [x] 장비 오프라인 감지 작동
- [x] GitHub Actions CI 파일 존재
- [x] DEPLOYMENT.md, OPERATIONS.md 작성
- [x] `phase-4-complete` 태그

**다음 단계:** 실제 Supabase 클라우드 프로젝트 연결 + 배포. (본 Phase 범위 밖, 사용자 수동 진행)
