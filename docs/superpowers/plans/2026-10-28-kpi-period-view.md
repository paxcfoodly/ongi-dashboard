# KPI 기간 조회 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KPI·AI·원가 화면에 기간 선택을 추가해 날짜별 데이터와 기간 합계·평균을 보여주고, 기간 모드에서는 설비 가동 상태를 숨긴다.

**Architecture:** KST 날짜별 집계 RPC `fn_kpi_daily`(migration 1건)를 추가하고, LOT·인력 지표는 기존 뷰와 테이블을 기간으로 필터한다. 기간은 URL 쿼리 `?from&to`로 보관하며, 쿼리가 없으면 기존 "오늘" 화면을 그대로 렌더한다. 집계 규칙은 `src/lib/services/`의 순수 함수로 둔다.

**Tech Stack:** Supabase(Postgres, pgTAP), React 18, react-router-dom 7, TanStack Query 5, Chart.js, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-kpi-period-view-design.md`

## Global Constraints

- 브랜치는 `feat/kpi-period-view`이다. 커밋 전에 `git branch --show-current`로 main이 아님을 확인한다.
- 코드 주석은 한국어로 쓴다. 커밋 prefix는 `feat:`/`fix:`/`test:`/`docs:`/`chore:`이고, 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙인다.
- `as any` 금지. 기존 훅처럼 `const sb = supabase as any;`를 쓸 때는 바로 위에 이유 주석과 `eslint-disable-next-line`을 둔다(기존 패턴).
- 비즈니스 로직(집계·기간 계산)은 `src/lib/services/`에만 둔다. 컴포넌트는 표시만 한다.
- 컴포넌트가 300줄을 넘을 것 같으면 분리하기 전에 사용자에게 먼저 보고한다.
- 기간 = KST 날짜 `YYYY-MM-DD` 양 끝 포함, 최대 366일, `from ≥ 2020-01-01`, `to ≤ KST 오늘`.
- "오늘" 모드(쿼리 없음)의 화면·숫자·기존 테스트는 바뀌면 안 된다.
- 비율 지표의 기간 값 = 총합 ÷ 총합. 일별 비율의 단순 평균은 금지.
- 데이터가 없는 날도 행으로 표시한다. 분모가 0이면 비율은 `null`이고, 화면에는 `—`로 표시한다.
- 기존 migration·뷰는 수정하지 않는다.

## Review Focus

1. **잘못된 URL 쿼리**: `from`만 있음, `2026-13-40`, `from>to`, 미래 `to`, 400일 기간. 크래시 없이 "오늘" 모드로 표시하고 경고 배너를 보여야 한다. → Task 2(parse), Task 5(배너)
2. **브라우저 TZ ≠ KST**: UTC 15:30(= KST 다음날 00:30)에 "오늘"과 프리셋이 KST 기준이어야 한다. → Task 2
3. **데이터 0인 날·분모 0**: 표에 행이 남고 비율 칸은 `—`여야 한다. NaN/Infinity/0%가 나오면 안 된다. → Task 3, Task 5
4. **월 경계 프리셋**: 1월 중순의 "지난 달" = 전년 12-01~12-31. 매월 1일의 "이번 달" = 1일~1일. → Task 2
5. **PostgREST numeric 문자열**: RPC의 `inspection_time_sec`, 뷰의 `man_hour`가 문자열로 올 때 합산이 문자열 연결이 되면 안 된다. → Task 4

---

### Task 1: `fn_kpi_daily` migration + rollback + pgTAP

**Files:**
- Create: `supabase/migrations/20261028000001_fn_kpi_daily.sql`
- Create: `supabase/rollbacks/20261028000001_fn_kpi_daily.sql`
- Test: `supabase/tests/23_fn_kpi_daily.sql`

**Interfaces:**
- Produces: `fn_kpi_daily(p_from date, p_to date) returns table(day date, production int, runtime_sec int, inspected int, defects int, unknown int, inspection_time_sec numeric, claims int)`. `day` 오름차순이며, 기간의 모든 날짜를 한 행씩 반환한다.

- [ ] **Step 1: pgTAP 작성** (`begin; select plan(N); … select * from finish(); rollback;` 기존 형식)
  - Fixture: 테스트 전용 장비를 insert한다. 기존 seed 장비와 섞이지 않도록, 집계 기대값은 **seed 장비 데이터가 없는 날짜 `2026-01-05`~`2026-01-07`**로 잡는다.
    - `primary_output` 장비 P(active)
    - `primary_output` 장비 X(active=false)
    - role이 다른 equipment 장비 Q
    - vision_inspector V(active)
    - `devices` insert 컬럼은 `supabase/tests/03_equipment_metrics.sql` 형식을 따른다.
  - P 데이터: `2026-01-05 10:00+09` (58s, 28ea), `2026-01-05 10:01+09` (54s, 30ea), `2026-01-05 23:59+09` (60s, 5ea), `2026-01-06 00:00+09` (60s, 7ea).
  - X·Q 데이터: `2026-01-05 10:00+09`에 각각 (60s, 1000ea). 집계에서 제외되어야 한다.
  - V 데이터: `2026-01-05 10:00+09`에 total 30 = good 28 + defect 1 + unknown 1, 55.5s.
  - claims: `received_at = 2026-01-06 23:30+09` 1건. 다음 날로 넘어가지 않아야 한다.
  - 단언:
    - `select count(*) from fn_kpi_daily('2026-01-05','2026-01-07')` = 3. 01-07은 0 채움 행이다.
    - 01-05 행 = `(production 63, runtime_sec 172, inspected 30, defects 1, unknown 1, inspection_time_sec 55.5, claims 0)`
    - 01-06 행 = `(7, 60, 0, 0, 0, 0, 1)`
    - 01-07 행 = 전부 0
    - `throws_ok`:
      - `('2026-01-07','2026-01-05')` (from > to)
      - `(current_date+1, current_date+1)`. 미래 판정은 KST 오늘 기준: `(now() at time zone 'Asia/Seoul')::date`
      - `('2025-01-01','2026-01-02')` (367일)
      - `('2019-12-31','2020-01-01')`
    - `set local role anon;` 후 `throws_ok(... '42501')`, `reset role;`
    - `has_function_privilege('authenticated','fn_kpi_daily(date,date)','execute')`
- [ ] **Step 2: 실패 확인**
  - Run: `supabase test db` (로컬 스택이 떠 있어야 함. 앞서 e2e를 돌렸다면 `supabase db reset` 먼저)
  - Expected: `23_fn_kpi_daily.sql` FAIL (function does not exist)
- [ ] **Step 3: migration 작성**
  - 스펙 §4.1을 그대로 구현한다: plpgsql, `stable security invoker set search_path = public`.
  - 유효성 위반은 `raise exception`(기본 SQLSTATE P0001)으로 처리한다.
  - `generate_series(p_from, p_to, interval '1 day')::date`에 장비·클레임 일별 집계를 left join하고 `coalesce(…,0)`으로 채운다.
  - 범위 필터는 `bucket_at >= p_from::timestamp at time zone 'Asia/Seoul' and bucket_at < (p_to + 1)::timestamp at time zone 'Asia/Seoul'`이다.
  - 권한: `revoke all on function fn_kpi_daily(date,date) from public, anon; grant execute … to authenticated;`
  - 파일 머리 주석에 의도를 한 줄로 쓴다.
- [ ] **Step 4: rollback 작성**
  - `drop function if exists fn_kpi_daily(date, date);`
  - 머리 주석: `[프론트엔드] 이 롤백 전에 프론트엔드를 이전 배포로 먼저 되돌린다 (기간 조회가 이 함수를 호출하므로).`
- [ ] **Step 5: 통과 확인**
  - Run: `supabase db reset && supabase test db`
  - Expected: 전체 PASS(기존 00~22 포함)
- [ ] **Step 6: Commit**: `feat(db): add fn_kpi_daily for KST per-day KPI aggregation`

### Task 2: 기간 계산 서비스 (`period.ts`)

**Files:**
- Create: `src/lib/services/period.ts`
- Test: `src/lib/services/period.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Period { from: string; to: string } // KST YYYY-MM-DD, 양 끝 포함
  export function kstToday(now?: Date): string
  export function addDays(day: string, n: number): string
  export function periodDays(p: Period): number
  export function validatePeriod(p: Period, now?: Date): string | null
  export function parsePeriodParams(params: URLSearchParams, now?: Date): { period: Period | null; error: string | null }
  export type PresetKey = 'today' | '7d' | '30d' | '60d' | '90d' | 'thisMonth' | 'lastMonth'
  export const PERIOD_PRESETS: ReadonlyArray<{ key: PresetKey; label: string }>
  export function presetPeriod(key: Exclude<PresetKey, 'today'>, now?: Date): Period
  export function navSearch(targetPath: string, currentSearch: string): string
  ```
- 정확한 문구:
  - 프리셋 라벨: `오늘`, `최근 7일`, `최근 30일`, `최근 60일`, `최근 90일`, `이번 달`, `지난 달`
  - `validatePeriod` 오류: `'날짜 형식이 올바르지 않습니다.'`, `'시작일이 종료일보다 늦습니다.'`, `'종료일은 오늘 이후일 수 없습니다.'`, `'조회 기간은 최대 366일입니다.'`, `'시작일은 2020-01-01 이후여야 합니다.'`
  - `parsePeriodParams`
    - 쿼리가 둘 다 없으면 `{period:null, error:null}`
    - 하나만 있거나 유효성 실패면 `{period:null, error:'잘못된 조회 기간이라 오늘 기준으로 표시합니다.'}`
  - `navSearch`: `targetPath`가 `/kpi`, `/ai`, `/cost` 중 하나면 `currentSearch`의 `from`·`to`만 남긴 `?from=…&to=…`를 반환한다. 아니면 `''`.

- [ ] **Step 1: 테스트 작성.** 고정 시각 `NOW = new Date('2026-10-27T15:30:00Z')`(KST 2026-10-28 00:30)를 쓴다.
  - `kstToday(NOW) === '2026-10-28'`
  - `addDays('2026-02-28', 1) === '2026-03-01'`, `addDays('2026-01-01', -1) === '2025-12-31'`
  - `periodDays({from:'2026-10-01',to:'2026-10-28'}) === 28`
  - `presetPeriod('7d', NOW)` → `{from:'2026-10-22', to:'2026-10-28'}`, `'90d'` → `from:'2026-07-31'`
  - `presetPeriod('thisMonth', new Date('2026-10-31T16:00:00Z'))` → `{from:'2026-11-01',to:'2026-11-01'}`
  - `presetPeriod('lastMonth', new Date('2026-01-15T03:00:00Z'))` → `{from:'2025-12-01',to:'2025-12-31'}`
  - `validatePeriod`: 각 오류 문구별 1케이스. 366일 정확히(`2025-10-28`~`2026-10-28`)는 `null`, 367일은 오류.
  - `parsePeriodParams`: 빈 쿼리, `from`만, `from=2026-13-40&to=2026-10-01`, 정상 쿼리
  - `navSearch('/ai','?from=2026-10-01&to=2026-10-28&x=1') === '?from=2026-10-01&to=2026-10-28'`, `navSearch('/lot', …) === ''`, `navSearch('/ai','') === ''`
- [ ] **Step 2: 실패 확인**: `pnpm vitest run src/lib/services/period.test.ts` → FAIL (module not found)
- [ ] **Step 3: 구현.** 날짜 문자열 연산은 UTC 자정 `Date`(`new Date(day + 'T00:00:00Z')`)로 한다. `kstToday`는 `toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })`(기존 `hrMeasuredOnError`와 같은 방식)이다. 형식 검사는 정규식 + 왕복 변환으로 존재하지 않는 날짜를 거른다.
- [ ] **Step 4: 통과 확인**: 같은 명령 → PASS
- [ ] **Step 5: Commit**: `feat: add KST period parsing and presets service`

### Task 3: 기간 집계 서비스 (`periodKpi.ts`)

**Files:**
- Create: `src/lib/services/periodKpi.ts`
- Test: `src/lib/services/periodKpi.test.ts`

**Interfaces:**
- Consumes: `LotManhourRow`, `LotLeadtimeRow`, `ManhourKpi`, `LeadtimeKpi` (`src/hooks/useManhourKpi.ts`)
- Produces:
  ```ts
  export interface DailyRow { day: string; production: number; runtime_sec: number; inspected: number; defects: number; unknown: number; inspection_time_sec: number; claims: number }
  export interface Ratios { hourly_production: number | null; work_time_per_ea: number | null; defect_rate_pct: number | null; throughput_ea_per_hr: number | null; recheck_rate_pct: number | null }
  export type Totals = Omit<DailyRow, 'day'> & Ratios & { days: number }
  export function computeRatios(t: Omit<DailyRow, 'day'>): Ratios
  export function summarizeDaily(rows: DailyRow[]): Totals
  export function dailyAchievementPct(production: number, dailyTarget: number | undefined): number | null
  export function summarizeManhour(rowsDesc: LotManhourRow[]): ManhourKpi & { total_man_hour: number | null }
  export function summarizeLeadtime(rows: LotLeadtimeRow[]): LeadtimeKpi
  ```
- 반올림은 기존 뷰와 같다:
  - `hourly_production`·`throughput_ea_per_hr`: 정수
  - `work_time_per_ea`·`defect_rate_pct`·`recheck_rate_pct`: 소수 2자리
  - `avg_man_hour`: 2자리
  - `avg_lead_days`: 1자리
  - `dailyAchievementPct`: 1자리
- 산식:
  - `hourly = production / (runtime_sec/3600)`
  - `work_time = runtime_sec / production`
  - `defect = defects/inspected*100`
  - `throughput = inspected/(inspection_time_sec/3600)`
  - `recheck = unknown/inspected*100`
  - 분모가 0이면 `null`

- [ ] **Step 1: 테스트 작성**
  - `computeRatios({production:58, runtime_sec:112, …})`의 `hourly_production === 1864`, `work_time_per_ea === 1.93`
  - **가중 평균 검증**: 일1 `{production:100, runtime_sec:3600, inspected:100, defects:10}`, 일2 `{production:900, runtime_sec:3600, inspected:900, defects:0}`
    - `summarizeDaily(...).defect_rate_pct === 1` (단순평균이면 5)
    - `hourly_production === 500`
    - `production === 1000`, `days === 2`
  - 전부 0인 행 1개 → 모든 비율 `null`, 합계 0. `summarizeDaily([])` → `days 0`, 비율 `null`
  - `dailyAchievementPct(7500, 15000) === 50`, `(100, undefined) === null`, `(100, 0) === null`
  - `summarizeManhour([{man_hour:16,…},{man_hour:19,…},{man_hour:null,…}])` → `{lot_count:2, avg_man_hour:17.5, total_man_hour:35, latest_man_hour:16}`. 빈 배열 → `{lot_count:0, avg_man_hour:null, total_man_hour:null, latest_man_hour:null}`
  - `summarizeLeadtime([{lead_days:10},{lead_days:13}])` → `{lot_count:2, avg_lead_days:11.5}`
- [ ] **Step 2: 실패 확인**: `pnpm vitest run src/lib/services/periodKpi.test.ts` → FAIL
- [ ] **Step 3: 구현** (위 시그니처·산식 그대로)
- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: Commit**: `feat: add period KPI aggregation service (sum vs weighted average)`

### Task 4: 기간 훅

**Files:**
- Create: `src/hooks/usePeriod.ts`, `src/hooks/usePeriodKpi.ts`
- Test: `src/hooks/usePeriod.test.tsx`, `src/hooks/usePeriodKpi.test.tsx`

**Interfaces:**
- Consumes: Task 2 `Period`, `parsePeriodParams`, `addDays`. Task 3 `DailyRow`. `pickLatestHrKpi`, `LatestHrKpi` (`useHrKpi.ts`). `LotManhourRow`, `LotLeadtimeRow`.
- Produces:
  ```ts
  // usePeriod.ts
  export function usePeriod(): { period: Period | null; error: string | null; setPeriod: (p: Period | null) => void }
  // usePeriodKpi.ts
  export function usePeriodDaily(period: Period | null)        // useQuery<DailyRow[]>, key ['period','daily',from,to]
  export function usePeriodLotManhours(period: Period | null)  // useQuery<LotManhourRow[]>, ended_at desc
  export function usePeriodLotLeadtimes(period: Period | null) // useQuery<LotLeadtimeRow[]>, shipped_at desc
  export function usePeriodHrKpi(period: Period | null)        // useQuery<…, LatestHrKpi>
  ```
- `usePeriod`는 `useSearchParams`를 쓴다. `setPeriod(p)`는 `from`·`to`를 설정하고, `setPeriod(null)`은 둘 다 지운다(다른 쿼리는 유지).
- 모든 기간 훅은 `enabled: period != null`이다. 쿼리 내용:
  - daily: `sb.rpc('fn_kpi_daily', { p_from, p_to })`. 각 숫자 필드는 `Number()`로 변환한다.
  - manhour: `v_lot_manhour`, `.gte('ended_at', `${from}T00:00:00+09:00`)`, `.lt('ended_at', `${addDays(to,1)}T00:00:00+09:00`)`, `.order('ended_at',{ascending:false})`. limit 없음.
  - leadtime: `v_lot_leadtime`, `.gte('shipped_at', from)`, `.lte('shipped_at', to)`, `.order('shipped_at',{ascending:false})`
  - hr: `hr_kpi_records`, `.gte('measured_on', from)`, `.lte('measured_on', to)`, `.order('measured_on',{ascending:false})`, `select: pickLatestHrKpi`
  - numeric 변환은 기존 `num` 패턴을 따른다. 오류는 throw한다.

- [ ] **Step 1: 테스트 작성** (supabase 체인 목은 `useLots.test.tsx` 패턴에 `rpc`, `lt`를 추가)
  - `usePeriod`: `MemoryRouter initialEntries={['/kpi?from=2026-10-01&to=2026-10-07&x=1']}`
    - → `period` 일치
    - `setPeriod(null)` 후 location.search === `'?x=1'`
  - `usePeriod` 잘못된 쿼리 → `period null`, `error` 문구 일치
  - `usePeriodDaily`: RPC가 `{inspection_time_sec:'55.50', production:'63', …}`를 반환할 때 `inspection_time_sec === 55.5`, `production === 63`(number). `rpc`가 `('fn_kpi_daily', {p_from:'2026-01-05', p_to:'2026-01-07'})`로 호출됐는지 확인
  - `usePeriodLotManhours`: `lt`가 `('ended_at','2026-10-08T00:00:00+09:00')`로 호출되고, `man_hour:'16.00'` → `16`
  - `usePeriodDaily(null)`: `rpc` 호출 안 됨
- [ ] **Step 2: 실패 확인**: `pnpm vitest run src/hooks/usePeriod` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: Commit**: `feat: add period URL state and period data hooks`

### Task 5: 기간 선택 UI + 날짜별 표 + 탭 쿼리 유지

**Files:**
- Create: `src/components/period/PeriodPicker.tsx`, `src/components/period/DailyTable.tsx`
- Modify: `src/components/layout/TabBar.tsx`, `src/components/layout/MobileNav.tsx`
- Test: `src/components/period/PeriodPicker.test.tsx`, `src/components/period/DailyTable.test.tsx`, `src/components/layout/TabBar.test.tsx`(추가)

**Interfaces:**
- Consumes: Task 2 `PERIOD_PRESETS`, `presetPeriod`, `periodDays`, `validatePeriod`, `kstToday`, `navSearch`. Task 4 `usePeriod`.
- Produces:
  ```ts
  export function PeriodPicker(): JSX.Element
  export interface DailyColumn<T> { header: string; cell: (row: T) => string; total: string; agg: 'sum' | 'avg' | 'none' }
  export function DailyTable<T extends { day: string }>(props: { title: string; rows: T[]; columns: DailyColumn<T>[] }): JSX.Element
  ```
- PeriodPicker:
  - 프리셋 버튼(`aria-pressed`로 현재 선택 표시. 쿼리 없음 = `오늘`. 현재 기간과 `presetPeriod` 결과가 같으면 그 프리셋)
    - `오늘` 클릭 = `setPeriod(null)`
  - `<label>시작일</label>`·`<label>종료일</label>` date input(`max=kstToday()`), `조회` 버튼
    - 조회 시 `validatePeriod` 오류가 있으면 `role="alert"`로 문구를 표시하고 이동하지 않는다.
  - 기간 모드 배너: `조회 기간 {from} ~ {to} ({n}일) · 실시간 아님`
  - `usePeriod().error`가 있으면 `role="alert"` 배너로 그 문구를 표시한다.
- DailyTable:
  - 첫 열 머리는 `날짜`이고 이어서 `columns`가 온다.
  - `<tfoot>` 한 행: 첫 칸 `기간 합계·평균`. 각 칸은 `agg==='sum'`이면 `합계 {total}`, `'avg'`면 `평균 {total}`, `'none'`이면 `—`
  - 가로 스크롤(`overflow-x-auto`)
- TabBar·MobileNav: 링크 `to`를 `{ pathname: t.to, search: navSearch(t.to, location.search) }`로 바꾼다. 활성 표시는 그대로다.

- [ ] **Step 1: 테스트 작성**
  - PeriodPicker: `vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T15:30:00Z'))`, `MemoryRouter`
    - `최근 7일` 클릭 → location.search === `'?from=2026-10-22&to=2026-10-28'`, 배너 `조회 기간 2026-10-22 ~ 2026-10-28 (7일) · 실시간 아님`
    - 시작일 `2026-10-10`, 종료일 `2026-10-01` 입력 후 `조회` → alert `시작일이 종료일보다 늦습니다.`, search 변화 없음
    - `?from=2026-10-01` 진입 → alert `잘못된 조회 기간이라 오늘 기준으로 표시합니다.`, `오늘` 버튼 `aria-pressed=true`
  - DailyTable: 2행 + 컬럼(sum/avg/none 각 1개) → tbody 2행, tfoot에 `합계 …`, `평균 …`, `—`. 셀 함수가 `—`를 반환하면 그대로 표시
  - TabBar: `/kpi?from=2026-10-01&to=2026-10-07`에서 `AI 성능지표` 링크 href에 `?from=2026-10-01&to=2026-10-07`가 포함되고, `LOT 이력` 링크 href는 `/lot`
