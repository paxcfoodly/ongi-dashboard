# KPI 수정 반영 + 가상 실데이터 시뮬레이터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 성과지표 수정 의견서대로 KPI(원가=LOT당 작업공수, 납기 신규, 인력지표 신규, 기존값→목표치 표시)를 대시보드에 반영하고, HTTPS `/ingest`로 가상 장비 데이터를 보내는 시뮬레이터를 만든다.

**Architecture:** DB는 의도별 migration 4개(lots 컬럼 / hr_kpi_records / 작업공수·리드타임 뷰 / targets) + `supabase/rollbacks/`에 대응 down 스크립트. 프론트는 순수 판정 함수(`src/utils/kpi.ts`) + 조회 훅 + `components/kpi/` 섹션 컴포넌트로 KPI 페이지를 재구성. 시뮬레이터는 의존성 없는 단일 TS 파일(Node 24 네이티브 실행)이며 순수 페이로드 생성 함수를 export해 Vitest로 검증.

**Tech Stack:** Supabase Postgres 17 + pgTAP, React 18 + TS + Tailwind + TanStack Query + Chart.js, Vitest, Playwright, Node 24.

**Spec:** `docs/superpowers/specs/2026-10-26-kpi-revision-design.md`

## Global Constraints

- 코드 주석은 한국어. 커밋 prefix `feat:`/`fix:`/`test:`/`docs:`/`chore:`/`refactor:`, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 작업 브랜치 `feat/kpi-revision` (커밋 전 `git branch --show-current` 확인).
- DB 변경은 migration 파일로만, 파일당 한 가지 의도, `supabase/rollbacks/<migration 파일명>`에 rollback 스크립트.
- 새 테이블은 기존 관례대로 RLS: `"authed read"` (select to authenticated using true) + `"admin write"` (for all using/with check `is_admin()`). 단일 회사 전용 — `tenant_id` 도입하지 않음 (스펙 §4).
- 기존 훅 관례: `const sb = supabase as any;` + `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + 위 한 줄 이유 주석.
- KST 기준 기간 = `fn_kst_today_start()` 관례 사용. 최근 기간 상수 = **30일**.
- 컴포넌트 파일 300줄 이하 유지.
- 데이터 없을 때 값 `—` + 사유 문구, 0/NaN 노출 금지.
- 목표값은 DB `targets`에서 읽는다 (하드코딩 금지). 키 이름은 스펙 §5.4 그대로.
- 머지 전 `pnpm lint && pnpm typecheck && pnpm test && pnpm build && supabase test db && pnpm test:integration && pnpm test:e2e` 모두 통과. dev 서버가 떠 있으면 build 전에 내린다(포트 확인과 build는 별도 명령).

## Review Focus

1. 진행 중 LOT(종료 시각 없음) 또는 투입인원 미입력 LOT → 작업공수 평균에서 제외되고, 완료 LOT이 하나도 없으면 카드에 "완료된 LOT 없음" 표시 (Task 3 pgTAP, Task 5 Vitest).
2. 수주일과 출하일이 같은 날 → 리드타임 0일로 정상 집계(제외되지 않음) (Task 3 pgTAP).
3. 관리자가 종료 시각을 시작보다 앞으로, 출하일을 수주일보다 앞으로 입력 → DB 제약 거부 + 저장 실패 토스트, 화면 깨짐 없음 (Task 1 pgTAP, Task 8 Vitest).
4. 인력 지표 기록이 없거나 만족도만 입력된 경우 → 해당 카드만 "입력된 기록 없음", 나머지는 정상 (Task 5·6 Vitest).
5. 시뮬레이터가 중복 버킷(`duplicate: true`) 또는 401(키 오류)을 받음 → 중단하지 않고 집계에 반영해 다음 버킷 진행 (Task 10 Vitest).

---

### Task 1: lots에 투입인원·수주일·출하일 컬럼

**Files:**
- Create: `supabase/migrations/20261026000001_lots_kpi_columns.sql`
- Create: `supabase/rollbacks/20261026000001_lots_kpi_columns.sql`
- Test: `supabase/tests/14_lots_kpi_columns.sql`

**Interfaces:**
- Produces: `lots.worker_count int null check (worker_count > 0)`, `lots.ordered_at date null`, `lots.shipped_at date null`, constraint `lots_shipped_after_ordered check (shipped_at is null or ordered_at is null or shipped_at >= ordered_at)`.

- [ ] **Step 1: pgTAP 테스트 작성** — `plan(6)`: `has_column` ×3 (`worker_count`, `ordered_at`, `shipped_at`); `throws_like` worker_count=0 insert → `%check%`; `throws_like` shipped_at < ordered_at → `%lots_shipped_after_ordered%`; `lives_ok` ordered_at = shipped_at 같은 날 insert. 기존 `lots_end_after_start`에 대해 ended_at < started_at update가 거부되는지 `throws_like` 1건 추가해 `plan(7)`.
- [ ] **Step 2: 실패 확인** — Run: `supabase test db` → 14_lots_kpi_columns FAIL (column does not exist).
- [ ] **Step 3: migration 작성** — `alter table lots add column ...` 3개 + constraint. 각 컬럼 `comment on column` 한국어. rollback: constraint drop → 컬럼 drop.
- [ ] **Step 4: 통과 확인** — Run: `supabase db reset && supabase test db` → 전체 PASS.
- [ ] **Step 5: Commit** — `feat(db): add worker_count, ordered_at, shipped_at to lots`

### Task 2: hr_kpi_records 테이블

**Files:**
- Create: `supabase/migrations/20261026000002_hr_kpi_records.sql`
- Create: `supabase/rollbacks/20261026000002_hr_kpi_records.sql`
- Test: `supabase/tests/15_hr_kpi_records.sql`

**Interfaces:**
- Produces: table `hr_kpi_records(id uuid pk default gen_random_uuid(), measured_on date not null unique, job_conversion_rate_pct numeric(5,2) null check 0..100, satisfaction_score numeric(3,2) null check 0..5, note text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now())`, trigger `trg_hr_kpi_records_updated_at` → `fn_set_updated_at()`, RLS 정책 2개(기존 이름 관례).

- [ ] **Step 1: pgTAP 테스트 작성** — `07_rls_policies.sql` 패턴 그대로 사용(auth.users insert + `set local role authenticated` + `request.jwt.claim.sub`). `plan(7)`: `has_table`; anon select count = 0; viewer select 가능(`lives_ok`); viewer insert → `%row-level security%`; admin insert 성공; admin update 후 `updated_at` 증가; `satisfaction_score = 5.1` → `%check%`.
- [ ] **Step 2: 실패 확인** — `supabase test db` → 15 FAIL.
- [ ] **Step 3: migration 작성** (테이블 + `enable row level security` + 정책 + 트리거 + 한국어 comment). rollback: `drop table hr_kpi_records`.
- [ ] **Step 4: 통과 확인** — `supabase db reset && supabase test db` PASS.
- [ ] **Step 5: Commit** — `feat(db): add hr_kpi_records table with RLS`

### Task 3: 작업공수·리드타임 뷰 + v_lot_summary 확장

**Files:**
- Create: `supabase/migrations/20261026000003_views_manhour_leadtime.sql`
- Create: `supabase/rollbacks/20261026000003_views_manhour_leadtime.sql`
- Test: `supabase/tests/16_views_manhour_leadtime.sql`

**Interfaces:**
- Consumes: Task 1 컬럼.
- Produces (모두 `grant select to authenticated`):
  - `v_lot_manhour(id, lot_no, started_at, ended_at, worker_count, work_hours numeric(10,2), man_hour numeric(10,2))` — started_at·ended_at·worker_count 모두 not null인 LOT만. `work_hours = extract(epoch from ended_at - started_at)/3600`.
  - `v_kpi_manhour(lot_count int, avg_man_hour numeric|null, latest_man_hour numeric|null)` — `ended_at >= fn_kst_today_start() - interval '29 days'` 범위. LOT 없으면 `lot_count=0`, 나머지 null(0 아님).
  - `v_lot_leadtime(id, lot_no, ordered_at, shipped_at, lead_days int)`.
  - `v_kpi_leadtime(lot_count int, avg_lead_days numeric(6,1)|null)` — `shipped_at >= (fn_kst_today_start() - interval '29 days')::date` (KST date).
  - `v_lot_summary` — 기존 정의를 `create or replace`하되 **기존 컬럼 순서 유지 + 맨 뒤에** `worker_count, ordered_at, shipped_at, work_hours, man_hour, lead_days` 추가(완료 전·미입력이면 null).

- [ ] **Step 1: pgTAP 테스트 작성** — `plan(8)`: 빈 상태 `v_kpi_manhour.lot_count = 0` 및 `avg_man_hour is null`; LOT A(3명, 8시간, 완료) + LOT B(4명, 2시간, 완료) + LOT C(진행 중, ended_at null) + LOT D(완료, worker_count null) insert → `v_lot_manhour` 행 2개, A의 `man_hour = 24.00`, `v_kpi_manhour.avg_man_hour = 16.00`, `lot_count = 2`; 40일 전 종료 LOT E는 평균 제외(`lot_count` 여전히 2); 수주=출하 같은 날 LOT의 `lead_days = 0`이고 `v_kpi_leadtime.lot_count`에 포함; `v_lot_summary`에서 A의 `man_hour = 24.00`.
- [ ] **Step 2: 실패 확인** — `supabase test db` → 16 FAIL.
- [ ] **Step 3: migration 작성.** rollback: 신규 뷰 4개 drop + `v_lot_summary`를 `20260423000019` 원래 정의로 재생성(컬럼 축소는 replace 불가 → `drop view v_lot_summary; create view ...` + grant).
- [ ] **Step 4: 통과 확인** — `supabase db reset && supabase test db` PASS.
- [ ] **Step 5: Commit** — `feat(db): add man-hour and lead-time KPI views`

### Task 4: targets 성과지표 키 + 원가비율 알람 비활성화

**Files:**
- Create: `supabase/migrations/20261026000004_targets_kpi_revision.sql`
- Create: `supabase/rollbacks/20261026000004_targets_kpi_revision.sql`
- Test: `supabase/tests/17_targets_kpi_revision.sql`
- Modify: `src/types/db.ts` (`pnpm types:gen`으로 재생성)

**Interfaces:**
- Produces: 스펙 §5.4 표의 키/값/단위/설명 그대로 upsert (`on conflict (key) do update`). `cost_ratio_target`, `cost_ratio_baseline`, `cost_improvement_target` 삭제. `update alarm_rules set enabled = false where name = '제조원가 상한 초과'`.

- [ ] **Step 1: pgTAP 테스트 작성** — `plan(6)`: `manhour_target = 16`, `manhour_baseline = 24`, `leadtime_target = 12`, `satisfaction_target = 4.5`, cost_ratio 3키 count = 0, `'제조원가 상한 초과'` enabled = false.
- [ ] **Step 2: 실패 확인** — `supabase test db` → 17 FAIL.
- [ ] **Step 3: migration 작성.** rollback: 신규 키 delete + 삭제된 3키 원래 값(10.0/15.0/33.0, `20260424000009_seed_baseline.sql`과 동일) 재삽입 + 알람 enabled=true.
- [ ] **Step 4: 통과 확인 + 타입 재생성** — `supabase db reset && supabase test db` PASS; `pnpm types:gen && pnpm typecheck` PASS.
- [ ] **Step 5: Commit** — `feat(db): seed revised KPI baselines/targets and disable cost-ratio alarm`

### Task 5: KPI 판정 함수 + 조회 훅

**Files:**
- Create: `src/utils/kpi.ts`, `src/utils/kpi.test.ts`
- Create: `src/hooks/useKpiTargets.ts`, `src/hooks/useManhourKpi.ts`, `src/hooks/useHrKpi.ts`

**Interfaces:**
- Consumes: Task 3 뷰, Task 2 테이블, Task 4 targets 키.
- Produces:
  - `type KpiDirection = 'higher' | 'lower'`
  - `type KpiStatus = 'achieved' | 'missed' | 'nodata'`
  - `evaluateKpi(value: number | null | undefined, target: number | null | undefined, direction: KpiDirection): KpiStatus` — value 또는 target이 null/undefined/NaN이면 `'nodata'`; higher는 `value >= target`, lower는 `value <= target`이면 achieved.
  - `improvementPct(baseline: number, current: number | null, direction: KpiDirection): number | null` — lower: `(baseline − current)/baseline×100`, higher: `(current − baseline)/baseline×100`, 0~100 클램프, baseline 0 또는 current null이면 null.
  - `export const KPI_PERIOD_DAYS = 30`
  - `useKpiTargets(): UseQueryResult<Record<string, number>>` — queryKey `['admin','targets']`를 공유하도록 `useTargets()` 결과를 `{key: value}`로 매핑(관리자 수정 시 invalidate가 그대로 반영됨).
  - `useManhourKpi(): UseQueryResult<{ lot_count: number; avg_man_hour: number | null; latest_man_hour: number | null } | null>` (`v_kpi_manhour`)
  - `useLeadtimeKpi(): UseQueryResult<{ lot_count: number; avg_lead_days: number | null } | null>` (`v_kpi_leadtime`)
  - `useRecentLotManhours(limit = 10): UseQueryResult<LotManhourRow[]>` — `v_lot_manhour` `order(ended_at desc).limit(limit)`; `LotManhourRow = { id; lot_no; started_at; ended_at; worker_count; work_hours; man_hour }`.
  - `useRecentLotLeadtimes(limit = 10): UseQueryResult<LotLeadtimeRow[]>` — `v_lot_leadtime` `order(shipped_at desc)`.
  - `useHrKpiRecords()` / `useLatestHrKpi()` — `HrKpiRecord = { id; measured_on: string; job_conversion_rate_pct: number | null; satisfaction_score: number | null; note: string | null }`; latest = `measured_on desc` 첫 행 또는 null. 쓰기 훅 `useUpsertHrKpi()`, `useDeleteHrKpi()` (queryKey `['hr-kpi']` invalidate). Postgres numeric은 문자열로 올 수 있으므로 훅에서 `Number()` 변환(null 유지).

- [ ] **Step 1: 테스트 작성** (`kpi.test.ts`): `evaluateKpi(1832, 1800, 'higher') === 'achieved'`; `evaluateKpi(17.5, 16, 'lower') === 'missed'`; `evaluateKpi(16, 16, 'lower') === 'achieved'`; `evaluateKpi(null, 16, 'lower') === 'nodata'`; `evaluateKpi(NaN, 16, 'lower') === 'nodata'`; `improvementPct(24, 16, 'lower')` ≈ 33.33; `improvementPct(1500, 1800, 'higher') === 20`; `improvementPct(24, 30, 'lower') === 0`; `improvementPct(24, null, 'lower') === null`; `improvementPct(0, 5, 'higher') === null`.
- [ ] **Step 2: 실패 확인** — `pnpm test src/utils/kpi.test.ts` FAIL.
- [ ] **Step 3: 구현** (`kpi.ts` + 훅 3파일).
- [ ] **Step 4: 통과 확인** — `pnpm test src/utils/kpi.test.ts && pnpm typecheck` PASS.
- [ ] **Step 5: Commit** — `feat(kpi): add KPI evaluation helpers and man-hour/lead-time/HR hooks`

### Task 6: KPI 페이지 — 공통/자율 성과지표 섹션

**Files:**
- Create: `src/components/kpi/PerformanceKpiCard.tsx`, `src/components/kpi/CommonKpiSection.tsx`, `src/components/kpi/AutonomousKpiSection.tsx`, `src/components/charts/LotManhourChart.tsx`
- Modify: `src/pages/KpiPage.tsx` (하드코딩 `TARGETS`, `useCostRatio*`, 6카드 섹션, 원가 진행바·원가 추이 차트 제거)
- Test: `src/pages/KpiPage.test.tsx` (갱신), `src/components/kpi/PerformanceKpiCard.test.tsx`

**Interfaces:**
- Consumes: Task 5 전부, 기존 `KpiCard`, `FormulaBox`/`Hi`/`FormulaLabel`, `Pill`, `useKpiData`.
- Produces:
  - `PerformanceKpiCard({ label, value: number | null, unit, digits?: number, baseline: number | null, target: number | null, direction: KpiDirection, noDataReason: string, formula: ReactNode, note?: string })` — `KpiCard` 래핑. sub 줄 `기존 {baseline} → 목표 {target} {unit}`; 배지 achieved=`<Pill variant="ok">목표 달성</Pill>`, missed=`<Pill variant="warn">미달</Pill>`, nodata=배지 없음; value null이면 값 `—` + `noDataReason` 문구.
  - `CommonKpiSection({ kpi: DailyKpi, targets: Record<string, number> })` — `<section aria-label="공통 성과지표">` 제목 "공통 성과지표", 카드 5개, 라벨 정확히: `생산성 (시간당 생산량)`, `품질 (불량률)`, `작업시간 / ea`, `원가 (LOT당 작업공수)`, `납기 (수주→출하)`. 원가 카드 unit `man-hour`, noDataReason `완료된 LOT 없음 (최근 30일)`, note `1 LOT = {lot_weight_kg}kg`, formula `투입인원 × 작업시간(LOT 시작~종료)` + 평균 대입값 + LOT 수. 납기 카드 unit `일`, noDataReason `출하된 LOT 없음 (최근 30일)`. 생산성 카드 note `자율지표 '시간당 생산량' 동일`.
  - `AutonomousKpiSection({ claimsCount: number, targets })` — `aria-label="자율 성과지표"`, 카드 3개 라벨: `인력 직무 전환율`, `직무 전환 후 만족도`, `고객 클레임`. 인력 카드 noDataReason `입력된 기록 없음`, note `기준일 {measured_on}`. 만족도 unit `/ 5.0`.
  - `LotManhourChart({ rows: LotManhourRow[], target: number })` — Chart.js Bar(LOT번호 x축, man_hour) + 목표선(점선, `chartColors.danger`) — `CostTrendChart` 옵션 관례 재사용.
  - KpiPage 하단 차트 영역: "시간대별 생산량 (오늘)" + "LOT별 작업공수 (최근 완료 10건)" (범례 `목표 {manhour_target}`). 오늘 생산량 진행바는 `targets.daily_production`로 유지. 결과 `KpiPage.tsx` 300줄 이하.

- [ ] **Step 1: 테스트 작성/갱신** —
  - `PerformanceKpiCard.test.tsx`: value 17.5/target 16/lower → "미달" + "기존 24 → 목표 16 man-hour" 텍스트; value null → "—"와 noDataReason 표시, "목표 달성"/"미달" 없음.
  - `KpiPage.test.tsx`: `useCostRatio` mock 제거, `useKpiTargets`(스펙 §5.4 값), `useManhourKpi`({lot_count:3, avg_man_hour:17.5, latest_man_hour:16.8}), `useLeadtimeKpi`({lot_count:2, avg_lead_days:13}), `useRecentLotManhours`([]), `useLatestHrKpi`(null) mock. 단언: 위 8개 라벨 모두 존재, `'공통 성과지표'`/`'자율 성과지표'` 제목, `'17.5'` 표시, 인력 카드 2개에 `'입력된 기록 없음'` 2회, `getAllByText(/산출식:/).length >= 8`, `'제조원가 비율'` 없음.
- [ ] **Step 2: 실패 확인** — `pnpm test src/pages/KpiPage.test.tsx src/components/kpi` FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm typecheck && pnpm lint` PASS; `wc -l src/pages/KpiPage.tsx src/components/kpi/*.tsx` 모두 ≤ 300.
- [ ] **Step 5: Commit** — `feat(kpi): rebuild KPI board around revised performance indicators`

