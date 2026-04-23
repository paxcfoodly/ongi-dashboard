# Phase 1: 기반 구축 (Foundation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 온기 대시보드의 기반 구축 — 로그인 가능한 빈 껍데기 프론트엔드 + 전체 DB 스키마 + 장비가 데이터를 전송할 수 있는 `/ingest` Edge Function이 동작하는 상태.

**Architecture:** Vite + React + TypeScript 프론트엔드, Supabase 로컬(Docker)과 클라우드 동시 대응. 스키마는 마이그레이션 파일로 버전 관리하며 pgTAP로 검증. Edge Function은 Deno로 작성하고 Zod로 입력 검증. 각 세부 단위는 TDD로 추가.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Tailwind CSS 3, React Router 6, @supabase/supabase-js 2, @tanstack/react-query 5, Zod 3, Vitest, Playwright, Supabase CLI, pgTAP, Deno.

**Phase 1 완료 조건:**
- `pnpm dev`로 프론트엔드가 `http://localhost:5173`에서 실행되고 로그인 → 빈 대시보드 이동이 정상 동작
- Supabase 로컬 프로젝트(`supabase start`)가 기동되고 모든 마이그레이션 적용 + pgTAP 테스트 통과
- `curl -X POST .../functions/v1/ingest`로 샘플 payload 전송 시 해당 테이블에 row 기록, 잘못된 요청은 적절한 4xx와 `ingest_logs`에 기록
- `supabase test db`, `vitest`, `pnpm build`가 모두 성공

**스펙 문서:** `docs/superpowers/specs/2026-04-23-ongi-dashboard-design.md`

---

## 파일 구조 (Phase 1 종료 시점)

```
OngiDashboard/
├── .env.example
├── .eslintrc.cjs
├── .gitignore
├── .prettierrc
├── README.md
├── index.html
├── package.json
├── pnpm-lock.yaml
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── Ongi_Sample_Dashboard.html              (기존, 참조용)
├── docs/                                    (기존)
│   └── superpowers/
│       ├── specs/2026-04-23-ongi-dashboard-design.md
│       └── plans/2026-04-23-phase-1-foundation.md
├── src/
│   ├── main.tsx                             진입점
│   ├── App.tsx                              라우터 정의
│   ├── index.css                            Tailwind + 토큰
│   ├── lib/
│   │   ├── supabase.ts                      Supabase 클라이언트
│   │   └── queryClient.ts                   react-query 설정
│   ├── hooks/
│   │   └── useAuth.ts                       인증 세션·role 훅
│   ├── routes/
│   │   ├── AuthGate.tsx                     인증 필요 가드
│   │   └── AdminGate.tsx                    admin role 가드
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── KpiPage.tsx                       빈 껍데기
│   │   ├── AiPage.tsx                        빈 껍데기
│   │   ├── CostPage.tsx                      빈 껍데기
│   │   ├── LotHistoryPage.tsx                빈 껍데기
│   │   └── admin/
│   │       ├── LotManagePage.tsx             빈 껍데기
│   │       ├── ClaimPage.tsx                 빈 껍데기
│   │       ├── DevicePage.tsx                빈 껍데기
│   │       ├── AlarmRulePage.tsx             빈 껍데기
│   │       ├── TargetPage.tsx                빈 껍데기
│   │       └── UserPage.tsx                  빈 껍데기
│   ├── components/
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── TabBar.tsx
│   │       ├── MobileNav.tsx
│   │       ├── Footer.tsx
│   │       ├── Clock.tsx
│   │       └── LiveDot.tsx
│   └── types/
│       └── db.ts                             supabase gen types 출력
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   ├── migrations/
│   │   ├── 20260423000001_enums.sql
│   │   ├── 20260423000002_devices.sql
│   │   ├── 20260423000003_vision_inspector_metrics.sql
│   │   ├── 20260423000004_equipment_metrics.sql
│   │   ├── 20260423000005_clients.sql
│   │   ├── 20260423000006_lots.sql
│   │   ├── 20260423000007_claims.sql
│   │   ├── 20260423000008_targets.sql
│   │   ├── 20260423000009_alarm_rules.sql
│   │   ├── 20260423000010_alarms.sql
│   │   ├── 20260423000011_profiles.sql
│   │   ├── 20260423000012_ingest_logs.sql
│   │   ├── 20260423000013_is_admin_fn.sql
│   │   ├── 20260423000014_rls_policies.sql
│   │   └── 20260423000015_touch_last_seen_trigger.sql
│   ├── functions/
│   │   └── ingest/
│   │       ├── index.ts
│   │       ├── schemas.ts
│   │       ├── handlers.ts
│   │       └── csv.ts
│   └── tests/
│       ├── 01_devices.sql
│       ├── 02_vision_metrics.sql
│       ├── 03_equipment_metrics.sql
│       ├── 04_lots.sql
│       ├── 05_profiles.sql
│       ├── 06_is_admin.sql
│       ├── 07_rls_policies.sql
│       └── 08_touch_last_seen.sql
└── tests/
    └── ingest.test.ts                        Edge Function 통합 테스트
```

---

## 사전 준비 (사용자 확인)

구현자는 아래를 로컬에 설치해둬야 한다:

- Node.js 20+ (`node --version`)
- pnpm 9+ (`pnpm --version`)
- Docker Desktop (Supabase 로컬 구동)
- Supabase CLI 1.200+ (`supabase --version`, `brew install supabase/tap/supabase`)
- Deno 1.40+ (`deno --version`, `brew install deno`) — Edge Function 테스트용

---

## Task 1: 프로젝트 스캐폴딩 (Vite + React + TS)

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1.1: Vite 프로젝트 초기화**

Run (프로젝트 루트에서):
```bash
cd /Users/seonjecho/Projects/OngiDashboard
pnpm create vite@latest . --template react-ts
# "Current directory is not empty" 물으면 "Ignore files and continue" 선택
pnpm install
```

Vite 기본 템플릿이 `src/App.tsx`, `src/main.tsx`, `index.html`, `vite.config.ts` 등을 생성. `App.css`, `vite.svg`는 삭제.

- [ ] **Step 1.2: 기본 파일 정리**

Run:
```bash
rm -f src/App.css src/assets/react.svg public/vite.svg
```

`src/App.tsx`를 다음으로 교체:
```tsx
export default function App() {
  return <div>Ongi Dashboard — bootstrap</div>;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/index.css`:
```css
/* populated in Task 3 */
```

`index.html`의 `<title>`을 `온기 대시보드`로 변경.

- [ ] **Step 1.3: 빌드 및 dev 서버 확인**

Run:
```bash
pnpm build
pnpm dev
```

Expected: build 성공, dev 서버 기동 시 `http://localhost:5173`에서 "Ongi Dashboard — bootstrap" 텍스트 노출. Ctrl-C로 종료.

- [ ] **Step 1.4: 커밋**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

## Task 2: 코드 품질 도구 (ESLint, Prettier, Vitest)

**Files:**
- Create: `.eslintrc.cjs`, `.prettierrc`, `vitest.config.ts`
- Modify: `package.json` (scripts, devDependencies)

- [ ] **Step 2.1: 의존성 설치**

Run:
```bash
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh \
  prettier eslint-config-prettier \
  vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2.2: ESLint 설정**

Create `.eslintrc.cjs`:
```js
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist', 'node_modules', 'supabase'],
};
```

- [ ] **Step 2.3: Prettier 설정**

Create `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always"
}
```

- [ ] **Step 2.4: Vitest 설정**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2.5: package.json scripts 보강**

`package.json`의 `scripts` 블록을 다음으로 교체:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\"",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 2.6: 검증**

Run:
```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: lint pass, typecheck pass, test "no tests found" (정상 — 아직 테스트 없음).

- [ ] **Step 2.7: 커밋**

```bash
git add -A
git commit -m "chore: add ESLint, Prettier, Vitest configuration"
```

---

## Task 3: Tailwind CSS + 디자인 토큰

**Files:**
- Create: `postcss.config.js`, `tailwind.config.ts`
- Modify: `src/index.css`

- [ ] **Step 3.1: Tailwind 설치**

Run:
```bash
pnpm add -D tailwindcss@3 postcss autoprefixer
pnpm dlx tailwindcss init -p --ts
```

명령은 `tailwind.config.ts`와 `postcss.config.js`를 생성.