- [ ] **Step 2: 실패 확인**: `pnpm vitest run src/components/period src/components/layout` → FAIL
- [ ] **Step 3: 구현** (기존 Tailwind 토큰 `bg-surface border-border text-text-dim` 등과 `Button` 컴포넌트 재사용)
- [ ] **Step 4: 통과 확인**: PASS, 기존 `TabBar.test.tsx`도 PASS
- [ ] **Step 5: Commit**: `feat: add period picker, daily table, and keep period across KPI tabs`

### Task 6: KPI 화면 기간 모드

**Files:**
- Create: `src/components/kpi/KpiPeriodView.tsx`
- Modify: `src/pages/KpiPage.tsx`, `src/components/kpi/CommonKpiSection.tsx`, `src/components/kpi/AutonomousKpiSection.tsx`
- Test: `src/pages/KpiPage.test.tsx`(기간 케이스 추가), `src/components/kpi/CommonKpiSection.test.tsx`, `src/components/kpi/AutonomousKpiSection.test.tsx`

**Interfaces:**
- Consumes: Task 3 `summarizeDaily`, `computeRatios`, `dailyAchievementPct`, `summarizeManhour`, `summarizeLeadtime`. Task 4 훅들. Task 5 `PeriodPicker`, `DailyTable`.
- Produces / 변경 시그니처:
  ```ts
  CommonKpiSection({ kpi, targets, scope = 'today', manhour, leadtime }: { kpi: DailyKpi; targets: Record<string, number>; scope?: 'today' | 'period'; manhour?: ManhourKpi | null; leadtime?: LeadtimeKpi | null })
  AutonomousKpiSection({ claimsCount, targets, scope = 'today', periodHr }: { …기존; scope?: 'today' | 'period'; periodHr?: LatestHrKpi })
  KpiPeriodView({ period }: { period: Period })
  ```