### Task 7: "원가·납기" 탭 + LLM 컨텍스트 교체

**Files:**
- Modify: `src/pages/CostPage.tsx` (내용 교체 — 재공재고 UI 제거), `src/components/layout/TabBar.tsx:6`, `src/components/layout/MobileNav.tsx:7`
- Modify: `supabase/functions/llm-analyze/index.ts:80-90`, `supabase/functions/llm-analyze/prompts.ts`
- Test: `src/pages/CostPage.test.tsx` (신규), `tests/llm-analyze.test.ts` (갱신)

**Interfaces:**
- Consumes: Task 5 훅, `improvementPct`, 기존 `useCostImprovement`, `ResponseModal`.
- Produces:
  - 탭 라벨 `원가·납기` (경로 `/cost` 유지).
  - CostPage 섹션: 히어로 "LOT당 작업공수 (최근 30일 평균)" 값 + `기존 24 → 목표 16 man-hour` + 개선률 `{improvementPct}% / 목표 {(baseline−target)/baseline×100 → 33.3}%` + FormulaBox(`작업공수(man-hour) = 투입인원 × 작업시간(LOT 시작~종료)`, `1 LOT = 300kg`); "LOT별 작업공수" 표(LOT번호·시작·종료·작업시간(h)·투입인원·man-hour·목표 대비 Pill); "납기 (수주→출하)" 히어로(평균 일, `기존 15 → 목표 12일`) + LOT별 표(LOT번호·수주일·출하일·리드타임); 하단 LLM 버튼 문구 `원가(작업공수) 개선 방안 분석 요청`. 데이터 없으면 표 자리에 사유 문구.
  - llm-analyze `cost_improvement`: `v_cost_ratio`/`v_wip_flow` 조회를 `v_kpi_manhour`, `v_lot_manhour`(최근 10), `v_kpi_leadtime`, `targets` 조회로 교체. `buildCostImprovementContext(input: { kpi; manhour: {lot_count; avg_man_hour; latest_man_hour} | null; lots: {lot_no; worker_count; work_hours; man_hour}[]; leadtime: {lot_count; avg_lead_days} | null; targets: Record<string, number> }): string` — 컨텍스트에 `LOT당 작업공수 평균`, `목표 16`, `기존 24`, LOT별 행, 평균 리드타임 포함. 시스템 프롬프트의 "재공재고/제조원가 비율" 문구를 "1 LOT(300kg) 작업공수(man-hour) 절감" 관점으로 수정.