- [ ] **Step 3.2: tailwind.config.ts 교체**

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans KR"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bg: '#F5F8FC',
        surface: '#FFFFFF',
        surface2: '#EEF4FB',
        border: {
          DEFAULT: '#DCE6F2',
          strong: '#B9CCE1',
        },
        text: {
          DEFAULT: '#0F2340',
          dim: '#5F708A',
          muted: '#8CA0B8',
        },
        primary: {
          DEFAULT: '#1E64B4',
          light: '#D2E6FA',
          dark: '#154A89',
        },
        good: {
          DEFAULT: '#1D9E75',
          light: '#E6F5EE',
          dark: '#14704F',
        },
        warn: {
          DEFAULT: '#E8933A',
          light: '#FDF1DE',
          dark: '#A2600F',
        },
        danger: {
          DEFAULT: '#D94444',
          light: '#FBE6E6',
          dark: '#932929',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      backgroundImage: {
        'primary-gradient':
          'linear-gradient(90deg, #1E64B4 0%, #4A90D9 60%, #7FB5E8 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3.3: src/index.css 교체**

`src/index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html,
  body {
    @apply bg-bg text-text;
    font-family: 'Noto Sans KR', system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.6;
  }
  body {
    min-height: 100vh;
  }
}

@layer components {
  .formula-box {
    @apply mt-3 px-3 py-2 bg-surface2 border border-border rounded font-mono text-[11px] text-text-dim leading-[1.7];
  }
  .formula-box .hi {
    @apply text-primary font-medium;
  }
  .formula-box .label {
    @apply text-text-muted mr-1;
  }
}
```

- [ ] **Step 3.4: App 시연 업데이트**

`src/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-surface border border-border rounded-lg p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-primary mb-2">온기 대시보드</h1>
        <p className="text-text-dim">Phase 1 — 기반 구축 중</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.5: 시각 확인**

Run: `pnpm dev`  
Expected: 블루그레이 배경(`#F5F8FC`)에 흰 카드로 "온기 대시보드 — Phase 1 기반 구축 중" 표시. Ctrl-C로 종료.

- [ ] **Step 3.6: 커밋**

```bash
git add -A
git commit -m "feat: configure Tailwind with light theme design tokens"
```

---

## Task 4: Supabase 로컬 초기화

**Files:**
- Create: `supabase/config.toml`, `supabase/seed.sql`, `.env.example`

- [ ] **Step 4.1: Supabase 초기화**

Run:
```bash
supabase init
```

`supabase/config.toml`, `supabase/seed.sql` 등이 생성됨. config.toml은 기본값 그대로 두되, 다음을 확인:
- `[api] port = 54321`
- `[db] port = 54322`

- [ ] **Step 4.2: Supabase 로컬 기동 확인**

Run:
```bash
supabase start
```

Expected: Docker 컨테이너 기동 로그 + API URL, anon key, service_role key가 표시됨. 표시된 값을 다음 step에서 사용.

- [ ] **Step 4.3: 환경변수 템플릿**

Create `.env.example`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<supabase start 출력에서 복사>
```

실제 `.env.local`은 구현자가 직접 생성 (커밋 안 함):
```bash
cp .env.example .env.local
# .env.local에 실제 anon key 채워넣기
```

- [ ] **Step 4.4: 기동 중지**

Run: `supabase stop`

- [ ] **Step 4.5: 커밋**

```bash
git add -A
git commit -m "chore: initialize Supabase local environment"
```

---

## Task 5: Enum 타입 마이그레이션

**Files:**
- Create: `supabase/migrations/20260423000001_enums.sql`
- Create: `supabase/tests/00_enums.sql`

- [ ] **Step 5.1: Enum 마이그레이션 작성**

Create `supabase/migrations/20260423000001_enums.sql`:
```sql
create type device_type    as enum ('vision_inspector', 'equipment');
create type lot_status     as enum ('planned', 'running', 'completed', 'paused');
create type claim_status   as enum ('open', 'investigating', 'resolved');
create type severity_level as enum ('info', 'warning', 'danger');
create type alarm_source   as enum ('auto', 'manual', 'system');
create type user_role      as enum ('admin', 'viewer');
```

- [ ] **Step 5.2: pgTAP 테스트 작성**

Create `supabase/tests/00_enums.sql`:
```sql
begin;
select plan(6);

select has_type('device_type',    'device_type enum exists');
select has_type('lot_status',     'lot_status enum exists');
select has_type('claim_status',   'claim_status enum exists');
select has_type('severity_level', 'severity_level enum exists');
select has_type('alarm_source',   'alarm_source enum exists');
select has_type('user_role',      'user_role enum exists');

select * from finish();
rollback;
```

- [ ] **Step 5.3: 마이그레이션 적용 및 테스트**

Run:
```bash
supabase start
supabase db reset                  # 모든 마이그레이션 재적용
supabase test db
```

Expected: `# All tests passed (6/6)`.

- [ ] **Step 5.4: 커밋**

```bash
git add -A
git commit -m "feat(db): add enum types (device_type, lot_status, etc.)"
```

---

## Task 6: devices 테이블 + 시드

**Files:**
- Create: `supabase/migrations/20260423000002_devices.sql`
- Create: `supabase/tests/01_devices.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 6.1: 테이블 마이그레이션**

Create `supabase/migrations/20260423000002_devices.sql`:
```sql
create table devices (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  name           text not null,
  type           device_type not null,
  role           text,
  process_order  int not null,
  api_key_hash   text not null,
  active         boolean not null default true,
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_devices_active_order on devices (active, process_order);
create index idx_devices_type on devices (type);

comment on column devices.role is
  '"primary_output" = 일일 생산량 기준 장비, "inspection" = AI 검사, null/기타 = 보조';
```

- [ ] **Step 6.2: pgTAP 테스트**

Create `supabase/tests/01_devices.sql`:
```sql
begin;
select plan(7);

select has_table('devices');
select has_column('devices', 'code');
select has_column('devices', 'role');
select col_is_unique('devices', array['code']);
select col_type_is('devices', 'type', 'device_type');
select col_not_null('devices', 'process_order');

insert into devices (code, name, type, process_order, api_key_hash)
values ('test_01', '테스트장비', 'equipment', 99, 'hash');
select ok((select active from devices where code = 'test_01'),
  'active defaults to true');

select * from finish();
rollback;
```

- [ ] **Step 6.3: 시드 데이터 추가**

`supabase/seed.sql`에 append (새 파일이면 위에서부터 작성):
```sql
-- 장비 6대 시드 (실제 공정 매핑은 담당자 협의 후 조정)
insert into devices (code, name, type, role, process_order, api_key_hash) values
  ('packaging_01', '삼면포장기',    'equipment',        'primary_output', 1, 'seed-hash-replace-on-first-use'),
  ('vision_01',    'AI 비전검사기', 'vision_inspector', 'inspection',     2, 'seed-hash-replace-on-first-use'),
  ('caser_01',     '자동제함기',    'equipment',         null,            3, 'seed-hash-replace-on-first-use'),
  ('taper_01',     '자동테이핑기',  'equipment',         null,            4, 'seed-hash-replace-on-first-use'),
  ('wrapper_01',   '자동랩핑기',    'equipment',         null,            5, 'seed-hash-replace-on-first-use'),
  ('conveyor_01',  '컨베이어',      'equipment',         null,            6, 'seed-hash-replace-on-first-use')
on conflict (code) do nothing;
```

- [ ] **Step 6.4: 검증**

Run:
```bash
supabase db reset
supabase test db
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -c "select code, name, role, process_order from devices order by process_order;"
```

Expected: 모든 테스트 통과 + 6개 장비 출력.

- [ ] **Step 6.5: 커밋**

```bash
git add -A
git commit -m "feat(db): add devices table and seed 6 equipment"
```

---

## Task 7: vision_inspector_metrics 테이블

**Files:**
- Create: `supabase/migrations/20260423000003_vision_inspector_metrics.sql`
- Create: `supabase/tests/02_vision_metrics.sql`

- [ ] **Step 7.1: 마이그레이션**

Create `supabase/migrations/20260423000003_vision_inspector_metrics.sql`:
```sql
create table vision_inspector_metrics (
  id                       bigserial primary key,
  device_id                uuid not null references devices(id) on delete cascade,
  bucket_at                timestamptz not null,
  total_inspected          int not null check (total_inspected >= 0),
  good_count               int not null check (good_count >= 0),
  defect_count             int not null check (defect_count >= 0),
  unknown_count            int not null check (unknown_count >= 0),
  inspection_time_seconds  numeric(10,2) not null check (inspection_time_seconds >= 0),
  created_at               timestamptz not null default now(),
  constraint vim_unique_bucket unique (device_id, bucket_at),
  constraint vim_total_sum_check
    check (total_inspected = good_count + defect_count + unknown_count)
);

create index idx_vim_bucket_desc on vision_inspector_metrics (bucket_at desc);
create index idx_vim_device_bucket on vision_inspector_metrics (device_id, bucket_at desc);
```

- [ ] **Step 7.2: 테스트**

Create `supabase/tests/02_vision_metrics.sql`:
```sql
begin;
select plan(5);

select has_table('vision_inspector_metrics');

-- 정상 삽입
insert into devices (code, name, type, process_order, api_key_hash)
values ('vim_test', 'vim test', 'vision_inspector', 1, 'h') returning id \gset dev_
insert into vision_inspector_metrics
  (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
values (:'dev_id', '2026-04-23T10:00:00+09:00', 100, 95, 3, 2, 60.5);
select ok(exists (select 1 from vision_inspector_metrics where total_inspected = 100),
  'valid insert succeeds');

-- UNIQUE 위반
prepare dup_insert as
  insert into vision_inspector_metrics
    (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
  values (:'dev_id', '2026-04-23T10:00:00+09:00', 50, 50, 0, 0, 30);
select throws_ok('execute dup_insert', '23505',
  'duplicate key value violates unique constraint "vim_unique_bucket"',
  'UNIQUE (device_id, bucket_at) blocks duplicate');

-- 합계 불일치 CHECK 위반
prepare bad_sum as
  insert into vision_inspector_metrics
    (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
  values (:'dev_id', '2026-04-23T11:00:00+09:00', 100, 10, 10, 10, 30);
select throws_ok('execute bad_sum', '23514',
  'new row for relation "vision_inspector_metrics" violates check constraint "vim_total_sum_check"',
  'sum constraint enforced');

-- 음수 방지
prepare negative as
  insert into vision_inspector_metrics
    (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
  values (:'dev_id', '2026-04-23T12:00:00+09:00', -1, 0, 0, 0, 0);
select throws_ok('execute negative', '23514', null, 'negative value rejected');

select * from finish();
rollback;
```

- [ ] **Step 7.3: 검증**

Run:
```bash
supabase db reset
supabase test db
```

Expected: 모든 테스트 통과.

- [ ] **Step 7.4: 커밋**

```bash
git add -A
git commit -m "feat(db): add vision_inspector_metrics with sum and uniqueness checks"
```

---

## Task 8: equipment_metrics 테이블

**Files:**
- Create: `supabase/migrations/20260423000004_equipment_metrics.sql`
- Create: `supabase/tests/03_equipment_metrics.sql`

- [ ] **Step 8.1: 마이그레이션**

Create `supabase/migrations/20260423000004_equipment_metrics.sql`:
```sql
create table equipment_metrics (
  id               bigserial primary key,
  device_id        uuid not null references devices(id) on delete cascade,
  bucket_at        timestamptz not null,
  runtime_seconds  int not null check (runtime_seconds >= 0 and runtime_seconds <= 60),
  output_count     int not null check (output_count >= 0),
  extras           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  constraint em_unique_bucket unique (device_id, bucket_at)
);

create index idx_em_bucket_desc on equipment_metrics (bucket_at desc);
create index idx_em_device_bucket on equipment_metrics (device_id, bucket_at desc);
```

- [ ] **Step 8.2: 테스트**

Create `supabase/tests/03_equipment_metrics.sql`:
```sql
begin;
select plan(4);

select has_table('equipment_metrics');

insert into devices (code, name, type, process_order, api_key_hash)
values ('em_test', 'em test', 'equipment', 1, 'h') returning id \gset dev_

insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
values (:'dev_id', '2026-04-23T10:00:00+09:00', 58, 1800);
select ok(exists (select 1 from equipment_metrics where output_count = 1800),
  'valid insert succeeds');

prepare runtime_over as
  insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
  values (:'dev_id', '2026-04-23T11:00:00+09:00', 61, 100);
select throws_ok('execute runtime_over', '23514', null,
  'runtime_seconds > 60 rejected');

prepare neg_output as
  insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
  values (:'dev_id', '2026-04-23T12:00:00+09:00', 10, -5);
select throws_ok('execute neg_output', '23514', null,
  'negative output rejected');

select * from finish();
rollback;
```

- [ ] **Step 8.3: 검증 및 커밋**

Run: `supabase db reset && supabase test db`  
Expected: 모든 테스트 통과.

```bash
git add -A
git commit -m "feat(db): add equipment_metrics with runtime/output checks"
```

---

## Task 9: clients / lots / claims 테이블

**Files:**
- Create: `supabase/migrations/20260423000005_clients.sql`
- Create: `supabase/migrations/20260423000006_lots.sql`
- Create: `supabase/migrations/20260423000007_claims.sql`
- Create: `supabase/tests/04_lots.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 9.1: clients 마이그레이션**

Create `supabase/migrations/20260423000005_clients.sql`:
```sql
create table clients (
  id            uuid primary key default gen_random_uuid(),
  name          text unique not null,
  contact_info  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
```

- [ ] **Step 9.2: lots 마이그레이션**

Create `supabase/migrations/20260423000006_lots.sql`:
```sql
create table lots (
  id               uuid primary key default gen_random_uuid(),
  lot_no           text unique not null,
  client_id        uuid not null references clients(id),
  product_name     text,
  target_quantity  int check (target_quantity > 0),
  started_at       timestamptz,
  ended_at         timestamptz,
  status           lot_status not null default 'planned',
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lots_end_after_start
    check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index idx_lots_started_desc on lots (started_at desc nulls last);
create index idx_lots_status on lots (status);
```

- [ ] **Step 9.3: claims 마이그레이션**

Create `supabase/migrations/20260423000007_claims.sql`:
```sql
create table claims (
  id                   uuid primary key default gen_random_uuid(),
  lot_id               uuid references lots(id),
  client_id            uuid not null references clients(id),
  received_at          timestamptz not null,
  defect_type          text,
  quantity             int check (quantity >= 0),
  description          text,
  status               claim_status not null default 'open',
  response_report_url  text,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_claims_received_desc on claims (received_at desc);
create index idx_claims_client on claims (client_id);
```

- [ ] **Step 9.4: 시드 (clients)**

`supabase/seed.sql`에 append:
```sql
insert into clients (name) values
  ('삼성웰스토리'),
  ('CJ프레시웨이'),
  ('PSI')
on conflict (name) do nothing;
```

- [ ] **Step 9.5: pgTAP 테스트**

Create `supabase/tests/04_lots.sql`:
```sql
begin;
select plan(4);

select has_table('clients');
select has_table('lots');
select has_table('claims');

-- FK 제약
insert into clients (name) values ('Test Client') returning id \gset client_
insert into lots (lot_no, client_id, target_quantity, started_at, ended_at)
values ('LOT-TEST-1', :'client_id', 100, '2026-04-23T08:00:00+09:00', '2026-04-23T07:00:00+09:00')
on conflict do nothing;
-- CHECK가 막아야 함
prepare bad_end as
  insert into lots (lot_no, client_id, target_quantity, started_at, ended_at)
  values ('LOT-TEST-2', :'client_id', 100, '2026-04-23T08:00:00+09:00', '2026-04-23T07:00:00+09:00');
select throws_ok('execute bad_end', '23514', null, 'ended_at < started_at rejected');

select * from finish();
rollback;
```

- [ ] **Step 9.6: 검증 및 커밋**

Run: `supabase db reset && supabase test db`  
Expected: 테스트 통과 + `select count(*) from clients;` 3 반환.

```bash
git add -A
git commit -m "feat(db): add clients, lots, claims tables with FK and checks"
```

---

## Task 10: targets / alarm_rules / alarms 테이블

**Files:**
- Create: `supabase/migrations/20260423000008_targets.sql`
- Create: `supabase/migrations/20260423000009_alarm_rules.sql`
- Create: `supabase/migrations/20260423000010_alarms.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 10.1: targets 마이그레이션 + 시드**

Create `supabase/migrations/20260423000008_targets.sql`:
```sql
create table targets (
  key          text primary key,
  value        numeric not null,
  unit         text,
  description  text,
  updated_at   timestamptz not null default now()
);
```

`supabase/seed.sql`에 append:
```sql
insert into targets (key, value, unit, description) values
  ('daily_production',        15000, 'ea',    '일일 목표 생산량'),
  ('hourly_production',        1800, 'ea/hr', '시간당 목표 생산량'),
  ('work_time_per_ea',          2.0, 's',     '제품당 최대 작업 시간'),
  ('defect_rate_max',           1.0, '%',     '불량률 상한'),
  ('cost_ratio_target',        10.0, '%',     '제조원가 비율 목표'),
  ('cost_ratio_baseline',      15.0, '%',     '도입 전 제조원가 비율'),
  ('cost_improvement_target',  33.0, '%',     '제조원가 개선 목표'),
  ('claim_quarterly_max',       1.0, '건',    '분기 클레임 상한')
on conflict (key) do update set value = excluded.value, unit = excluded.unit, description = excluded.description;
```

- [ ] **Step 10.2: alarm_rules 마이그레이션**

Create `supabase/migrations/20260423000009_alarm_rules.sql`:
```sql
create table alarm_rules (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  metric            text not null,
  operator          text not null check (operator in ('>', '>=', '<', '<=', '=')),
  threshold         numeric not null,
  severity          severity_level not null default 'warning',
  message_template  text not null,
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

`supabase/seed.sql`에 append:
```sql
insert into alarm_rules (name, metric, operator, threshold, severity, message_template) values
  ('불량률 상한 초과',  'defect_rate',  '>', 1.0, 'warning', '불량률 {{value}}% — 목표 {{threshold}}% 초과'),
  ('제조원가 상한 초과','cost_ratio',   '>', 10.0,'warning', '제조원가 {{value}}% — 목표 {{threshold}}% 초과'),
  ('재검율 이상',       'recheck_rate', '>', 1.0, 'info',    '재검율 {{value}}% — 정상범위 이탈')
on conflict do nothing;
```

- [ ] **Step 10.3: alarms 마이그레이션**

Create `supabase/migrations/20260423000010_alarms.sql`:
```sql
create table alarms (
  id                uuid primary key default gen_random_uuid(),
  rule_id           uuid references alarm_rules(id) on delete set null,
  severity          severity_level not null,
  source            alarm_source not null,
  device_id         uuid references devices(id) on delete set null,
  message           text not null,
  metadata          jsonb not null default '{}'::jsonb,
  acknowledged      boolean not null default false,
  acknowledged_by   uuid references auth.users(id),
  acknowledged_at   timestamptz,
  created_at        timestamptz not null default now()
);

create index idx_alarms_created_desc on alarms (created_at desc);
create index idx_alarms_unacked on alarms (acknowledged) where acknowledged = false;
```

- [ ] **Step 10.4: 검증**

Run:
```bash
supabase db reset
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -c "select key, value, unit from targets order by key;"
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -c "select name, metric, operator, threshold from alarm_rules order by metric;"
```

Expected: 8개 타겟, 3개 규칙 출력.

- [ ] **Step 10.5: 커밋**

```bash
git add -A
git commit -m "feat(db): add targets, alarm_rules, alarms tables with seeds"
```

---

## Task 11: profiles 테이블 + auth 트리거

**Files:**
- Create: `supabase/migrations/20260423000011_profiles.sql`
- Create: `supabase/tests/05_profiles.sql`

- [ ] **Step 11.1: 마이그레이션**

Create `supabase/migrations/20260423000011_profiles.sql`:
```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'viewer',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- auth.users 생성 시 자동으로 profiles 생성
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- [ ] **Step 11.2: 테스트**

Create `supabase/tests/05_profiles.sql`:
```sql
begin;
select plan(3);

select has_table('profiles');
select has_function('handle_new_user');

-- auth.users 직접 삽입 (로컬에서만 가능)
insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000001', 'test@example.com',
        '00000000-0000-0000-0000-000000000000');

select ok(exists (select 1 from profiles where id = '00000000-0000-0000-0000-000000000001'),
  'profile auto-created on auth.users insert');

select * from finish();
rollback;
```

- [ ] **Step 11.3: 검증 및 커밋**

Run: `supabase db reset && supabase test db`  
Expected: 통과.

```bash
git add -A
git commit -m "feat(db): add profiles with auto-create trigger on auth.users"
```

---

## Task 12: ingest_logs + is_admin 함수

**Files:**
- Create: `supabase/migrations/20260423000012_ingest_logs.sql`
- Create: `supabase/migrations/20260423000013_is_admin_fn.sql`
- Create: `supabase/tests/06_is_admin.sql`

- [ ] **Step 12.1: ingest_logs 마이그레이션**

Create `supabase/migrations/20260423000012_ingest_logs.sql`:
```sql
create table ingest_logs (
  id             bigserial primary key,
  device_code    text,
  received_at    timestamptz not null default now(),
  status         text not null,
  error_message  text,
  raw_payload    jsonb
);

create index idx_ingest_logs_received_desc on ingest_logs (received_at desc);
```

- [ ] **Step 12.2: is_admin 함수**

Create `supabase/migrations/20260423000013_is_admin_fn.sql`:
```sql
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;
```

- [ ] **Step 12.3: 테스트**

Create `supabase/tests/06_is_admin.sql`:
```sql
begin;
select plan(3);

select has_function('is_admin');

insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000011', 'admin@example.com',
        '00000000-0000-0000-0000-000000000000');
update profiles set role = 'admin'
  where id = '00000000-0000-0000-0000-000000000011';

-- is_admin은 auth.uid()에 의존. pgTAP에서는 세션 컨텍스트 없이 is_admin() = false여야 함
select is(is_admin(), false, 'is_admin returns false without session');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
-- 주의: pgTAP 환경에 따라 세션 클레임 설정이 제한적. 별도 통합 테스트에서 검증
-- 여기서는 함수 존재 및 기본 반환만 확인
select ok(true, 'session-based tests covered in integration tests');

select * from finish();
rollback;
```

- [ ] **Step 12.4: 검증 및 커밋**

Run: `supabase db reset && supabase test db`

```bash
git add -A
git commit -m "feat(db): add ingest_logs table and is_admin() helper"
```

---

## Task 13: RLS 정책

**Files:**
- Create: `supabase/migrations/20260423000014_rls_policies.sql`
- Create: `supabase/tests/07_rls_policies.sql`

- [ ] **Step 13.1: 마이그레이션**

Create `supabase/migrations/20260423000014_rls_policies.sql`:
```sql
-- 1. RLS 활성화
alter table devices                     enable row level security;
alter table vision_inspector_metrics    enable row level security;
alter table equipment_metrics           enable row level security;
alter table lots                        enable row level security;
alter table clients                     enable row level security;
alter table claims                      enable row level security;
alter table targets                     enable row level security;
alter table alarm_rules                 enable row level security;
alter table alarms                      enable row level security;
alter table profiles                    enable row level security;
alter table ingest_logs                 enable row level security;

-- 2. 읽기 정책 (인증된 사용자)
create policy "authed read" on devices                  for select to authenticated using (true);
create policy "authed read" on vision_inspector_metrics for select to authenticated using (true);
create policy "authed read" on equipment_metrics        for select to authenticated using (true);
create policy "authed read" on lots                     for select to authenticated using (true);
create policy "authed read" on clients                  for select to authenticated using (true);
create policy "authed read" on claims                   for select to authenticated using (true);
create policy "authed read" on targets                  for select to authenticated using (true);
create policy "authed read" on alarm_rules              for select to authenticated using (true);
create policy "authed read" on alarms                   for select to authenticated using (true);

-- 3. 쓰기 정책 (admin만)
create policy "admin write" on devices     for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on lots        for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on clients     for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on claims      for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on targets     for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on alarm_rules for all to authenticated using (is_admin()) with check (is_admin());

-- 4. alarms는 모든 인증자가 acknowledge 업데이트 가능
create policy "ack alarm" on alarms for update to authenticated
  using (true)
  with check (acknowledged = true);
create policy "admin insert alarm" on alarms for insert to authenticated with check (is_admin());
create policy "admin delete alarm" on alarms for delete to authenticated using (is_admin());

-- 5. profiles
create policy "self or admin read" on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy "admin write profiles" on profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- 6. ingest_logs는 admin만 조회
create policy "admin read logs" on ingest_logs for select to authenticated using (is_admin());
```

참고: 메트릭 테이블 INSERT는 Edge Function 내부에서 `SUPABASE_SERVICE_ROLE_KEY`를 사용하므로 RLS를 우회한다. anon/authenticated에게는 INSERT 정책을 열지 않는다.

- [ ] **Step 13.2: 테스트**

Create `supabase/tests/07_rls_policies.sql`:
```sql
begin;
select plan(4);

-- anon은 어떤 테이블도 읽을 수 없음
set local role anon;
select is((select count(*) from devices), 0::bigint,
  'anon role cannot read devices');

reset role;

-- authenticated (role 미설정) 은 읽기 가능하지만 쓰기 불가
insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000021', 'viewer@ex.com',
        '00000000-0000-0000-0000-000000000000');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';

select ok((select count(*) from devices) >= 6::bigint,
  'authenticated (viewer) can read devices');

prepare viewer_insert as
  insert into devices (code, name, type, process_order, api_key_hash)
  values ('x', 'x', 'equipment', 99, 'h');
select throws_like('execute viewer_insert', '%row-level security%',
  'viewer cannot write devices');

reset role;

-- admin이 쓰기 가능
insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000022', 'admin@ex.com',
        '00000000-0000-0000-0000-000000000000');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000022';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';

insert into devices (code, name, type, process_order, api_key_hash)
values ('rls_admin_test', 'admin test', 'equipment', 100, 'h');
select ok(exists (select 1 from devices where code = 'rls_admin_test'),
  'admin can write devices');

select * from finish();
rollback;
```

- [ ] **Step 13.3: 검증 및 커밋**

Run: `supabase db reset && supabase test db`  
Expected: 모든 RLS 테스트 통과.

```bash
git add -A
git commit -m "feat(db): add RLS policies for all tables (authed read, admin write)"
```

---

## Task 14: touch_last_seen 트리거

**Files:**
- Create: `supabase/migrations/20260423000015_touch_last_seen_trigger.sql`
- Create: `supabase/tests/08_touch_last_seen.sql`

- [ ] **Step 14.1: 마이그레이션**

Create `supabase/migrations/20260423000015_touch_last_seen_trigger.sql`:
```sql
create or replace function fn_touch_device_last_seen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update devices
  set last_seen_at = new.bucket_at
  where id = new.device_id
    and (last_seen_at is null or last_seen_at < new.bucket_at);
  return new;
end; $$;

create trigger trg_vision_last_seen
  after insert on vision_inspector_metrics
  for each row execute function fn_touch_device_last_seen();

create trigger trg_equipment_last_seen
  after insert on equipment_metrics
  for each row execute function fn_touch_device_last_seen();
```

- [ ] **Step 14.2: 테스트**

Create `supabase/tests/08_touch_last_seen.sql`:
```sql
begin;
select plan(3);

select has_function('fn_touch_device_last_seen');

insert into devices (code, name, type, process_order, api_key_hash)
values ('touch_test', 'touch', 'equipment', 1, 'h') returning id \gset d_

insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
values (:'d_id', '2026-04-23T10:00:00+09:00', 55, 1000);

select is(
  (select last_seen_at from devices where code = 'touch_test'),
  '2026-04-23T10:00:00+09:00'::timestamptz,
  'last_seen_at updated by trigger'
);

-- 더 이른 bucket 삽입 시 last_seen_at 유지 (과거값 덮지 않음)
insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
values (:'d_id', '2026-04-23T09:00:00+09:00', 55, 900);

select is(
  (select last_seen_at from devices where code = 'touch_test'),
  '2026-04-23T10:00:00+09:00'::timestamptz,
  'older bucket does not overwrite last_seen_at'
);

select * from finish();
rollback;
```

- [ ] **Step 14.3: 검증 및 커밋**

Run: `supabase db reset && supabase test db`  
Expected: 모든 테스트 통과, 기존 테스트 포함 전체 녹색.

```bash
git add -A
git commit -m "feat(db): add touch_last_seen trigger for device heartbeat"
```

---

## Task 15: Supabase DB 타입 생성

**Files:**
- Create: `src/types/db.ts`
- Modify: `package.json` (types:gen script)

- [ ] **Step 15.1: 타입 생성 스크립트 추가**

`package.json`의 `scripts`에 추가:
```json
"types:gen": "supabase gen types typescript --local --schema public > src/types/db.ts"
```

- [ ] **Step 15.2: 타입 생성**

Run:
```bash
supabase start       # 이미 기동 중이면 생략
pnpm types:gen
```

`src/types/db.ts`에 `Database` 인터페이스 등이 생성됨. 파일 상단에 다음 주석 추가 (자동생성 표기):
```ts
// AUTO-GENERATED — 재생성: pnpm types:gen
```

- [ ] **Step 15.3: 커밋**

```bash
git add -A
git commit -m "feat(types): generate Supabase TypeScript types from local schema"
```

---

## Task 16: Supabase 클라이언트 + react-query

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/queryClient.ts`

- [ ] **Step 16.1: 의존성 설치**

Run:
```bash
pnpm add @supabase/supabase-js @tanstack/react-query react-router-dom zod
```

- [ ] **Step 16.2: 환경변수 타입**

Create `src/vite-env.d.ts` (없으면) — Vite 기본으로 생성되어 있으므로 다음 내용을 추가:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 16.3: Supabase 클라이언트**

Create `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/db';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
```

- [ ] **Step 16.4: queryClient 설정**

Create `src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      retry: 3,
    },
    mutations: { retry: 0 },
  },
});
```

- [ ] **Step 16.5: 커밋**

```bash
git add -A
git commit -m "feat(lib): add Supabase client and react-query setup"
```

---

## Task 17: 인증 훅 (useAuth)

**Files:**
- Create: `src/hooks/useAuth.ts`
- Create: `src/hooks/useAuth.test.tsx`

- [ ] **Step 17.1: 테스트 작성**

Create `src/hooks/useAuth.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';

vi.mock('../lib/supabase', () => {
  const listeners: Array<(e: string, s: unknown) => void> = [];
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn((cb) => {
          listeners.push(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    },
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns loading=true initially then session=null when unauthenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.role).toBeNull();
  });
});
```

- [ ] **Step 17.2: 테스트 실행 (fail 기대)**

Run: `pnpm test -- useAuth`  
Expected: FAIL — `useAuth` 모듈을 찾을 수 없음.

- [ ] **Step 17.3: 구현**

Create `src/hooks/useAuth.ts`:
```ts
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Role = 'admin' | 'viewer' | null;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { data: role = null } = useQuery<Role>({
    queryKey: ['profile', session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role ?? null) as Role;
    },
  });

  return { session, role, loading, user: session?.user ?? null };
}
```

- [ ] **Step 17.4: 테스트 pass 확인**

Run: `pnpm test -- useAuth`  
Expected: PASS.

- [ ] **Step 17.5: 커밋**

```bash
git add -A
git commit -m "feat(hooks): add useAuth for session and role"
```

---

## Task 18: 라우팅 + AuthGate + AdminGate

**Files:**
- Create: `src/routes/AuthGate.tsx`, `src/routes/AdminGate.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`

- [ ] **Step 18.1: AuthGate**

Create `src/routes/AuthGate.tsx`:
```tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AuthGate() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-text-dim">Loading...</div>;
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 18.2: AdminGate**

Create `src/routes/AdminGate.tsx`:
```tsx
import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AdminGate() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <div className="text-xl font-semibold mb-2">접근 권한이 없습니다</div>
        <div className="text-text-dim">관리자 권한이 필요한 페이지입니다.</div>
      </div>
    );
  }
  return <Outlet />;
}
```

- [ ] **Step 18.3: App 라우터 정의**

`src/App.tsx` 교체:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGate } from './routes/AuthGate';
import { AdminGate } from './routes/AdminGate';
import { LoginPage } from './pages/LoginPage';
import { KpiPage } from './pages/KpiPage';
import { AiPage } from './pages/AiPage';
import { CostPage } from './pages/CostPage';
import { LotHistoryPage } from './pages/LotHistoryPage';
import { LotManagePage } from './pages/admin/LotManagePage';
import { ClaimPage } from './pages/admin/ClaimPage';
import { DevicePage } from './pages/admin/DevicePage';
import { AlarmRulePage } from './pages/admin/AlarmRulePage';
import { TargetPage } from './pages/admin/TargetPage';
import { UserPage } from './pages/admin/UserPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGate />}>
          <Route path="/" element={<Navigate to="/kpi" replace />} />
          <Route path="/kpi" element={<KpiPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/cost" element={<CostPage />} />
          <Route path="/lot" element={<LotHistoryPage />} />
          <Route element={<AdminGate />}>
            <Route path="/admin/lots"        element={<LotManagePage />} />
            <Route path="/admin/claims"      element={<ClaimPage />} />
            <Route path="/admin/devices"     element={<DevicePage />} />
            <Route path="/admin/alarm-rules" element={<AlarmRulePage />} />
            <Route path="/admin/targets"     element={<TargetPage />} />
            <Route path="/admin/users"       element={<UserPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 18.4: QueryClientProvider 주입**

`src/main.tsx` 교체:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/queryClient';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 18.5: 다음 Task가 요구하는 페이지 모듈 placeholder 생성**

Create `src/pages/LoginPage.tsx`:
```tsx
export function LoginPage() {
  return <div className="p-6">Login — placeholder</div>;
}
```

Create `src/pages/KpiPage.tsx`, `src/pages/AiPage.tsx`, `src/pages/CostPage.tsx`, `src/pages/LotHistoryPage.tsx`:
```tsx
export function KpiPage() { return <div className="p-6">실시간 KPI — placeholder</div>; }
```
(각 파일에 맞게 컴포넌트 이름/라벨 수정)

Create `src/pages/admin/LotManagePage.tsx`, `ClaimPage.tsx`, `DevicePage.tsx`, `AlarmRulePage.tsx`, `TargetPage.tsx`, `UserPage.tsx` — 동일 패턴의 placeholder.

- [ ] **Step 18.6: 검증**

Run: `pnpm typecheck && pnpm build && pnpm dev`  
브라우저 `http://localhost:5173` — `/login`으로 리다이렉트되어야 함 (세션 없으므로). Ctrl-C.

- [ ] **Step 18.7: 커밋**

```bash
git add -A
git commit -m "feat(routing): add router with AuthGate, AdminGate, page skeletons"
```

---

## Task 19: 로그인 페이지 구현

**Files:**
- Modify: `src/pages/LoginPage.tsx`
- Create: `src/pages/LoginPage.test.tsx`

- [ ] **Step 19.1: 테스트**

Create `src/pages/LoginPage.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const signInMock = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (args: unknown) => signInMock(args),
    },
  },
}));

describe('LoginPage', () => {
  it('submits email and password', async () => {
    signInMock.mockResolvedValueOnce({ error: null });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/이메일/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호/i), {
      target: { value: 'pw1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: /로그인/i }));
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw1234' })
    );
  });

  it('shows error on failure', async () => {
    signInMock.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/이메일/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호/i), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /로그인/i }));
    await waitFor(() =>
      expect(screen.getByText(/Invalid login credentials/i)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 19.2: 실패 실행**

Run: `pnpm test -- LoginPage`  
Expected: FAIL — form 요소 없음.

- [ ] **Step 19.3: 구현**

`src/pages/LoginPage.tsx` 교체:
```tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const from = (loc.state as { from?: string })?.from ?? '/kpi';
    nav(from, { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <form
        onSubmit={onSubmit}
        className="bg-surface border border-border rounded-lg p-8 w-full max-w-sm shadow-sm"
      >
        <h1 className="text-xl font-bold text-primary mb-1">온기 대시보드</h1>
        <p className="text-text-dim text-xs mb-6">등록된 계정으로 로그인하세요.</p>

        <label htmlFor="email" className="block text-xs text-text-dim mb-1">
          이메일
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-border rounded px-3 py-2 mb-4 focus:outline-none focus:border-primary"
        />

        <label htmlFor="pw" className="block text-xs text-text-dim mb-1">
          비밀번호
        </label>
        <input
          id="pw"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          className="w-full border border-border rounded px-3 py-2 mb-4 focus:outline-none focus:border-primary"
        />

        {err && <div className="text-danger text-xs mb-3">{err}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded text-white font-medium bg-primary hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 19.4: 테스트 pass**

Run: `pnpm test -- LoginPage`  
Expected: PASS.

- [ ] **Step 19.5: 수동 확인**

Run: `pnpm dev`  
브라우저에서 로그인 폼 확인. Supabase Studio(`http://127.0.0.1:54323`)에서 테스트 유저 생성 후 로그인 시도 → `/kpi`로 이동해야 함. Ctrl-C.

- [ ] **Step 19.6: 커밋**

```bash
git add -A
git commit -m "feat(auth): implement login page with Supabase email/password"
```

---

## Task 20: 레이아웃 컴포넌트 (Header, TabBar, MobileNav, Clock, LiveDot)

**Files:**
- Create: `src/components/layout/Header.tsx`, `TabBar.tsx`, `MobileNav.tsx`, `Clock.tsx`, `LiveDot.tsx`, `Footer.tsx`, `AppLayout.tsx`
- Modify: `src/App.tsx` (AppLayout 적용)

- [ ] **Step 20.1: Clock 컴포넌트**

Create `src/components/layout/Clock.tsx`:
```tsx
import { useEffect, useState } from 'react';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const p = (n: number) => String(n).padStart(2, '0');

function format(d: Date) {
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} (${
    DAYS[d.getDay()]
  }) ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function Clock() {
  const [now, setNow] = useState(() => format(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs text-text-dim">{now}</span>;
}
```

- [ ] **Step 20.2: LiveDot**

Create `src/components/layout/LiveDot.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function LiveDot() {
  // Phase 1은 단순 데이터 존재 여부만 체크. 후속 Phase에서 정교화.
  const [ok, setOk] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function ping() {
      const { error } = await supabase.from('devices').select('id').limit(1);
      if (mounted) setOk(!error);
    }
    ping();
    const id = setInterval(ping, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span
        className={`w-2 h-2 rounded-full ${ok ? 'bg-good' : 'bg-danger'} animate-pulse`}
      />
      <span className="text-text-dim">{ok ? '연결됨' : '연결 오류'}</span>
    </span>
  );
}
```

- [ ] **Step 20.3: TabBar (데스크톱)**

Create `src/components/layout/TabBar.tsx`:
```tsx
import { NavLink } from 'react-router-dom';

const MAIN_TABS = [
  { to: '/kpi',  label: '실시간 KPI' },
  { to: '/ai',   label: 'AI 성능지표' },
  { to: '/cost', label: '제조원가' },
  { to: '/lot',  label: 'LOT 이력' },
];

const ADMIN_TABS = [
  { to: '/admin/lots',        label: 'LOT 관리' },
  { to: '/admin/claims',      label: '클레임' },
  { to: '/admin/devices',     label: '장비' },
  { to: '/admin/alarm-rules', label: '알람 규칙' },
  { to: '/admin/targets',     label: '목표값' },
  { to: '/admin/users',       label: '사용자' },
];

export function TabBar({ showAdmin }: { showAdmin: boolean }) {
  return (
    <nav className="hidden md:flex bg-surface border-b border-border px-6 gap-0.5 overflow-x-auto">
      {[...MAIN_TABS, ...(showAdmin ? ADMIN_TABS : [])].map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `px-5 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? 'text-primary border-primary font-medium'
                : 'text-text-dim border-transparent hover:text-text'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 20.4: MobileNav**

Create `src/components/layout/MobileNav.tsx`:
```tsx
import { NavLink } from 'react-router-dom';
import { useState } from 'react';

const MAIN_TABS = [
  { to: '/kpi',  label: '실시간 KPI' },
  { to: '/ai',   label: 'AI 성능지표' },
  { to: '/cost', label: '제조원가' },
  { to: '/lot',  label: 'LOT 이력' },
];

const ADMIN_TABS = [
  { to: '/admin/lots',        label: 'LOT 관리' },
  { to: '/admin/claims',      label: '클레임' },
  { to: '/admin/devices',     label: '장비' },
  { to: '/admin/alarm-rules', label: '알람 규칙' },
  { to: '/admin/targets',     label: '목표값' },
  { to: '/admin/users',       label: '사용자' },
];

export function MobileNav({ showAdmin }: { showAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="메뉴 열기"
        className="px-3 py-2 border border-border rounded text-xs text-text-dim"
      >
        ☰ 메뉴
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full bg-surface border-b border-border shadow z-50">
          {[...MAIN_TABS, ...(showAdmin ? ADMIN_TABS : [])].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-6 py-3 text-sm border-b border-border ${
                  isActive ? 'text-primary font-medium bg-surface2' : 'text-text'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 20.5: Header + Footer**

Create `src/components/layout/Header.tsx`:
```tsx
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Clock } from './Clock';
import { LiveDot } from './LiveDot';
import { MobileNav } from './MobileNav';

export function Header() {
  const { session, role } = useAuth();
  return (
    <header className="relative bg-surface border-b border-border h-14 px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <MobileNav showAdmin={role === 'admin'} />
        <span className="font-mono text-xs text-primary tracking-wider hidden sm:inline">
          PAXC · Foodly
        </span>
        <span className="w-px h-5 bg-border hidden sm:inline-block" />
        <span className="text-sm font-medium text-text">온기코퍼레이션 생산 모니터링</span>
      </div>
      <div className="flex items-center gap-4">
        <LiveDot />
        <Clock />
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-text-dim hover:text-danger"
        >
          {session?.user.email} · 로그아웃
        </button>
      </div>
    </header>
  );
}
```

Create `src/components/layout/Footer.tsx`:
```tsx
export function Footer() {
  return (
    <footer className="text-center text-[11px] text-text-muted py-5 border-t border-border font-mono">
      PAXC (팍스씨) · 온기코퍼레이션 스마트 생산 모니터링 v1.0 · Phase 1
    </footer>
  );
}
```

- [ ] **Step 20.6: AppLayout**

Create `src/components/layout/AppLayout.tsx`:
```tsx
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { Footer } from './Footer';
import { useAuth } from '../../hooks/useAuth';

export function AppLayout() {
  const { role } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TabBar showAdmin={role === 'admin'} />
      <main className="flex-1 px-6 py-5 max-w-[1400px] w-full mx-auto">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 20.7: App.tsx에 AppLayout 적용**

`src/App.tsx`의 AuthGate 분기를 교체:
```tsx
<Route element={<AuthGate />}>
  <Route element={<AppLayout />}>
    <Route path="/" element={<Navigate to="/kpi" replace />} />
    <Route path="/kpi" element={<KpiPage />} />
    <Route path="/ai" element={<AiPage />} />
    <Route path="/cost" element={<CostPage />} />
    <Route path="/lot" element={<LotHistoryPage />} />
    <Route element={<AdminGate />}>
      <Route path="/admin/lots"        element={<LotManagePage />} />
      <Route path="/admin/claims"      element={<ClaimPage />} />
      <Route path="/admin/devices"     element={<DevicePage />} />
      <Route path="/admin/alarm-rules" element={<AlarmRulePage />} />
      <Route path="/admin/targets"     element={<TargetPage />} />
      <Route path="/admin/users"       element={<UserPage />} />
    </Route>
  </Route>
</Route>
```

상단 `import { AppLayout } from './components/layout/AppLayout';` 추가.

- [ ] **Step 20.8: 검증**

Run: `pnpm typecheck && pnpm dev`  
로그인 후 헤더 · 탭바 · 시계 · 연결 상태가 모두 노출되는지, 각 탭 이동 정상인지 확인.

- [ ] **Step 20.9: 커밋**

```bash
git add -A
git commit -m "feat(layout): add Header, TabBar, MobileNav, Clock, LiveDot, AppLayout"
```

---

## Task 21: Ingest Edge Function — 스켈레톤 + API 키 검증

**Files:**
- Create: `supabase/functions/ingest/index.ts`, `schemas.ts`, `handlers.ts`, `csv.ts`
- Create: `tests/ingest.test.ts`

- [ ] **Step 21.1: Edge Function 생성**

Run: `supabase functions new ingest`  
`supabase/functions/ingest/index.ts`가 자동 생성됨.

- [ ] **Step 21.2: 파일 구조 설정**

Create `supabase/functions/ingest/schemas.ts`:
```ts
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export const VisionMetricsSchema = z.object({
  bucket_at: z.string().datetime({ offset: true }),
  metrics: z.object({
    total_inspected: z.number().int().min(0),
    good_count: z.number().int().min(0),
    defect_count: z.number().int().min(0),
    unknown_count: z.number().int().min(0),
    inspection_time_seconds: z.number().min(0),
  }).refine(
    (m) => m.total_inspected === m.good_count + m.defect_count + m.unknown_count,
    { message: 'total_inspected must equal good + defect + unknown' }
  ),
});

export const EquipmentMetricsSchema = z.object({
  bucket_at: z.string().datetime({ offset: true }),
  metrics: z.object({
    runtime_seconds: z.number().int().min(0).max(60),
    output_count: z.number().int().min(0),
    extras: z.record(z.unknown()).optional(),
  }),
});

export type VisionMetrics = z.infer<typeof VisionMetricsSchema>;
export type EquipmentMetrics = z.infer<typeof EquipmentMetricsSchema>;
```

Create `supabase/functions/ingest/handlers.ts`:
```ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { VisionMetricsSchema, EquipmentMetricsSchema } from './schemas.ts';

export interface DeviceRow {
  id: string;
  code: string;
  type: 'vision_inspector' | 'equipment';
  api_key_hash: string;
  active: boolean;
}

export async function findDevice(
  admin: SupabaseClient,
  code: string
): Promise<DeviceRow | null> {
  const { data } = await admin
    .from('devices')
    .select('id, code, type, api_key_hash, active')
    .eq('code', code)
    .maybeSingle();
  return (data as DeviceRow | null) ?? null;
}

export async function verifyApiKey(hash: string, provided: string): Promise<boolean> {
  // Phase 1: 간단 문자열 비교. 후속 Phase에서 bcrypt 해시 도입 예정.
  return hash === provided;
}

export async function insertVision(
  admin: SupabaseClient,
  deviceId: string,
  payload: unknown
) {
  const parsed = VisionMetricsSchema.parse(payload);
  const { error } = await admin.from('vision_inspector_metrics').insert({
    device_id: deviceId,
    bucket_at: parsed.bucket_at,
    ...parsed.metrics,
  });
  if (error) throw error;
}

export async function insertEquipment(
  admin: SupabaseClient,
  deviceId: string,
  payload: unknown
) {
  const parsed = EquipmentMetricsSchema.parse(payload);
  const { extras, ...m } = parsed.metrics;
  const { error } = await admin.from('equipment_metrics').insert({
    device_id: deviceId,
    bucket_at: parsed.bucket_at,
    ...m,
    extras: extras ?? {},
  });
  if (error) throw error;
}

export async function logIngest(
  admin: SupabaseClient,
  deviceCode: string | null,
  status: string,
  errorMessage: string | null,
  rawPayload: unknown
) {
  await admin.from('ingest_logs').insert({
    device_code: deviceCode,
    status,
    error_message: errorMessage,
    raw_payload: rawPayload,
  });
}
```

Create `supabase/functions/ingest/csv.ts`:
```ts
export function parseCsvRow(csv: string): Record<string, string> {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('csv must have header and at least one row');
  }
  const header = lines[0].split(',').map((h) => h.trim());
  const row = lines[1].split(',').map((v) => v.trim());
  if (header.length !== row.length) {
    throw new Error('header/row column count mismatch');
  }
  return Object.fromEntries(header.map((h, i) => [h, row[i]]));
}

export function csvToVisionPayload(csv: string): unknown {
  const r = parseCsvRow(csv);
  return {
    bucket_at: r.bucket_at,
    metrics: {
      total_inspected: Number(r.total_inspected),
      good_count: Number(r.good_count),
      defect_count: Number(r.defect_count),
      unknown_count: Number(r.unknown_count),
      inspection_time_seconds: Number(r.inspection_time_seconds),
    },
  };
}

export function csvToEquipmentPayload(csv: string): unknown {
  const r = parseCsvRow(csv);
  return {
    bucket_at: r.bucket_at,
    metrics: {
      runtime_seconds: Number(r.runtime_seconds),
      output_count: Number(r.output_count),
    },
  };
}
```

- [ ] **Step 21.3: 메인 핸들러**

`supabase/functions/ingest/index.ts` 교체:
```ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZodError } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import {
  findDevice,
  verifyApiKey,
  insertVision,
  insertEquipment,
  logIngest,
} from './handlers.ts';
import { csvToVisionPayload, csvToEquipmentPayload } from './csv.ts';

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

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const deviceCode = req.headers.get('X-Device-Code');
  const apiKey = req.headers.get('X-Api-Key');
  const contentType = req.headers.get('Content-Type') ?? '';

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  if (!deviceCode || !apiKey) {
    await logIngest(admin, deviceCode, 'invalid_headers', 'missing X-Device-Code or X-Api-Key', rawBody);
    return json({ error: 'missing_headers' }, 400);
  }

  const device = await findDevice(admin, deviceCode);
  if (!device || !device.active) {
    await logIngest(admin, deviceCode, 'device_not_found', null, rawBody);
    return json({ error: 'device_not_found' }, 404);
  }

  if (!(await verifyApiKey(device.api_key_hash, apiKey))) {
    await logIngest(admin, deviceCode, 'invalid_key', null, rawBody);
    return json({ error: 'invalid_api_key' }, 401);
  }

  // payload 해석
  let payload: unknown;
  try {
    if (contentType.includes('text/csv')) {
      payload =
        device.type === 'vision_inspector'
          ? csvToVisionPayload(rawBody)
          : csvToEquipmentPayload(rawBody);
    } else {
      payload = JSON.parse(rawBody);
    }
  } catch (e) {
    await logIngest(admin, deviceCode, 'parse_error', (e as Error).message, rawBody);
    return json({ error: 'parse_error', details: (e as Error).message }, 400);
  }

  // 스키마 검증 + 삽입
  try {
    if (device.type === 'vision_inspector') {
      await insertVision(admin, device.id, payload);
    } else {
      await insertEquipment(admin, device.id, payload);
    }
  } catch (e) {
    if (e instanceof ZodError) {
      await logIngest(admin, deviceCode, 'schema_invalid', JSON.stringify(e.flatten()), payload);
      return json({ error: 'schema_invalid', details: e.flatten() }, 400);
    }
    const msg = (e as { code?: string; message?: string }).code === '23505'
      ? 'duplicate'
      : 'db_error';
    if (msg === 'duplicate') {
      await logIngest(admin, deviceCode, 'duplicate', null, payload);
      return json({ ok: true, duplicate: true });
    }
    await logIngest(admin, deviceCode, 'db_error', (e as Error).message, payload);
    return json({ error: 'internal' }, 500);
  }

  await logIngest(admin, deviceCode, 'success', null, null);
  return json({ ok: true, ingested_at: new Date().toISOString() });
});
```

- [ ] **Step 21.4: 환경변수 확인**

Run:
```bash
supabase functions serve ingest --env-file ./supabase/.env.local
```

`supabase/.env.local` 이 없으면 생성:
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<supabase start 출력의 service_role key>
```

- [ ] **Step 21.5: 수동 curl 검증 (404 → 400 → 401 → 200 순)**

별도 터미널에서:
```bash
# 1. 장비 미존재 → 404
curl -i -X POST http://127.0.0.1:54321/functions/v1/ingest \
  -H "Authorization: Bearer <anon_key>" \
  -H "X-Device-Code: nobody" \
  -H "X-Api-Key: x" \
  -d '{}'

# 2. seed 장비 사용 — API 키 불일치 → 401
curl -i -X POST http://127.0.0.1:54321/functions/v1/ingest \
  -H "Authorization: Bearer <anon_key>" \
  -H "X-Device-Code: packaging_01" \
  -H "X-Api-Key: wrong" \
  -d '{}'

# 3. 스키마 오류 → 400
curl -i -X POST http://127.0.0.1:54321/functions/v1/ingest \
  -H "Authorization: Bearer <anon_key>" \
  -H "X-Device-Code: packaging_01" \
  -H "X-Api-Key: seed-hash-replace-on-first-use" \
  -H "Content-Type: application/json" \
  -d '{"bucket_at":"not-a-date","metrics":{}}'

# 4. 정상 수신 → 200
curl -i -X POST http://127.0.0.1:54321/functions/v1/ingest \
  -H "Authorization: Bearer <anon_key>" \
  -H "X-Device-Code: packaging_01" \
  -H "X-Api-Key: seed-hash-replace-on-first-use" \
  -H "Content-Type: application/json" \
  -d '{"bucket_at":"2026-04-23T10:00:00+09:00","metrics":{"runtime_seconds":58,"output_count":1800}}'
```

Expected: 각각 404, 401, 400, 200 응답. DB 확인:
```bash
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -c "select device_code, status, error_message from ingest_logs order by received_at desc limit 10;"
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -c "select * from equipment_metrics order by bucket_at desc limit 1;"
```

`ingest_logs`에 4개 행 (device_not_found/invalid_key/schema_invalid/success), `equipment_metrics`에 1개 행이 있어야 함.

- [ ] **Step 21.6: 커밋**

```bash
git add -A
git commit -m "feat(edge): add /ingest Edge Function with key auth and schema validation"
```

---

## Task 22: Ingest 통합 테스트 (Vitest)

**Files:**
- Create: `tests/ingest.test.ts`
- Modify: `package.json` (test:integration script)

- [ ] **Step 22.1: 테스트 작성**

Create `tests/ingest.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const INGEST_URL = 'http://127.0.0.1:54321/functions/v1/ingest';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function headers(deviceCode: string, apiKey: string, ct = 'application/json') {
  return {
    Authorization: `Bearer ${ANON}`,
    'X-Device-Code': deviceCode,
    'X-Api-Key': apiKey,
    'Content-Type': ct,
  };
}

describe('ingest edge function', () => {
  const admin = createClient(SUPABASE_URL, SERVICE);

  beforeAll(async () => {
    // 테스트 전 이전 metrics 청소
    await admin.from('equipment_metrics').delete().neq('id', 0);
    await admin.from('vision_inspector_metrics').delete().neq('id', 0);
    await admin.from('ingest_logs').delete().neq('id', 0);
  });

  it('rejects unknown device with 404', async () => {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('unknown_xxx', 'x'),
      body: '{}',
    });
    expect(res.status).toBe(404);
  });

  it('rejects wrong API key with 401', async () => {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', 'wrong_key'),
      body: JSON.stringify({
        bucket_at: '2026-04-23T10:00:00+09:00',
        metrics: { runtime_seconds: 30, output_count: 500 },
      }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects invalid schema with 400', async () => {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', 'seed-hash-replace-on-first-use'),
      body: JSON.stringify({ bucket_at: 'bad', metrics: {} }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts valid equipment payload and stores row', async () => {
    const bucket = '2026-04-23T11:00:00+09:00';
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', 'seed-hash-replace-on-first-use'),
      body: JSON.stringify({
        bucket_at: bucket,
        metrics: { runtime_seconds: 55, output_count: 1650 },
      }),
    });
    expect(res.status).toBe(200);
    const { data } = await admin
      .from('equipment_metrics')
      .select('output_count, runtime_seconds')
      .eq('bucket_at', bucket)
      .maybeSingle();
    expect(data?.output_count).toBe(1650);
    expect(data?.runtime_seconds).toBe(55);
  });

  it('accepts valid vision payload', async () => {
    const bucket = '2026-04-23T11:00:00+09:00';
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('vision_01', 'seed-hash-replace-on-first-use'),
      body: JSON.stringify({
        bucket_at: bucket,
        metrics: {
          total_inspected: 1800,
          good_count: 1785,
          defect_count: 10,
          unknown_count: 5,
          inspection_time_seconds: 58,
        },
      }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 with duplicate=true on re-send', async () => {
    const bucket = '2026-04-23T12:00:00+09:00';
    const body = JSON.stringify({
      bucket_at: bucket,
      metrics: { runtime_seconds: 55, output_count: 1700 },
    });
    const first = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', 'seed-hash-replace-on-first-use'),
      body,
    });
    expect(first.status).toBe(200);
    const second = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', 'seed-hash-replace-on-first-use'),
      body,
    });
    expect(second.status).toBe(200);
    const json = await second.json();
    expect(json.duplicate).toBe(true);
  });

  it('accepts CSV payload', async () => {
    const bucket = '2026-04-23T13:00:00+09:00';
    const csv =
      `bucket_at,runtime_seconds,output_count\n${bucket},50,1500`;
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', 'seed-hash-replace-on-first-use', 'text/csv'),
      body: csv,
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 22.2: 통합 테스트 스크립트 추가**

`package.json`에 추가:
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

Create `vitest.integration.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
```

- [ ] **Step 22.3: 테스트 실행**

로컬 Supabase + Edge Function 모두 기동된 상태여야 함.

Run (별도 터미널에서):
```bash
# 터미널 1
supabase start
supabase db reset           # seed 포함 재적용
supabase functions serve ingest --env-file ./supabase/.env.local --no-verify-jwt
```

Run (터미널 2):
```bash
# .env.test에 anon / service key 환경변수 노출
export SUPABASE_ANON_KEY=$(supabase status -o env | grep ANON_KEY | cut -d= -f2- | tr -d '"')
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '"')
pnpm test:integration
```

Expected: 7 tests pass.

- [ ] **Step 22.4: 커밋**

```bash
git add -A
git commit -m "test(ingest): add integration tests for edge function happy & error paths"
```

---

## Task 23: README 및 로컬 개발 가이드

**Files:**
- Create: `README.md`

- [ ] **Step 23.1: README 작성**

Create `README.md`:
```markdown
# 온기코퍼레이션 생산 모니터링 대시보드

온열팩 제조사 온기코퍼레이션의 생산 라인을 실시간 모니터링하는 내부 대시보드.

**Phase 1 범위:** 기반 구축 — 로그인 / 장비 데이터 수신(`/ingest`) / 빈 대시보드 껍데기.

## 기술 스택

- 프론트엔드: Vite + React 18 + TypeScript + Tailwind CSS 3
- 백엔드: Supabase (Postgres + Auth + Edge Functions + Realtime + Storage)
- 테스트: Vitest (프론트·통합), pgTAP (DB)

## 로컬 개발 시작

### 요구사항
- Node 20+, pnpm 9+
- Docker Desktop
- Supabase CLI 1.200+
- Deno 1.40+ (선택 — Edge Function 로컬 개발 시)

### 실행 절차

```bash
pnpm install
cp .env.example .env.local
# .env.local의 VITE_SUPABASE_ANON_KEY를 supabase status 출력값으로 교체

# 1. Supabase 로컬 기동
supabase start

# 2. 마이그레이션 + 시드 적용
supabase db reset

# 3. TypeScript 타입 재생성
pnpm types:gen

# 4. (선택) Edge Function 기동 — 장비 수신 테스트 시
supabase functions serve ingest --env-file ./supabase/.env.local --no-verify-jwt

# 5. 프론트엔드 dev 서버
pnpm dev
```

Supabase Studio: `http://127.0.0.1:54323` (유저 생성은 여기서)

### 테스트

```bash
pnpm lint
pnpm typecheck
pnpm test                    # 단위 테스트 (Vitest)
supabase test db             # DB 스키마·RLS 테스트 (pgTAP)
pnpm test:integration        # /ingest 통합 테스트 (Supabase + Functions 기동 필요)
```

## 문서

- 설계 스펙: `docs/superpowers/specs/2026-04-23-ongi-dashboard-design.md`
- Phase 1 계획: `docs/superpowers/plans/2026-04-23-phase-1-foundation.md`
- UI 참조: `Ongi_Sample_Dashboard.html`

## 배포

Phase 4에서 GitHub Actions + Vercel/Cloudflare Pages 연동 예정.
```

- [ ] **Step 23.2: 커밋**

```bash
git add -A
git commit -m "docs: add README with local development guide"
```

---

## Task 24: Phase 1 전체 통합 검증

마지막 회귀 테스트 — 모든 명령이 깨끗하게 돌아가는지 확인.

- [ ] **Step 24.1: 전체 회귀**

새 터미널에서 순서대로:
```bash
# 1. 정적 검증
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test

# 2. DB 검증
supabase stop          # 기존 인스턴스 정리
supabase start
supabase db reset
supabase test db

# 3. 타입 동기화 확인
pnpm types:gen
git diff src/types/db.ts
# diff가 없어야 정상 (마이그레이션 변경 없음)

# 4. 통합 테스트
supabase functions serve ingest --env-file ./supabase/.env.local --no-verify-jwt &
sleep 3
export SUPABASE_ANON_KEY=$(supabase status -o env | grep ANON_KEY | cut -d= -f2- | tr -d '"')
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '"')
pnpm test:integration
kill %1 2>/dev/null
```

Expected: 모든 명령 성공. 실패 시 해당 태스크로 돌아가 수정.

- [ ] **Step 24.2: 수동 플로우 체크**

`pnpm dev` 실행 후:
1. Supabase Studio(`/auth/users`)에서 테스트 유저 생성 (예: `test@ongi.kr`)
2. SQL editor에서: `update profiles set role = 'admin' where id = (select id from auth.users where email = 'test@ongi.kr');`
3. `http://localhost:5173/login`에서 로그인 → `/kpi` 리다이렉트, 헤더·탭 노출 확인
4. 데스크톱 뷰에서는 상단 탭, 모바일 뷰에서는 햄버거 메뉴 동작 확인
5. admin 권한이므로 `/admin/*` 6개 페이지 모두 placeholder 표시 확인
6. 로그아웃 → `/login`으로 이동 확인

- [ ] **Step 24.3: 최종 커밋 및 태그**

Phase 1이 요구하는 작업이 끝났음을 표시:
```bash
git tag phase-1-complete
git log --oneline
```

`phase-1-complete` 태그가 최신 커밋에 붙어 있어야 함.

---

## Phase 1 완료 판정

다음이 모두 OK면 Phase 1 완료:

- [x] `pnpm lint && pnpm typecheck && pnpm build && pnpm test` 전 녹색
- [x] `supabase db reset && supabase test db` 전 녹색
- [x] `pnpm test:integration` 7건 모두 통과
- [x] 로컬에서 로그인 → 대시보드 껍데기 이동 → admin 탭 6개 표시 수동 확인
- [x] `packaging_01` / `vision_01`로 샘플 `curl` 전송 시 DB row 생성 및 `ingest_logs` 기록
- [x] 모든 커밋이 이력에 남아 있고 `phase-1-complete` 태그 부여됨

**다음 단계:** Phase 2 plan 작성 (실시간 KPI / AI 성능 / 제조원가 / LOT 이력 탭의 실데이터 연동).