- `scope='today'`면 기존 동작을 바이트 단위로 유지한다(내부 훅 사용, 기존 문구). `scope='period'`면 전달받은 값을 쓰고 문구를 바꾼다.
  - noDataReason: `기간 내 생산 실적 없음`, `기간 내 검사 실적 없음`, `완료된 LOT 없음 (선택 기간)`, `출하된 LOT 없음 (선택 기간)`, 인력 `기간 내 기록 없음`
  - 산출식 박스의 출처 `lots (선택 기간)`
  - 생산성·품질·작업시간 산출식 박스 첫 줄 앞에 `기간 총합 기준 · `
  - 클레임 note `선택 기간 합계 (목표는 분기 기준)`
- KpiPeriodView는 `Totals`를 `DailyKpi`로 매핑한다(`today_production←production`, `runtime_sec_today←runtime_sec`, `claims_count←claims`, 비율 `null→0`). `hasProduction`·`hasInspection` 가드가 이미 0을 걸러준다. 렌더 순서:
  1. CommonKpiSection(period)
  2. AutonomousKpiSection(period)
  3. `일자별 생산량 (선택 기간)` 차트: `HourlyProductionChart`에 `{hour: day.slice(5), output: production}`
  4. `LOT별 작업공수 (선택 기간 · 최근 10건)` 차트
  5. DailyTable `날짜별 KPI`. 컬럼과 합계 행:
     - 생산수량: sum, 정수
     - 가동시간(h): sum, `(sec/3600).toFixed(1)`
     - 시간당 생산량: avg, 정수
     - 작업시간/ea: avg, `toFixed(2)`
     - 일 목표 달성률: none, `x.x%`
     - 검사수: sum
     - 불량수: sum
     - 불량률: avg, `x.xx%`
     - 클레임: sum
     - `null`은 `—`