- [ ] **Step 1: 테스트 작성** — `CostPage.test.tsx`: 훅 mock(avg 17.5, lots 2행, leadtime 13) → `'LOT당 작업공수'`, `'기존 24 → 목표 16 man-hour'`, LOT번호 2개, `'납기 (수주→출하)'` 표시, `'재공재고'` 없음; 빈 데이터 → `'완료된 LOT 없음 (최근 30일)'`. `tests/llm-analyze.test.ts`: `buildCostImprovementContext` 결과에 `'작업공수'`와 `'16'` 포함, `'재공재고'` 미포함 단언으로 기존 cost 컨텍스트 단언 교체.
- [ ] **Step 2: 실패 확인** — `pnpm test src/pages/CostPage.test.tsx` FAIL; `pnpm test:integration` 해당 케이스 FAIL.
- [ ] **Step 3: 구현.** `useCostRatio.ts`는 더 이상 import되지 않으면 삭제.
- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm test:integration && pnpm typecheck && pnpm lint` PASS.
- [ ] **Step 5: Commit** — `feat(cost): replace WIP cost ratio with LOT man-hour and lead-time views`

### Task 8: LOT 관리 — 투입인원·수주일·출하일·시작/종료 정정

**Files:**
- Create: `src/components/admin/LotFormFields.tsx` (모달 폼 필드 분리 — `LotManagePage.tsx` 279줄 → 300줄 초과 방지)
- Modify: `src/pages/admin/LotManagePage.tsx`, `src/hooks/useAdminLots.ts` (`LotInput`), `src/hooks/useLots.ts` (`LotSummary`), `src/pages/LotHistoryPage.tsx` (상세 패널)
- Create: `src/utils/datetime.ts`, `src/utils/datetime.test.ts`
- Test: `src/pages/admin/LotManagePage.test.tsx` (갱신)

**Interfaces:**
- Consumes: Task 1 컬럼, Task 3 `v_lot_summary` 신규 컬럼.
- Produces:
  - `LotInput`에 `worker_count?: number | null; ordered_at?: string | null; shipped_at?: string | null; started_at?: string | null; ended_at?: string | null` 추가.
  - `LotSummary`에 `worker_count: number | null; ordered_at: string | null; shipped_at: string | null; work_hours: number | null; man_hour: number | null; lead_days: number | null`.
  - `toDatetimeLocal(iso: string | null): string` (로컬 시각 `YYYY-MM-DDTHH:mm`, null → `''`), `fromDatetimeLocal(v: string): string | null` (`''` → null, 그 외 `new Date(v).toISOString()`).
  - `LotFormFields({ form, setForm, clients })` — 기존 필드 + 라벨 정확히 `투입인원 (명)`(number, min 1), `수주일`(date), `출하일`(date), `시작 시각`(datetime-local), `종료 시각`(datetime-local). 빈 값 → null로 저장.
  - 목록 컬럼 추가: `투입인원`, `작업공수 (man-hour)`. LotHistory 상세: `투입인원`, `작업공수`, `수주일`, `출하일`, `리드타임 (일)`.
  - 저장 실패(DB 제약 위반) 시 기존 `toast.error('저장 실패: ...')` 관례.
- [ ] **Step 1: 테스트 작성** — `datetime.test.ts`: `fromDatetimeLocal('') === null`; `toDatetimeLocal(null) === ''`; 왕복(`fromDatetimeLocal(toDatetimeLocal(iso))`)이 분 단위까지 동일. `LotManagePage.test.tsx`: "LOT 등록" 모달 열면 5개 신규 라벨 존재; 투입인원 `3`, 수주일/출하일 입력 후 저장 시 `useCreateLot` mutateAsync 인자에 `worker_count: 3`, `ordered_at: '2026-11-02'` 포함; mutateAsync reject 시 `toast.error` 호출.
- [ ] **Step 2: 실패 확인** — `pnpm test src/pages/admin/LotManagePage.test.tsx src/utils/datetime.test.ts` FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm typecheck && pnpm lint` PASS; `wc -l src/pages/admin/LotManagePage.tsx` ≤ 300.
- [ ] **Step 5: Commit** — `feat(admin): capture worker count, order/ship dates and editable LOT times`