- KpiPage: 맨 위에 `<PeriodPicker />`를 둔다.
  - `period`가 있으면 `KpiPeriodView`를 렌더하고 "오늘 목표 달성률"·"시간대별 생산량" 차트 줄·**설비별 가동 상태**는 렌더하지 않는다.
  - 최근 알람 섹션은 두 모드 모두 렌더한다.
  - 기존 `isLoading` 조기 반환은 오늘 모드에만 적용한다.
  - 훅 호출 순서가 조건 없이 고정되어야 한다.

- [ ] **Step 1: 테스트 작성** (기존 목 유지, `usePeriodKpi` 목 추가, `MemoryRouter initialEntries`로 모드 전환)
  - 오늘 모드(`/kpi`): 기존 테스트 전부 그대로 통과하고, `설비별 가동 상태` 텍스트가 존재한다.
  - 기간 모드(`/kpi?from=2026-01-05&to=2026-01-06`). daily 목:
    - `[{day:'2026-01-05', production:58, runtime_sec:112, inspected:30, defects:1, unknown:1, inspection_time_sec:55.5, claims:0}, {day:'2026-01-06', all 0}]`
    - 기대:
      - `설비별 가동 상태` 없음, `오늘 목표 달성률` 없음
      - `날짜별 KPI` 표에 `2026-01-05`, `2026-01-06` 행이 있다.
      - tfoot에 `합계 58`, `평균 1,864`가 있다.
      - 01-06 행의 시간당 생산량 칸 `—`
      - 생산성 카드 값 `1,864`
      - `최근 알람` 존재
  - CommonKpiSection `scope='period'` + `manhour={lot_count:0, avg_man_hour:null,…}` → `완료된 LOT 없음 (선택 기간)`
  - AutonomousKpiSection `scope='period'` + `periodHr={job:null,satisfaction:null}` → `기간 내 기록 없음` 2개, `선택 기간 합계 (목표는 분기 기준)`
- [ ] **Step 2: 실패 확인**: `pnpm vitest run src/pages/KpiPage.test.tsx src/components/kpi` → 새 케이스 FAIL
- [ ] **Step 3: 구현.** `wc -l`로 KpiPage·CommonKpiSection·KpiPeriodView가 300줄 이하인지 확인한다. 넘으면 멈추고 보고한다.
- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: Commit**: `feat(kpi): add period mode with daily table and hide device status`

### Task 7: AI 화면 기간 모드

**Files:**
- Modify: `src/pages/AiPage.tsx`, `src/components/charts/AiTrendChart.tsx`(데이터 타입을 `(number | null)[]`로)
- Test: `src/pages/AiPage.test.tsx`(신규)

**Interfaces:**
- Consumes: Task 3 `summarizeDaily`, `computeRatios`. Task 4 `usePeriod`, `usePeriodDaily`. Task 5 `PeriodPicker`, `DailyTable`.
- AiPage 동작:
  - 맨 위에 `<PeriodPicker />`
  - 기간 모드에서는 `Totals`를 `AiMetrics`로 매핑해 같은 세 카드를 렌더한다(`total_inspected←inspected`, `defect_count←defects`, `unknown_count←unknown`, `total_inspection_time_sec←inspection_time_sec`, 비율 `null→0`).
  - 추이 차트 제목은 `AI 성능 추이 (선택 기간)`. labels는 `day.slice(5)`, 값은 일별 `computeRatios`(`null` 유지)
  - 차트 아래 DailyTable `날짜별 AI 성능`. 컬럼과 합계 행:
    - 검사수: sum
    - 불량수: sum
    - 재검수: sum
    - 검사시간(h): sum, 1자리
    - 불량 검출율: avg, `x.xx%`
    - 처리량: avg, 정수
    - 재검율: avg, `x.xx%`
  - 오늘 모드는 그대로 둔다. 로딩 조기 반환은 오늘 모드에만 적용한다.