### Task 9: 관리자 "인력 지표" 탭

**Files:**
- Create: `src/pages/admin/HrKpiPage.tsx`, `src/pages/admin/HrKpiPage.test.tsx`
- Modify: `src/App.tsx` (route `/admin/hr-kpi`), `src/components/layout/TabBar.tsx`, `src/components/layout/MobileNav.tsx` (ADMIN_TABS에 `{ to: '/admin/hr-kpi', label: '인력 지표' }`, `목표값` 앞)

**Interfaces:**
- Consumes: Task 5 `useHrKpiRecords`, `useUpsertHrKpi`, `useDeleteHrKpi`, `HrKpiRecord`; 기존 `DataTable`, `Modal`, `FormField`, `ConfirmDialog`, `toast` (ClaimPage 패턴).
- Produces: 목록 컬럼 `측정일`, `직무 전환율 (%)`, `만족도 (점)`, `메모`, 편집/삭제. 모달 필드 라벨 `측정일 *`, `직무 전환율 (%)`, `만족도 (5점 척도)`, `메모`. 검증: 측정일 필수, 전환율 0~100, 만족도 0~5 — 위반 시 `toast.error` 후 저장 안 함. 둘 다 빈 값 허용(null).
- [ ] **Step 1: 테스트 작성** — 기록 2건 mock → 측정일 2개 표시; 등록 모달에서 만족도 `5.5` 입력 → `toast.error` 호출, upsert 미호출; 정상 입력(`2026-11-20`, `52`, `4.6`) → upsert 인자 `{ measured_on: '2026-11-20', job_conversion_rate_pct: 52, satisfaction_score: 4.6, note: null }`.
- [ ] **Step 2: 실패 확인** — `pnpm test src/pages/admin/HrKpiPage.test.tsx` FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm typecheck && pnpm lint` PASS.
- [ ] **Step 5: Commit** — `feat(admin): add HR KPI records page`

### Task 10: 장비 시뮬레이터 (HTTPS /ingest)

**Files:**
- Create: `scripts/simulate-devices.ts`, `scripts/simulate-devices.test.ts`, `.env.simulator.example`
- Modify: `vitest.config.ts` (`include`에 `'scripts/**/*.test.ts'` 추가), `.gitignore` (`.env.simulator`), `package.json` (`"sim": "node --env-file=.env.simulator scripts/simulate-devices.ts"`)

**Interfaces:**
- Produces (export, 순수 함수 — 난수는 `rand: () => number` 주입):
  - `type DeviceSpec = { code: string; kind: 'vision' | 'equipment'; ratio: number }` — `DEVICES: DeviceSpec[]` = `packaging_01`(equipment, 1.0), `vision_01`(vision, 1.0), `caser_01`(0.99), `taper_01`(0.985), `wrapper_01`(0.98), `conveyor_01`(0.98) — seed 장비 코드와 동일.
  - `toKstIso(d: Date): string` — 분 단위로 내린 `YYYY-MM-DDTHH:mm:00+09:00`.
  - `buildMinute(bucket: Date, rand: () => number): Array<{ code: string; body: object }>` — 포장기 `runtime_seconds` 55~60 정수, `output_count` 28~32; 비전 `total_inspected` = 포장 출력, defect ≈ 0.5~1.2%(반올림, 최소 0), unknown 0~1, `good = total − defect − unknown`, `inspection_time_seconds` 50~59.9; 하류 = `round(포장 출력 × ratio)`, runtime 55~60.
  - `type SendResult = 'ok' | 'duplicate' | 'error'`; `classifyResponse(status: number, body: unknown): SendResult` — 200 + `{duplicate:true}` → duplicate, 200 → ok, 그 외 error.
  - `parseArgs(argv: string[]): { mode: 'live' | 'backfill'; hours: number; offline: string[] }` — `--live`, `--backfill <hours>`, `--offline <code>`(반복 가능). 인자 없으면 live.
  - main(직접 실행 시에만, `import.meta.url === pathToFileURL(process.argv[1]).href`): env `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SIM_KEY_<CODE 대문자>` 읽기(누락 시 어떤 키가 없는지 출력 후 exit 1); `fetch(`${SUPABASE_URL}/functions/v1/ingest`, { method:'POST', headers: { Authorization: `Bearer ${anon}`, 'X-Device-Code', 'X-Api-Key', 'Content-Type': 'application/json' }, body })`. backfill: 지금−hours부터 분 단위 순차 전송(장비별 동시 6건씩). live: 다음 분 경계마다 직전 분 버킷 전송. offline 장비는 전송 생략. 종료/주기마다 장비별 ok/duplicate/error 카운트와 마지막 error 바디 출력. error는 중단하지 않음.
  - `.env.simulator.example`: `SUPABASE_URL=`, `SUPABASE_ANON_KEY=`, `SIM_KEY_PACKAGING_01=` … 6개 (값 비움, 주석으로 "관리자 > 장비 > 새 API 키 발급 값").
- [ ] **Step 1: 테스트 작성** — 고정 rand(`() => 0.5`)로: `buildMinute` 6건 반환, 코드 집합 = DEVICES; 비전 body `total_inspected === good_count + defect_count + unknown_count` (rand 0, 0.999 경계에서도); 포장 `runtime_seconds` 55~60 정수, 모든 `output_count >= 0`; `toKstIso(new Date('2026-11-02T01:30:45Z')) === '2026-11-02T10:30:00+09:00'`; `classifyResponse(200, {ok:true, duplicate:true}) === 'duplicate'`, `(200, {ok:true}) === 'ok'`, `(401, {error:'invalid_api_key'}) === 'error'`; `parseArgs(['--backfill','6','--offline','taper_01'])` → `{mode:'backfill', hours:6, offline:['taper_01']}`; `parseArgs([])` → live.
- [ ] **Step 2: 실패 확인** — `pnpm test scripts/simulate-devices.test.ts` FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm lint` PASS. 로컬 스모크: `supabase start` 상태에서 관리자 화면 또는 `fn_set_device_api_key` RPC로 6개 키 발급 → `.env.simulator` 작성 → `pnpm sim --backfill 1` → 출력에 장비별 ok 60 / error 0, 재실행 시 duplicate 60.
- [ ] **Step 5: Commit** — `feat(sim): add HTTPS ingest device simulator`