- [ ] **Step 1: 테스트 작성**
  - 오늘 모드: `useAiMetrics` 목 값이 카드에 표시되고 `AI 성능 추이 (최근 7일)` 제목이 유지된다.
  - 기간 모드: Task 6과 같은 daily 목 → `날짜별 AI 성능` 표에 `합계 30`(검사수)과 `평균 3.33%`(불량 검출율 = 1/30)가 있다. 01-06 불량 검출율 칸 `—`
  - chart.js는 `vi.mock('react-chartjs-2', …)`로 대체한다(기존 테스트에 패턴이 있으면 따른다).
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: Commit**: `feat(ai): add period mode with daily AI metrics table`

### Task 8: 원가·납기 화면 기간 모드

**Files:**
- Modify: `src/pages/CostPage.tsx`, `src/components/cost/ManhourSection.tsx`, `src/components/cost/LeadtimeSection.tsx`
- Test: `src/pages/CostPage.test.tsx`(케이스 추가)

**Interfaces:**
- Consumes: Task 3 `summarizeManhour`, `summarizeLeadtime`. Task 4 `usePeriod`, `usePeriodLotManhours`, `usePeriodLotLeadtimes`. Task 5 `PeriodPicker`.
- 변경 시그니처:
  - `ManhourSection` props: `scope?: 'recent' | 'period'`(기본 `'recent'`), `totalManhour?: number | null`
  - `LeadtimeSection` props: `scope?: 'recent' | 'period'`(기본 `'recent'`)
  - `'recent'`면 기존 문구와 동작을 그대로 유지한다.
- `scope='period'` 문구:
  - 작업공수 히어로 라벨 `LOT당 작업공수 (선택 기간 평균)`, 보조 줄 `완료 LOT {n}건 · 총 {x.x} man-hour`
  - 없음 문구 `완료된 LOT 없음 (선택 기간)`
  - 표 제목 `LOT별 작업공수 (선택 기간 · {n}건)`
  - 납기 보조 줄 `출하 LOT {n}건`, 없음 문구 `출하 완료된 LOT 없음 (선택 기간)`, 표 제목 `LOT별 리드타임 (선택 기간 · {n}건)`
  - 표는 최대 500행이다. 초과 시 표 아래에 `최근 500건만 표시 (평균·합계는 전체 기준)`
- CostPage: 맨 위에 `<PeriodPicker />`. LLM 버튼 바로 아래에 `<div className="text-[11px] text-text-muted mt-1">최근 30일 기준</div>`를 둔다(두 모드 공통).
- [ ] **Step 1: 테스트 작성**
  - 기존 케이스는 그대로 통과해야 한다(`MemoryRouter`로 감싸는 수정만 허용).
  - 기간 모드(`/cost?from=2026-10-01&to=2026-10-28`), 기간 LOT 목 2건(man_hour 16, 19)
    - → `LOT당 작업공수 (선택 기간 평균)`, 값 `17.5`, `완료 LOT 2건 · 총 35.0 man-hour`, `LOT별 작업공수 (선택 기간 · 2건)`
  - 기간 리드타임 목 0건 → `출하 완료된 LOT 없음 (선택 기간)`
  - `최근 30일 기준` 문구 존재
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: Commit**: `feat(cost): add period mode for man-hour and lead time`