### Task 11: 운영 문서 + mock-seed + E2E + 전체 검증

**Files:**
- Modify: `docs/OPERATIONS.md` (새 절: "가상 실데이터 점검" — 키 발급 → `.env.simulator` → `pnpm sim --backfill 8` → `pnpm sim --live` → 화면 체크리스트; 업무 데이터 입력 시나리오(LOT 3건: 투입인원 3/4/3명, 수주일·출하일, 시작/종료; 인력 지표 1건); "시뮬레이션 데이터 정리" — 기간 변수로 `select count(*)` 확인 후 `delete from equipment_metrics / vision_inspector_metrics / alarms / ingest_logs where ... between :start and :end`, 테스트 LOT·인력 기록 삭제, "Cloud에서는 운영 담당자가 직접 실행" 명시)
- Modify: `supabase/mock-seed.sql` (완료 LOT 3건: 투입인원·시작/종료·수주/출하 포함, 인력 지표 1건 — 기존 `mock` 표기 관례)
- Modify: `e2e/kpi-render.spec.ts` (라벨 갱신: 8개 성과지표 라벨, 탭 `원가·납기`), Create: `e2e/kpi-revision.spec.ts` (관리자: 인력 지표 등록 → KPI 화면 `인력 직무 전환율` 카드에 값 표시; LOT 모달에 `투입인원 (명)` 필드 존재)
- Modify: `docs/DEV_NOTES.md` (§13 제목을 완료 상태로, KPI 수정 반영 요약 + 변경 이력 1줄), `README.md` (기능 목록의 제조원가 문구)

- [ ] **Step 1: E2E 갱신/작성** (위 단언).
- [ ] **Step 2: 로컬 전체 검증** — `supabase db reset && pnpm db:mock` 후 dev 서버로 `pnpm test:e2e` → PASS. dev 서버 종료 확인(별도 명령) 후 `pnpm lint && pnpm typecheck && pnpm test && pnpm build && supabase test db && pnpm test:integration` 전부 PASS.
- [ ] **Step 3: 문서 작성** (OPERATIONS/DEV_NOTES/README/mock-seed).
- [ ] **Step 4: 머지 후 잔존 확인용 grep** — `grep -rn "test.skip\|v_cost_ratio\|제조원가 비율" src e2e` → src·e2e에서 결과 없음(뷰 자체는 DB에 남음).
- [ ] **Step 5: Commit** — `docs: add simulator runbook and update KPI docs` / `test(e2e): cover revised KPI board and HR KPI input`