### Task 9: E2E + 전체 검증

**Files:**
- Create: `e2e/kpi-period.spec.ts`

- [ ] **Step 1: e2e 작성** (로그인 beforeEach는 `kpi-revision.spec.ts`와 같다)
  - 테스트 1: `최근 7일` 클릭
    - → URL `/from=\d{4}-\d{2}-\d{2}&to=/`
    - `날짜별 KPI` 표 tbody 7행, `기간 합계·평균` 보임
    - `설비별 가동 상태` 안 보임
    - `AI 성능지표` 탭 클릭 → URL에 같은 `from` 유지, `날짜별 AI 성능` 보임
    - `원가·납기` 탭 → `from` 유지, `LOT당 작업공수 (선택 기간 평균)` 보임
    - `실시간 KPI` 탭 → `오늘` 클릭 → URL에 `from` 없음, `설비별 가동 상태` 보임
  - 테스트 2 (`SERVICE_KEY` 있을 때만, 없으면 `test.skip(!SERVICE_KEY, …)`)
    - REST로 `devices?role=eq.primary_output&active=eq.true&select=id&limit=1` 조회
    - `equipment_metrics`에 `2026-01-05T10:00:00+09:00` (58, 28)과 `10:01` (54, 30)을 insert
    - `/kpi?from=2026-01-05&to=2026-01-05` 이동
    - 기대: 생산성 카드 `1,864`, tfoot `합계 58`
    - 정리: `equipment_metrics?bucket_at=gte.2026-01-05T00:00:00%2B09:00&bucket_at=lt.2026-01-06T00:00:00%2B09:00&device_id=eq.{id}`를 DELETE
- [ ] **Step 2: 실행.** dev 서버가 떠 있으면 내리고 진행한다(Living Doc). `supabase db reset` 후 `supabase test db` → `pnpm test:e2e`
  - Expected: 신규 2건 + 기존 e2e 전부 PASS
- [ ] **Step 3: 전체 게이트**
  - `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. 각 명령을 따로 실행하고 결과를 확인한다.
  - Expected: 모두 성공, `--max-warnings 0` 통과
- [ ] **Step 4: 잔존 확인**: `git grep -n "test.skip\|TODO" -- e2e src supabase/tests`. 신규로 남긴 것이 없어야 한다(테스트 2의 SERVICE_KEY 조건부 skip은 예외).
- [ ] **Step 5: Commit**: `test(e2e): cover period view across KPI, AI, cost tabs`
