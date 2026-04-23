# Phase 2: 모니터링 탭 구현 (Dashboards)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4개 뷰어 탭(실시간 KPI / AI 성능지표 / 제조원가 / LOT 이력)이 실데이터와 연동되어 동작하고, 차트·산출식 박스·진행률 바·공정 흐름도 등이 샘플 HTML과 동일한 시각적 완성도로 표시되는 상태.

**Architecture:** Postgres 뷰 5개로 KPI 산출 로직을 DB에 캡슐화, react-query 30초 폴링으로 프론트가 뷰를 쿼리. 공통 UI 컴포넌트 라이브러리(KpiCard, FormulaBox, ChartCard 등)로 4개 페이지를 빠르게 조립. 차트는 Chart.js (react-chartjs-2 래퍼) + 프로젝트 디자인 토큰.

**Tech Stack (Phase 1에서 확정):** Vite + React + TS + Tailwind. 추가 설치: `chart.js`, `react-chartjs-2`, `date-fns`.

**Phase 2 완료 조건:**
- `pnpm dev`로 로그인 후 4개 탭(`/kpi`, `/ai`, `/cost`, `/lot`)이 실데이터로 렌더링
- 모든 KPI 카드 하단에 산출식 박스 표시
- 시드 + 목업 데이터로 시각 확인 가능 (공장 가동 시뮬레이션)
- `pnpm test`, `supabase test db`, `pnpm test:integration` 모두 녹색
- `phase-2-complete` 태그 부여

**스펙 문서:** `docs/superpowers/specs/2026-04-23-ongi-dashboard-design.md`  
**이전 Phase:** `docs/superpowers/plans/2026-04-23-phase-1-foundation.md` (태그 `phase-1-complete`)

---

## 파일 구조 (Phase 2 종료 시점 추가분)

```
supabase/
├── migrations/
│   ├── 20260423000016_views_daily_kpi.sql
│   ├── 20260423000017_views_ai_metrics.sql
│   ├── 20260423000018_views_wip_and_cost.sql
│   └── 20260423000019_views_lot_summary.sql
├── seed-mock.sql                                   (gitignored seed for visual testing)
└── tests/
    ├── 09_views_daily_kpi.sql
    └── 10_views_cost_and_lot.sql

src/
├── lib/
│   └── chartDefaults.ts                             차트 공통 옵션
├── hooks/
│   ├── useKpiData.ts
│   ├── useAiMetrics.ts
│   ├── useCostRatio.ts
│   ├── useWipFlow.ts
│   ├── useLots.ts                                   (필터 포함)
│   ├── useLotDetail.ts
│   ├── useDeviceStatus.ts                           (last_seen_at 기반)
│   └── useAlarms.ts                                 (읽기 전용, Realtime은 Phase 3)
├── components/
│   ├── common/
│   │   ├── KpiCard.tsx
│   │   ├── FormulaBox.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Pill.tsx
│   │   ├── StatusDot.tsx
│   │   ├── ChartCard.tsx
│   │   └── DataTable.tsx
│   └── charts/
│       ├── HourlyProductionChart.tsx
│       ├── CostTrendChart.tsx
│       ├── AiTrendChart.tsx
│       ├── PrfBarChart.tsx
│       └── WipPieChart.tsx
├── pages/
│   ├── KpiPage.tsx                                  (실구현)
│   ├── AiPage.tsx                                   (실구현)
│   ├── CostPage.tsx                                 (실구현)
│   └── LotHistoryPage.tsx                           (실구현)
└── utils/
    └── formatting.ts                                (숫자·시간 포맷)
```

---

## 전제 조건 체크

작업 시작 전 확인:
```bash
git branch --show-current    # phase-2-dashboards
git log --oneline | head -3  # phase-1-complete 태그 존재
supabase status              # API 및 DB running
pnpm lint && pnpm typecheck && pnpm test   # 기존 그린
supabase test db             # 기존 39/39 그린
```

모두 OK여야 시작.

---

## Task 1: 5 KPI 뷰 마이그레이션

**Files:**
- Create: `supabase/migrations/20260423000016_views_daily_kpi.sql`
- Create: `supabase/migrations/20260423000017_views_ai_metrics.sql`
- Create: `supabase/migrations/20260423000018_views_wip_and_cost.sql`
- Create: `supabase/migrations/20260423000019_views_lot_summary.sql`
- Create: `supabase/tests/09_views_daily_kpi.sql`
- Create: `supabase/tests/10_views_cost_and_lot.sql`

- [ ] **Step 1.1: v_daily_kpi 마이그레이션**

Create `supabase/migrations/20260423000016_views_daily_kpi.sql`:
```sql
-- v_daily_kpi: 오늘 기준 핵심 KPI (삼면포장기 + 비전검사기 + 클레임)
create or replace view v_daily_kpi as
with today_packaging as (
  select coalesce(sum(output_count), 0)::int        as today_production,
         coalesce(sum(runtime_seconds), 0)::numeric as runtime_sec_today
  from equipment_metrics em
  join devices d on d.id = em.device_id
  where d.role = 'primary_output' and d.active
    and bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')
),
today_vision as (
  select coalesce(sum(total_inspected), 0)::int as inspected,
         coalesce(sum(defect_count), 0)::int    as defects
  from vision_inspector_metrics vim
  join devices d on d.id = vim.device_id
  where d.type = 'vision_inspector' and d.active
    and bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')
),
quarter_claims as (
  select count(*)::int as claims_count
  from claims
  where received_at >= date_trunc('quarter', now() at time zone 'Asia/Seoul')
)
select
  tp.today_production,
  tp.runtime_sec_today,
  case when tp.runtime_sec_today = 0 then 0
       else round(tp.today_production / (tp.runtime_sec_today / 3600.0), 0)::int
  end as hourly_production,
  case when tp.today_production = 0 then 0
       else round(tp.runtime_sec_today / tp.today_production, 2)
  end as work_time_per_ea,
  tv.inspected,
  tv.defects,
  case when tv.inspected = 0 then 0
       else round(tv.defects::numeric / tv.inspected * 100, 2)
  end as defect_rate_pct,
  qc.claims_count
from today_packaging tp, today_vision tv, quarter_claims qc;

comment on view v_daily_kpi is
  '오늘 기준 핵심 KPI: 생산량/시간당/작업시간/불량률/분기클레임';

grant select on v_daily_kpi to authenticated;
```

- [ ] **Step 1.2: v_ai_metrics 마이그레이션**

Create `supabase/migrations/20260423000017_views_ai_metrics.sql`:
```sql
-- v_ai_metrics: AI 비전검사기 성능지표 (오늘 기준)
-- 주의: "defect_detection_pct"는 spec상 샘플 공식 그대로 (판정불량수 ÷ 전체검사수)
-- 실제 Recall 의미가 아님 — 현장 관측 불량률. UI에서 "현장 검증 중" 표기.
create or replace view v_ai_metrics as
select
  coalesce(sum(total_inspected), 0)::int                   as total_inspected,
  coalesce(sum(defect_count), 0)::int                      as defect_count,
  coalesce(sum(unknown_count), 0)::int                     as unknown_count,
  coalesce(sum(inspection_time_seconds), 0)::numeric       as total_inspection_time_sec,
  case when coalesce(sum(total_inspected), 0) = 0 then 0
       else round(sum(defect_count)::numeric / sum(total_inspected) * 100, 2)
  end                                                       as defect_detection_pct,
  case when coalesce(sum(inspection_time_seconds), 0) = 0 then 0
       else round(sum(total_inspected) / (sum(inspection_time_seconds) / 3600.0), 0)::int
  end                                                       as throughput_ea_per_hr,
  case when coalesce(sum(total_inspected), 0) = 0 then 0
       else round(sum(unknown_count)::numeric / sum(total_inspected) * 100, 2)
  end                                                       as recheck_rate_pct
from vision_inspector_metrics vim
join devices d on d.id = vim.device_id
where d.type = 'vision_inspector' and d.active
  and bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul');

grant select on v_ai_metrics to authenticated;
```

- [ ] **Step 1.3: v_wip_flow + v_cost_ratio 마이그레이션**

Create `supabase/migrations/20260423000018_views_wip_and_cost.sql`:
```sql
-- v_wip_flow: 공정 순서별 투입→재공→출력 흐름 (재공재고 산출)
create or replace view v_wip_flow as
with today_by_device as (
  -- 오늘 누적 수량 by device (equipment + vision 둘 다)
  select d.id, d.code, d.name, d.type, d.process_order,
         coalesce(
           (select sum(em.output_count)
            from equipment_metrics em
            where em.device_id = d.id
              and em.bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')),
           (select sum(vim.total_inspected)
            from vision_inspector_metrics vim
            where vim.device_id = d.id
              and vim.bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')),
           0
         )::int as output_today
  from devices d
  where d.active
)
select
  a.code          as from_code,
  a.name          as from_name,
  b.code          as to_code,
  b.name          as to_name,
  a.output_today  as input,
  b.output_today  as output,
  greatest(a.output_today - b.output_today, 0) as wip_quantity
from today_by_device a
join today_by_device b on b.process_order = a.process_order + 1
order by a.process_order;

-- v_cost_ratio: 제조원가 비율 = (재공재고 합계 ÷ 총생산량) × 100
create or replace view v_cost_ratio as
with totals as (
  select
    coalesce((select sum(wip_quantity) from v_wip_flow), 0)::int as wip_total,
    coalesce((select today_production from v_daily_kpi), 0)::int as total_production
)
select
  wip_total,
  total_production,
  case when total_production = 0 then 0
       else round(wip_total::numeric / total_production * 100, 2)
  end as cost_ratio_pct
from totals;

grant select on v_wip_flow to authenticated;
grant select on v_cost_ratio to authenticated;
```

- [ ] **Step 1.4: v_lot_summary 마이그레이션**

Create `supabase/migrations/20260423000019_views_lot_summary.sql`:
```sql
-- v_lot_summary: LOT별 생산/검사/불량/판정 집계
-- 비전검사기 메트릭을 LOT의 started_at~ended_at 범위로 조인
create or replace view v_lot_summary as
select
  l.id, l.lot_no, l.client_id, l.product_name, l.status,
  l.started_at, l.ended_at, l.target_quantity, l.notes,
  c.name                                                              as client_name,
  coalesce(sum(vim.total_inspected), 0)::int                           as inspected,
  coalesce(sum(vim.good_count), 0)::int                                as good_count,
  coalesce(sum(vim.defect_count), 0)::int                              as defect_count,
  coalesce(sum(vim.unknown_count), 0)::int                             as unknown_count,
  case when coalesce(sum(vim.total_inspected), 0) = 0 then 0
       else round(sum(vim.defect_count)::numeric / sum(vim.total_inspected) * 100, 2)
  end                                                                   as defect_rate_pct,
  case when coalesce(sum(vim.total_inspected), 0) = 0 then '미검사'
       when sum(vim.defect_count)::numeric / sum(vim.total_inspected) > 0.01 then '불합격'
       when sum(vim.defect_count)::numeric / sum(vim.total_inspected) > 0.005 then '주의'
       else '정상'
  end                                                                   as judgment
from lots l
join clients c on c.id = l.client_id
left join vision_inspector_metrics vim
  on vim.bucket_at >= coalesce(l.started_at, l.created_at)
 and (l.ended_at is null or vim.bucket_at <= l.ended_at)
group by l.id, c.name;

grant select on v_lot_summary to authenticated;
```

- [ ] **Step 1.5: pgTAP 테스트 1 — v_daily_kpi**

Create `supabase/tests/09_views_daily_kpi.sql`:
```sql
begin;
select plan(5);

select has_view('v_daily_kpi');
select has_view('v_ai_metrics');
select has_view('v_wip_flow');
select has_view('v_cost_ratio');
select has_view('v_lot_summary');

select * from finish();
rollback;
```

- [ ] **Step 1.6: pgTAP 테스트 2 — 계산 검증**

Create `supabase/tests/10_views_cost_and_lot.sql`:
```sql
begin;
select plan(4);

-- 오늘 데이터가 없을 때 모든 뷰는 0을 반환해야 함
select is((select today_production from v_daily_kpi), 0,
  'v_daily_kpi.today_production returns 0 when no metrics');

select is((select defect_rate_pct from v_daily_kpi), 0::numeric,
  'v_daily_kpi.defect_rate_pct returns 0 when no metrics');

select is((select cost_ratio_pct from v_cost_ratio), 0::numeric,
  'v_cost_ratio.cost_ratio_pct returns 0 when no production');

-- 데이터 삽입 → 값 변화 확인
insert into devices (code, name, type, role, process_order, api_key_hash)
values ('view_test_pack', 'test packaging', 'equipment', 'primary_output', 99, 'h')
returning id \gset pack_

insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
values (:'pack_id',
  (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + interval '2 hours',
  60, 1800);

select is((select today_production from v_daily_kpi), 1800,
  'v_daily_kpi reflects newly inserted equipment_metrics');

select * from finish();
rollback;
```

- [ ] **Step 1.7: 적용 및 테스트**

Run:
```bash
supabase db reset
supabase test db
```

Expected: 39 prior + 9 new = **48 tests pass** (5 has_view + 4 computation).

- [ ] **Step 1.8: 커밋**

```bash
git add -A
git commit -m "feat(db): add 5 KPI views (daily/ai/wip/cost/lot) with pgTAP coverage"
```

---

## Task 2: 목업 메트릭 시드 스크립트 (시각 테스팅용)

**Files:**
- Create: `supabase/mock-seed.sql`
- Modify: `.gitignore` (optional — if we commit the script, no ignore needed; if only local, ignore)
- Modify: `package.json` (add `db:mock` script)

실제 장비가 없을 때 대시보드를 시각 테스트하기 위한 목업 메트릭. 오늘 오전 8시부터 14시까지 6시간 × 60분 = 360개 버킷 생성.

- [ ] **Step 2.1: 목업 스크립트**

Create `supabase/mock-seed.sql`:
```sql
-- 실제 장비 데이터가 도착하기 전, 시각 테스트용 mock metrics.
-- supabase db reset 후 `pnpm db:mock` 으로 로드.
-- 중복 삽입 안전 (ON CONFLICT).

-- 오늘 오전 8:00 ~ 14:00 (6시간 × 60분) 분당 버킷 생성
with minutes as (
  select generate_series(
    (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + interval '8 hours',
    (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + interval '14 hours',
    interval '1 minute'
  ) as bucket_at
),
packaging_device as (
  select id from devices where code = 'packaging_01'
),
vision_device as (
  select id from devices where code = 'vision_01'
),
equipment_rows as (
  insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
  select (select id from packaging_device), m.bucket_at, 58, 30 + (random() * 5)::int
  from minutes m
  on conflict (device_id, bucket_at) do nothing
  returning 1
),
vision_rows as (
  insert into vision_inspector_metrics
    (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
  select
    (select id from vision_device),
    m.bucket_at,
    30,                                  -- total
    28,                                  -- good
    1 + (random() * 1)::int,             -- defect 1~2
    30 - 28 - (1 + (random() * 1)::int), -- unknown (나머지)
    58
  from minutes m
  on conflict (device_id, bucket_at) do nothing
  returning 1
)
select
  (select count(*) from equipment_rows) as eq_inserted,
  (select count(*) from vision_rows)    as vim_inserted;

-- 샘플 LOT 3개 (오늘)
insert into lots (lot_no, client_id, product_name, target_quantity, started_at, status)
select
  'LOT-' || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD') || '-00' || n,
  (select id from clients where name = c.name),
  '온열팩 (mock)',
  3000,
  (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + (n || ' hours')::interval,
  'running'
from (values (1, '삼성웰스토리'), (2, 'CJ프레시웨이'), (3, 'PSI')) as c(n, name)
on conflict (lot_no) do nothing;

-- 샘플 클레임 1건 (이번 분기)
insert into claims (client_id, received_at, defect_type, quantity, description, status)
select
  (select id from clients where name = '삼성웰스토리'),
  now() - interval '10 days',
  '외포장 파손',
  5,
  '배송 중 박스 파손 — 5개 교체 요청 (mock 데이터)',
  'resolved'
where not exists (
  select 1 from claims where description like '%mock 데이터%'
);
```

- [ ] **Step 2.2: package.json 스크립트**

Add to `package.json` scripts (after `types:gen`):
```json
"db:mock": "psql \"postgres://postgres:postgres@127.0.0.1:54322/postgres\" -f supabase/mock-seed.sql"
```

- [ ] **Step 2.3: 검증**

```bash
supabase db reset
pnpm db:mock
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -c "select today_production, hourly_production, defect_rate_pct from v_daily_kpi;"
```

Expected output:
- `today_production` ~10,800 (360 buckets × ~30 output each)
- `hourly_production` ~1,800
- `defect_rate_pct` ~3~7% (random)

또한:
```bash
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -c "select lot_no, inspected, defect_count, judgment from v_lot_summary;"
```
— 3 LOT 각각 검사/불량/판정 표시 확인.

- [ ] **Step 2.4: 커밋**

```bash
git add -A
git commit -m "feat(db): add mock metrics seed script for visual dashboard testing"
```

---

## Task 3: Chart.js 설치 + 공통 기본값 + ChartCard

**Files:**
- Create: `src/lib/chartDefaults.ts`, `src/components/common/ChartCard.tsx`

- [ ] **Step 3.1: 의존성 설치**

```bash
pnpm add chart.js react-chartjs-2 date-fns chartjs-adapter-date-fns
```

- [ ] **Step 3.2: chartDefaults**

Create `src/lib/chartDefaults.ts`:
```ts
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

// 전역 등록 (한 번만)
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const chartColors = {
  primary: '#1E64B4',
  primaryLight: '#D2E6FA',
  good: '#1D9E75',
  amber: '#E8933A',
  danger: '#D94444',
  gray: '#8CA0B8',
  grid: '#DCE6F2',
  text: '#0F2340',
  textDim: '#5F708A',
};

export const baseLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#FFFFFF',
      borderColor: chartColors.grid,
      borderWidth: 1,
      titleColor: chartColors.text,
      bodyColor: chartColors.textDim,
      titleFont: { family: 'JetBrains Mono', size: 11 },
      bodyFont: { family: 'JetBrains Mono', size: 11 },
      padding: 8,
    },
  },
  scales: {
    x: {
      ticks: { color: chartColors.textDim, font: { family: 'JetBrains Mono', size: 10 } },
      grid: { color: chartColors.grid, drawTicks: false },
    },
    y: {
      ticks: { color: chartColors.textDim, font: { family: 'JetBrains Mono', size: 10 } },
      grid: { color: chartColors.grid },
      beginAtZero: true,
    },
  },
};
```

- [ ] **Step 3.3: ChartCard 컴포넌트**

Create `src/components/common/ChartCard.tsx`:
```tsx
import type { ReactNode } from 'react';

export function ChartCard({
  title,
  legend,
  children,
  className = '',
}: {
  title: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text">{title}</h3>
        {legend && <div className="flex gap-3 text-xs text-text-dim">{legend}</div>}
      </div>
      <div className="relative h-[200px]">{children}</div>
    </div>
  );
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
```

- [ ] **Step 3.4: 검증**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 3.5: 커밋**

```bash
git add -A
git commit -m "feat(charts): install Chart.js and add chartDefaults + ChartCard"
```

---

## Task 4: 데이터 훅 8개

**Files:**
- Create: `src/hooks/useKpiData.ts`, `useAiMetrics.ts`, `useCostRatio.ts`, `useWipFlow.ts`, `useLots.ts`, `useLotDetail.ts`, `useDeviceStatus.ts`, `useAlarms.ts`

모든 훅이 동일한 패턴: `useQuery` + Supabase 쿼리.

- [ ] **Step 4.1: useKpiData**

Create `src/hooks/useKpiData.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface DailyKpi {
  today_production: number;
  runtime_sec_today: number;
  hourly_production: number;
  work_time_per_ea: number;
  inspected: number;
  defects: number;
  defect_rate_pct: number;
  claims_count: number;
}

export function useKpiData() {
  return useQuery<DailyKpi | null>({
    queryKey: ['kpi', 'daily'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_daily_kpi')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data as DailyKpi | null;
    },
  });
}
```

- [ ] **Step 4.2: useAiMetrics**

Create `src/hooks/useAiMetrics.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AiMetrics {
  total_inspected: number;
  defect_count: number;
  unknown_count: number;
  total_inspection_time_sec: number;
  defect_detection_pct: number;
  throughput_ea_per_hr: number;
  recheck_rate_pct: number;
}

export function useAiMetrics() {
  return useQuery<AiMetrics | null>({
    queryKey: ['ai', 'metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_ai_metrics').select('*').maybeSingle();
      if (error) throw error;
      return data as AiMetrics | null;
    },
  });
}
```

- [ ] **Step 4.3: useCostRatio + useWipFlow**

Create `src/hooks/useCostRatio.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface CostRatio {
  wip_total: number;
  total_production: number;
  cost_ratio_pct: number;
}

export function useCostRatio() {
  return useQuery<CostRatio | null>({
    queryKey: ['cost', 'ratio'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_cost_ratio').select('*').maybeSingle();
      if (error) throw error;
      return data as CostRatio | null;
    },
  });
}
```

Create `src/hooks/useWipFlow.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface WipFlowStep {
  from_code: string;
  from_name: string;
  to_code: string;
  to_name: string;
  input: number;
  output: number;
  wip_quantity: number;
}

export function useWipFlow() {
  return useQuery<WipFlowStep[]>({
    queryKey: ['wip', 'flow'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_wip_flow').select('*');
      if (error) throw error;
      return (data ?? []) as WipFlowStep[];
    },
  });
}
```

- [ ] **Step 4.4: useLots + useLotDetail**

Create `src/hooks/useLots.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface LotSummary {
  id: string;
  lot_no: string;
  client_id: string;
  client_name: string;
  product_name: string | null;
  status: 'planned' | 'running' | 'completed' | 'paused';
  started_at: string | null;
  ended_at: string | null;
  target_quantity: number | null;
  notes: string | null;
  inspected: number;
  good_count: number;
  defect_count: number;
  unknown_count: number;
  defect_rate_pct: number;
  judgment: '정상' | '주의' | '불합격' | '미검사';
}

export interface LotFilter {
  search?: string;
  clientName?: string;
  judgment?: string;
  date?: string; // YYYY-MM-DD
}

export function useLots(filter: LotFilter = {}) {
  return useQuery<LotSummary[]>({
    queryKey: ['lots', filter],
    queryFn: async () => {
      let q = supabase.from('v_lot_summary').select('*').order('started_at', { ascending: false, nullsFirst: false });
      if (filter.clientName) q = q.eq('client_name', filter.clientName);
      if (filter.judgment)   q = q.eq('judgment', filter.judgment);
      if (filter.search)     q = q.or(`lot_no.ilike.%${filter.search}%,client_name.ilike.%${filter.search}%`);
      if (filter.date) {
        const from = `${filter.date}T00:00:00+09:00`;
        const to   = `${filter.date}T23:59:59+09:00`;
        q = q.gte('started_at', from).lte('started_at', to);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LotSummary[];
    },
  });
}
```

Create `src/hooks/useLotDetail.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { LotSummary } from './useLots';

export function useLotDetail(lotId: string | null) {
  return useQuery<LotSummary | null>({
    queryKey: ['lot', lotId],
    enabled: !!lotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lot_summary')
        .select('*')
        .eq('id', lotId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LotSummary | null;
    },
  });
}
```

- [ ] **Step 4.5: useDeviceStatus + useAlarms**

Create `src/hooks/useDeviceStatus.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type DeviceHealth = 'running' | 'warn' | 'offline';

export interface DeviceStatus {
  id: string;
  code: string;
  name: string;
  type: 'vision_inspector' | 'equipment';
  role: string | null;
  last_seen_at: string | null;
  health: DeviceHealth;
}

function computeHealth(lastSeenAt: string | null): DeviceHealth {
  if (!lastSeenAt) return 'offline';
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  if (diffMs > 5 * 60_000) return 'offline'; // 5분
  if (diffMs > 2 * 60_000) return 'warn';    // 2분
  return 'running';
}

export function useDeviceStatus() {
  return useQuery<DeviceStatus[]>({
    queryKey: ['devices', 'status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('id, code, name, type, role, last_seen_at, active')
        .eq('active', true)
        .order('process_order');
      if (error) throw error;
      return (data ?? []).map((d) => ({
        ...(d as DeviceStatus),
        health: computeHealth(d.last_seen_at),
      }));
    },
  });
}
```

Create `src/hooks/useAlarms.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AlarmRow {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  source: 'auto' | 'manual' | 'system';
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export function useAlarms(limit = 10) {
  return useQuery<AlarmRow[]>({
    queryKey: ['alarms', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alarms')
        .select('id, severity, source, message, acknowledged, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AlarmRow[];
    },
  });
}
```

- [ ] **Step 4.6: 검증**

```bash
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

- [ ] **Step 4.7: 커밋**

```bash
git add -A
git commit -m "feat(hooks): add 8 data hooks for KPIs, AI metrics, cost, LOTs, devices, alarms"
```

---

## Task 5: 공통 UI 컴포넌트 (KpiCard / FormulaBox / ProgressBar / Pill / StatusDot)

**Files:**
- Create: `src/components/common/KpiCard.tsx`, `FormulaBox.tsx`, `ProgressBar.tsx`, `Pill.tsx`, `StatusDot.tsx`
- Create: `src/utils/formatting.ts`

- [ ] **Step 5.1: 숫자/시간 포맷팅 유틸**

Create `src/utils/formatting.ts`:
```ts
export const fmt = {
  int: (n: number | null | undefined) =>
    n == null ? '-' : new Intl.NumberFormat('ko-KR').format(Math.round(n)),
  pct: (n: number | null | undefined, digits = 1) =>
    n == null ? '-' : `${n.toFixed(digits)}%`,
  sec: (n: number | null | undefined, digits = 2) =>
    n == null ? '-' : `${n.toFixed(digits)} s`,
  ea: (n: number | null | undefined) =>
    n == null ? '-' : `${fmt.int(n)} ea`,
  eaPerHr: (n: number | null | undefined) =>
    n == null ? '-' : `${fmt.int(n)} ea/hr`,
};
```

- [ ] **Step 5.2: FormulaBox**

Create `src/components/common/FormulaBox.tsx`:
```tsx
import type { ReactNode } from 'react';

export function FormulaBox({ children }: { children: ReactNode }) {
  return <div className="formula-box">{children}</div>;
}

export function Hi({ children }: { children: ReactNode }) {
  return <span className="hi">{children}</span>;
}

export function FormulaLabel({ children }: { children: ReactNode }) {
  return <span className="label">{children}</span>;
}
```

`.formula-box`, `.hi`, `.label` 클래스는 이미 Phase 1의 `src/index.css`에 정의됨.

- [ ] **Step 5.3: Pill**

Create `src/components/common/Pill.tsx`:
```tsx
import type { ReactNode } from 'react';

type Variant = 'ok' | 'warn' | 'danger' | 'info';

const classes: Record<Variant, string> = {
  ok:     'bg-good-light text-good-dark',
  warn:   'bg-warn-light text-warn-dark',
  danger: 'bg-danger-light text-danger-dark',
  info:   'bg-primary-light text-primary-dark',
};

export function Pill({ variant, children }: { variant: Variant; children: ReactNode }) {
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${classes[variant]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 5.4: StatusDot**

Create `src/components/common/StatusDot.tsx`:
```tsx
type Health = 'running' | 'warn' | 'offline';

const classes: Record<Health, string> = {
  running: 'bg-good',
  warn:    'bg-warn',
  offline: 'bg-danger',
};

export function StatusDot({ health }: { health: Health }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${classes[health]} ${
        health === 'running' ? 'animate-pulse' : ''
      }`}
    />
  );
}
```

- [ ] **Step 5.5: ProgressBar**

Create `src/components/common/ProgressBar.tsx`:
```tsx
type Variant = 'primary' | 'warn' | 'danger';

const fills: Record<Variant, string> = {
  primary: 'bg-primary-gradient',
  warn:    'bg-warn',
  danger:  'bg-danger',
};

export function ProgressBar({
  value,
  max = 100,
  variant = 'primary',
}: {
  value: number;
  max?: number;
  variant?: Variant;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-2 rounded-full bg-surface2 border border-border overflow-hidden">
      <div
        className={`h-full ${fills[variant]} transition-[width]`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 5.6: KpiCard**

Create `src/components/common/KpiCard.tsx`:
```tsx
import type { ReactNode } from 'react';

type Accent = 'neutral' | 'warn' | 'ok';

const accents: Record<Accent, string> = {
  neutral: '',
  warn:    'bg-warn-light border-warn',
  ok:      'bg-good-light border-good',
};

export function KpiCard({
  label,
  value,
  unit,
  sub,
  badge,
  accent = 'neutral',
  formula,
  extra,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  badge?: ReactNode;
  accent?: Accent;
  formula?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg p-4 flex flex-col ${accents[accent]}`}
    >
      <div className="text-[11px] text-text-dim mb-1.5">{label}</div>
      <div className="text-2xl font-bold text-text leading-none">
        {value}
        {unit && <span className="text-sm font-normal ml-0.5">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-text-muted mt-1">{sub}</div>}
      {badge && <div className="mt-1.5">{badge}</div>}
      {extra}
      {formula && <div className="mt-auto">{formula}</div>}
    </div>
  );
}
```

- [ ] **Step 5.7: 검증**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 5.8: 커밋**

```bash
git add -A
git commit -m "feat(components): add KpiCard, FormulaBox, Pill, StatusDot, ProgressBar primitives"
```

---

## Task 6: DataTable 컴포넌트

**Files:**
- Create: `src/components/common/DataTable.tsx`

LOT 이력 페이지에서 사용할 범용 테이블. 컬럼 정의 기반으로 렌더링.

- [ ] **Step 6.1: DataTable**

Create `src/components/common/DataTable.tsx`:
```tsx
import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  onRowClick,
  empty = '데이터가 없습니다.',
  loading = false,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-text-dim text-sm">
        로딩 중...
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-text-muted text-sm">
        {empty}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-surface2">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2.5 text-[11px] font-medium text-text-dim border-b border-border whitespace-nowrap ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                }`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-border last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-surface2' : ''
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2.5 text-text whitespace-nowrap ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6.2: 검증 + 커밋**

```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(components): add DataTable with column definitions and row click"
```

---

## Task 7: KpiPage — 6개 KPI 카드 섹션

**Files:**
- Modify: `src/pages/KpiPage.tsx`

샘플 HTML의 실시간 KPI 탭 상단 6개 카드 + 산출식 박스 구현. 나머지 섹션(진행률/설비/차트/알람)은 Task 8에서 추가.

- [ ] **Step 7.1: KpiPage 스캐폴드 + KPI 카드**

Replace `src/pages/KpiPage.tsx`:
```tsx
import { useKpiData } from '../hooks/useKpiData';
import { useCostRatio } from '../hooks/useCostRatio';
import { KpiCard } from '../components/common/KpiCard';
import { Pill } from '../components/common/Pill';
import { FormulaBox, Hi, FormulaLabel } from '../components/common/FormulaBox';
import { fmt } from '../utils/formatting';

const TARGETS = {
  daily:       15000,
  hourly:      1800,
  workTime:    2.0,
  defect:      1.0,
  cost:        10.0,
  claim:       1,
};

export function KpiPage() {
  const { data: kpi, isLoading } = useKpiData();
  const { data: cost } = useCostRatio();

  if (isLoading || !kpi) {
    return <div className="text-text-dim">KPI 로딩 중...</div>;
  }

  const achievement = (kpi.today_production / TARGETS.daily) * 100;

  return (
    <div className="space-y-4">
      <section
        aria-label="실시간 KPI"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5"
      >
        <KpiCard
          label="오늘 생산량"
          value={fmt.int(kpi.today_production)}
          unit="ea"
          sub={`목표 ${fmt.int(TARGETS.daily)} ea`}
          badge={
            achievement >= 100 ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="warn">{achievement.toFixed(1)}%</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              Σ(삼면포장기 일 생산량)
              <br />= <Hi>{fmt.int(kpi.today_production)} ea</Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              equipment_metrics (1분 집계)
            </FormulaBox>
          }
        />

        <KpiCard
          label="시간당 생산량"
          value={fmt.int(kpi.hourly_production)}
          unit="ea/hr"
          sub={`목표 ${fmt.int(TARGETS.hourly)} ea/hr`}
          badge={
            kpi.hourly_production >= TARGETS.hourly ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="warn">
                {((kpi.hourly_production / TARGETS.hourly) * 100).toFixed(1)}%
              </Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              총 생산수량 ÷ 가동시간(hr)
              <br />=
              <Hi>
                {' '}{fmt.int(kpi.today_production)} ÷{' '}
                {(kpi.runtime_sec_today / 3600).toFixed(2)} ={' '}
                {fmt.int(kpi.hourly_production)} ea/hr
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              삼면포장기
            </FormulaBox>
          }
        />

        <KpiCard
          label="작업시간 / ea"
          value={fmt.sec(kpi.work_time_per_ea)}
          sub={`목표 ${TARGETS.workTime.toFixed(1)}s 이하`}
          badge={
            kpi.work_time_per_ea <= TARGETS.workTime ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="warn">초과</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              총 생산시간 ÷ 총 생산수량
              <br />=
              <Hi>
                {' '}{kpi.runtime_sec_today.toFixed(0)} ÷ {fmt.int(kpi.today_production)} ={' '}
                {fmt.sec(kpi.work_time_per_ea)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              삼면포장기
            </FormulaBox>
          }
        />

        <KpiCard
          label="불량률"
          value={fmt.pct(kpi.defect_rate_pct, 1)}
          sub={`목표 ${TARGETS.defect.toFixed(1)}% 이하 / 불량 ${fmt.int(kpi.defects)}ea`}
          badge={
            kpi.defect_rate_pct <= TARGETS.defect ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="danger">초과</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              불량수 ÷ 전체 검사수 × 100
              <br />=
              <Hi>
                {' '}({fmt.int(kpi.defects)} ÷ {fmt.int(kpi.inspected)}) × 100 ={' '}
                {fmt.pct(kpi.defect_rate_pct, 2)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              AI 비전검사기
            </FormulaBox>
          }
        />

        <KpiCard
          accent="warn"
          label="제조원가 비율"
          value={fmt.pct(cost?.cost_ratio_pct ?? 0, 1)}
          sub={`목표 ${TARGETS.cost}% / 도입 전 15.0%`}
          badge={
            (cost?.cost_ratio_pct ?? 0) <= TARGETS.cost ? (
              <Pill variant="ok">달성</Pill>
            ) : (
              <Pill variant="warn">개선 진행 중</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              (재공재고 ÷ 총 생산수량) × 100
              <br />=
              <Hi>
                {' '}({fmt.int(cost?.wip_total ?? 0)} ÷ {fmt.int(cost?.total_production ?? 0)}) × 100 ={' '}
                {fmt.pct(cost?.cost_ratio_pct ?? 0, 2)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              v_cost_ratio
            </FormulaBox>
          }
        />

        <KpiCard
          label="고객 클레임"
          value={fmt.int(kpi.claims_count)}
          unit="건"
          sub={`이번 분기 / 목표 ${TARGETS.claim}건 이하`}
          badge={
            kpi.claims_count <= TARGETS.claim ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="danger">초과</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              분기 내 COUNT(claims)
              <br />=
              <Hi>
                {' '}{fmt.int(kpi.claims_count)} 건
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              claims 테이블 (수기 입력)
            </FormulaBox>
          }
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 7.2: 검증**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

수동 확인: `.env.local` 실키로 채우고 `pnpm dev` → 로그인 → `/kpi` 이동 시 6개 카드가 실데이터로 표시. mock 데이터 상태에서 숫자가 합리적으로 보이는지.

- [ ] **Step 7.3: 커밋**

```bash
git add -A
git commit -m "feat(kpi): implement 6 KPI cards with formula boxes on KpiPage"
```

---

## Task 8: KpiPage — 진행률·설비상태·차트·알람

**Files:**
- Modify: `src/pages/KpiPage.tsx`
- Create: `src/components/charts/HourlyProductionChart.tsx`, `CostTrendChart.tsx`

- [ ] **Step 8.1: HourlyProductionChart**

Create `src/components/charts/HourlyProductionChart.tsx`:
```tsx
import { Bar } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';

interface HourBucket {
  hour: string;  // '08'
  output: number;
}

export function HourlyProductionChart({ buckets, target }: { buckets: HourBucket[]; target: number }) {
  return (
    <Bar
      data={{
        labels: buckets.map((b) => b.hour),
        datasets: [
          { label: '실적', data: buckets.map((b) => b.output), backgroundColor: chartColors.good, borderRadius: 4 },
          {
            label: '목표',
            data: buckets.map(() => target),
            type: 'line' as const,
            borderColor: chartColors.gray,
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      }}
      options={baseLineOptions as never}
    />
  );
}
```

- [ ] **Step 8.2: CostTrendChart**

Create `src/components/charts/CostTrendChart.tsx`:
```tsx
import { Line } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';

interface DayPoint {
  label: string;
  value: number;
}

export function CostTrendChart({ points, target }: { points: DayPoint[]; target: number }) {
  return (
    <Line
      data={{
        labels: points.map((p) => p.label),
        datasets: [
          {
            label: '실적',
            data: points.map((p) => p.value),
            borderColor: chartColors.amber,
            backgroundColor: chartColors.amber + '22',
            fill: true,
            tension: 0.3,
          },
          {
            label: '목표',
            data: points.map(() => target),
            borderColor: chartColors.danger,
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      }}
      options={baseLineOptions as never}
    />
  );
}
```

- [ ] **Step 8.3: 시간대별 버킷 훅**

Add to `src/hooks/useKpiData.ts`, append:
```ts
export interface HourlyBucket {
  hour: string;
  output: number;
}

export function useHourlyProduction() {
  return useQuery<HourlyBucket[]>({
    queryKey: ['kpi', 'hourly'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_hourly_production_today');
      if (error) {
        // RPC 없으면 빈 배열 반환 (초기 개발 중)
        return [];
      }
      return (data ?? []) as HourlyBucket[];
    },
  });
}
```

DB 측에서는 `fn_hourly_production_today()` 함수를 추가해야 함. 추가 마이그레이션:

Create `supabase/migrations/20260423000020_fn_hourly_production.sql`:
```sql
create or replace function fn_hourly_production_today()
returns table(hour text, output int)
language sql stable security definer set search_path = public as $$
  select
    to_char(date_trunc('hour', bucket_at at time zone 'Asia/Seoul'), 'HH24') as hour,
    sum(output_count)::int as output
  from equipment_metrics em
  join devices d on d.id = em.device_id
  where d.role = 'primary_output'
    and bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')
  group by 1
  order by 1;
$$;

grant execute on function fn_hourly_production_today() to authenticated;
```

Apply: `supabase db reset`.

- [ ] **Step 8.4: 7일 제조원가 추이 훅**

Add to `src/hooks/useCostRatio.ts`, append:
```ts
export interface DayPoint {
  label: string;
  value: number;
}

export function useCostRatio7Days() {
  return useQuery<DayPoint[]>({
    queryKey: ['cost', '7days'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_cost_ratio_7days');
      if (error) return [];
      return (data ?? []) as DayPoint[];
    },
  });
}
```

Add to migration `20260423000020`:
```sql
create or replace function fn_cost_ratio_7days()
returns table(label text, value numeric)
language sql stable security definer set search_path = public as $$
  with days as (
    select generate_series(
      (date_trunc('day', now() at time zone 'Asia/Seoul') - interval '6 days')::date,
      (date_trunc('day', now() at time zone 'Asia/Seoul'))::date,
      interval '1 day'
    )::date as day
  ),
  daily as (
    select
      d.day,
      coalesce(
        (select sum(em.output_count)::int
         from equipment_metrics em
         join devices dv on dv.id = em.device_id
         where dv.role = 'primary_output'
           and em.bucket_at >= d.day
           and em.bucket_at <  d.day + 1),
        0
      ) as total_prod,
      coalesce(
        (select sum(vim.total_inspected - vim.good_count)::int
         from vision_inspector_metrics vim
         join devices dv on dv.id = vim.device_id
         where dv.type = 'vision_inspector'
           and vim.bucket_at >= d.day
           and vim.bucket_at <  d.day + 1),
        0
      ) as wip_approx
    from days d
  )
  select
    to_char(day, 'MM/DD') as label,
    case when total_prod = 0 then 0
         else round(wip_approx::numeric / total_prod * 100, 2)
    end as value
  from daily
  order by day;
$$;

grant execute on function fn_cost_ratio_7days() to authenticated;
```

- [ ] **Step 8.5: KpiPage 확장**

Replace the entire `src/pages/KpiPage.tsx` body (keep existing KPI cards section — ADD below it):

After the `</section>` (KPI cards), insert:

```tsx
      {/* 진행률 섹션 */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-dim">오늘 목표 달성률</span>
            <strong className="text-sm text-text">
              {achievement.toFixed(1)}% ({fmt.int(kpi.today_production)} / {fmt.int(TARGETS.daily)} ea)
            </strong>
          </div>
          <ProgressBar value={kpi.today_production} max={TARGETS.daily} variant={achievement >= 100 ? 'primary' : 'warn'} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-dim">제조원가 개선률</span>
            <strong className="text-sm text-text">
              {(cost ? ((15.0 - cost.cost_ratio_pct) / (15.0 - TARGETS.cost)) * 100 : 0).toFixed(1)}% / 목표 33.0%
            </strong>
          </div>
          <ProgressBar
            value={cost ? ((15.0 - cost.cost_ratio_pct) / (15.0 - TARGETS.cost)) * 100 : 0}
            max={100}
            variant="warn"
          />
        </div>
      </section>

      {/* 설비별 가동 상태 */}
      <section>
        <h2 className="text-xs font-medium text-text-dim mb-2">설비별 가동 상태</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {devices?.map((d) => (
            <div
              key={d.id}
              className={`bg-surface border rounded-lg p-3 flex items-center gap-2 ${
                d.health === 'warn' ? 'border-warn' : d.health === 'offline' ? 'border-danger' : 'border-border'
              }`}
            >
              <StatusDot health={d.health} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text truncate">{d.name}</div>
                <div className={`text-[10px] ${
                  d.health === 'warn' ? 'text-warn' : d.health === 'offline' ? 'text-danger' : 'text-text-muted'
                }`}>
                  {d.health === 'running' ? '가동중' : d.health === 'warn' ? '점검 필요' : '오프라인'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 차트 섹션 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <ChartCard
          title="시간대별 생산량 (오늘)"
          legend={
            <>
              <LegendItem color={chartColors.good} label="실적" />
              <LegendItem color={chartColors.gray} label="목표 1,800" />
            </>
          }
        >
          <HourlyProductionChart buckets={hourly ?? []} target={TARGETS.hourly} />
        </ChartCard>
        <ChartCard
          title="제조원가 비율 추이 (최근 7일)"
          legend={
            <>
              <LegendItem color={chartColors.amber} label="실적" />
              <LegendItem color={chartColors.danger} label="목표 10%" />
            </>
          }
        >
          <CostTrendChart points={costTrend ?? []} target={TARGETS.cost} />
        </ChartCard>
      </section>

      {/* 최근 알람 */}
      <section>
        <h2 className="text-xs font-medium text-text-dim mb-2">최근 알람</h2>
        <div className="space-y-1.5">
          {alarms && alarms.length > 0 ? (
            alarms.map((a) => (
              <div
                key={a.id}
                className={`bg-surface border rounded-lg p-3 flex items-center gap-3 text-xs ${
                  a.severity === 'danger' ? 'border-danger' :
                  a.severity === 'warning' ? 'border-warn' : 'border-border'
                }`}
              >
                <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-[10px] font-bold ${
                  a.severity === 'danger' ? 'bg-danger text-white' :
                  a.severity === 'warning' ? 'bg-warn text-white' : 'bg-primary text-white'
                }`}>
                  {a.severity === 'info' ? 'i' : a.severity === 'danger' ? '!' : '!'}
                </span>
                <span className="flex-1">{a.message}</span>
                <span className="text-text-muted font-mono">
                  {new Date(a.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          ) : (
            <div className="text-text-muted text-xs">최근 알람이 없습니다.</div>
          )}
        </div>
      </section>
```

And import at top:
```tsx
import { ProgressBar } from '../components/common/ProgressBar';
import { StatusDot } from '../components/common/StatusDot';
import { ChartCard, LegendItem } from '../components/common/ChartCard';
import { HourlyProductionChart } from '../components/charts/HourlyProductionChart';
import { CostTrendChart } from '../components/charts/CostTrendChart';
import { useHourlyProduction } from '../hooks/useKpiData';
import { useCostRatio7Days } from '../hooks/useCostRatio';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useAlarms } from '../hooks/useAlarms';
import { chartColors } from '../lib/chartDefaults';
```

Add to `KpiPage()` body (before the return):
```tsx
  const { data: hourly } = useHourlyProduction();
  const { data: costTrend } = useCostRatio7Days();
  const { data: devices } = useDeviceStatus();
  const { data: alarms } = useAlarms(4);
```

- [ ] **Step 8.6: 검증 + 커밋**

```bash
supabase db reset && pnpm db:mock
supabase test db                     # 48 + any new assertions
pnpm lint && pnpm typecheck && pnpm build
```

Commit:
```bash
git add -A
git commit -m "feat(kpi): add progress, equipment status, charts, alarms sections"
```

---

## Task 9: AiPage — AI 성능지표 완성

**Files:**
- Modify: `src/pages/AiPage.tsx`
- Create: `src/components/charts/AiTrendChart.tsx`, `PrfBarChart.tsx`

- [ ] **Step 9.1: AiTrendChart**

Create `src/components/charts/AiTrendChart.tsx`:
```tsx
import { Line } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';

export function AiTrendChart({
  labels,
  detection,
  recheck,
}: {
  labels: string[];
  detection: number[];
  recheck: number[];
}) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: '불량검출율',
            data: detection,
            borderColor: chartColors.good,
            yAxisID: 'y',
            tension: 0.3,
          },
          {
            label: '재검율',
            data: recheck,
            borderColor: chartColors.danger,
            yAxisID: 'y1',
            tension: 0.3,
          },
        ],
      }}
      options={{
        ...baseLineOptions,
        scales: {
          ...baseLineOptions.scales,
          y:  { ...baseLineOptions.scales.y,  position: 'left' as const },
          y1: { ...baseLineOptions.scales.y,  position: 'right' as const, grid: { drawOnChartArea: false } },
        },
      } as never}
    />
  );
}
```

- [ ] **Step 9.2: PrfBarChart**

Create `src/components/charts/PrfBarChart.tsx`:
```tsx
import { Bar } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';

export function PrfBarChart() {
  // Phase 1 스펙: Precision/Recall/F1은 ground truth 부재로 mock
  return (
    <Bar
      data={{
        labels: ['Precision', 'Recall', 'F1'],
        datasets: [
          { label: '목표', data: [97, 99, 98], backgroundColor: chartColors.primary + '55' },
          { label: '현재', data: [95, 97, 96], backgroundColor: chartColors.good },
        ],
      }}
      options={{
        ...baseLineOptions,
        scales: { ...baseLineOptions.scales, y: { ...baseLineOptions.scales.y, max: 100 } },
      } as never}
    />
  );
}
```

- [ ] **Step 9.3: AiPage**

Replace `src/pages/AiPage.tsx`:
```tsx
import { useAiMetrics } from '../hooks/useAiMetrics';
import { KpiCard } from '../components/common/KpiCard';
import { Pill } from '../components/common/Pill';
import { FormulaBox, Hi, FormulaLabel } from '../components/common/FormulaBox';
import { ChartCard, LegendItem } from '../components/common/ChartCard';
import { AiTrendChart } from '../components/charts/AiTrendChart';
import { PrfBarChart } from '../components/charts/PrfBarChart';
import { fmt } from '../utils/formatting';
import { chartColors } from '../lib/chartDefaults';

export function AiPage() {
  const { data: ai, isLoading } = useAiMetrics();
  if (isLoading || !ai) return <div className="text-text-dim">AI 성능지표 로딩 중...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-medium text-text-dim">
        AI 비전검사 성능지표 — 사업계획서 산출식 기준
      </h2>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="① 불량 검출율 (내부지표)"
          value={fmt.pct(ai.defect_detection_pct, 1)}
          badge={<Pill variant="ok">목표 99% — 현장 검증 중</Pill>}
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              (판정 불량수 ÷ 전체 검사수) × 100
              <br />=
              <Hi>
                {' '}({fmt.int(ai.defect_count)} ÷ {fmt.int(ai.total_inspected)}) × 100 ={' '}
                {fmt.pct(ai.defect_detection_pct, 2)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              AI 비전 검사 로그 자동 집계
            </FormulaBox>
          }
        />
        <KpiCard
          label="② 검사 처리량"
          value={fmt.int(ai.throughput_ea_per_hr)}
          unit="ea/hr"
          badge={
            ai.throughput_ea_per_hr >= 1800 ? (
              <Pill variant="ok">목표 1,800 ea/hr 달성</Pill>
            ) : (
              <Pill variant="warn">목표 미달</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              총 검사수량 ÷ 총 검사시간(hr)
              <br />=
              <Hi>
                {' '}{fmt.int(ai.total_inspected)} ÷{' '}
                {(ai.total_inspection_time_sec / 3600).toFixed(2)} ={' '}
                {fmt.int(ai.throughput_ea_per_hr)} ea/hr
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              AI 장비 운영 로그 기반 실측
            </FormulaBox>
          }
        />
        <KpiCard
          label="③ 재검율 (Re-check rate)"
          value={fmt.pct(ai.recheck_rate_pct, 1)}
          badge={
            ai.recheck_rate_pct <= 1.0 ? (
              <Pill variant="ok">정상 범위</Pill>
            ) : (
              <Pill variant="warn">정상범위 이탈</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              (재검 요청 수 ÷ 전체 검사 수) × 100
              <br />=
              <Hi>
                {' '}({fmt.int(ai.unknown_count)} ÷ {fmt.int(ai.total_inspected)}) × 100 ={' '}
                {fmt.pct(ai.recheck_rate_pct, 2)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              판정불가·경계값 분류 데이터
            </FormulaBox>
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <ChartCard
          title="AI 성능 추이 (최근 7일)"
          legend={
            <>
              <LegendItem color={chartColors.good} label="불량검출율 (좌축)" />
              <LegendItem color={chartColors.danger} label="재검율 (우축)" />
            </>
          }
        >
          {/* Phase 2 MVP: 당일 값만 있고 7일 히스토리는 별도 RPC 필요 — 일단 현재값 단일점 표시 */}
          <AiTrendChart
            labels={['오늘']}
            detection={[ai.defect_detection_pct]}
            recheck={[ai.recheck_rate_pct]}
          />
        </ChartCard>
        <ChartCard
          title="Precision / Recall / F1 목표 대비 현황"
          legend={
            <>
              <LegendItem color={chartColors.primary + '55'} label="목표" />
              <LegendItem color={chartColors.good} label="현재 (mock)" />
            </>
          }
        >
          <PrfBarChart />
        </ChartCard>
      </section>

      <div className="bg-surface border border-border rounded-lg p-4 text-[11px] text-text-dim leading-relaxed">
        <strong className="text-text">모델 성능 기준 (사업계획서 명시)</strong>
        <br />
        Recall 99% 이내 — 불량 1,000개 중 10개 미만 미검출 (현장 적용 가능한 최소 기준) &nbsp;|&nbsp;
        Precision 97% 이내 — 재검사·보조 검사 공정 고려 시 생산성 저하 없이 운용 가능한 범위
        <br />
        F1-Score 0.98 이상 — 검출 정확도와 오검출 억제의 균형 &nbsp;|&nbsp; Accuracy 참고 지표
      </div>
    </div>
  );
}
```

- [ ] **Step 9.4: 검증 + 커밋**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

Commit:
```bash
git add -A
git commit -m "feat(ai): implement AI performance page with 3 metric cards and charts"
```

---

## Task 10: CostPage — 제조원가 Hero + 공정 흐름도

**Files:**
- Modify: `src/pages/CostPage.tsx`

- [ ] **Step 10.1: CostPage Hero + Flow**

Replace `src/pages/CostPage.tsx`:
```tsx
import { useCostRatio, useCostRatio7Days } from '../hooks/useCostRatio';
import { useWipFlow } from '../hooks/useWipFlow';
import { FormulaBox, Hi, FormulaLabel } from '../components/common/FormulaBox';
import { Pill } from '../components/common/Pill';
import { ChartCard, LegendItem } from '../components/common/ChartCard';
import { CostTrendChart } from '../components/charts/CostTrendChart';
import { fmt } from '../utils/formatting';
import { chartColors } from '../lib/chartDefaults';

export function CostPage() {
  const { data: cost } = useCostRatio();
  const { data: flow = [] } = useWipFlow();
  const { data: trend = [] } = useCostRatio7Days();

  const wipTotal   = cost?.wip_total ?? 0;
  const totalProd  = cost?.total_production ?? 0;
  const ratio      = cost?.cost_ratio_pct ?? 0;
  const targetMax  = Math.floor(totalProd * 0.10);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-text-dim mb-1.5">제조원가 비율 (오늘 기준)</div>
            <div className="text-[44px] leading-none font-bold text-warn">
              {fmt.pct(ratio, 1)}
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              목표 10.0% &nbsp;|&nbsp; 도입 전 15.0% &nbsp;|&nbsp; 개선 목표 33%
            </div>
          </div>
          <div>
            <Pill variant="warn">개선 진행 중 — {((15.0 - ratio) / 5.0 * 33).toFixed(1)}% 달성</Pill>
          </div>
        </div>
        <FormulaBox>
          <FormulaLabel>산출식:</FormulaLabel>{' '}
          <Hi>(재공재고 수량 ÷ 총 생산수량) × 100</Hi>
          <br />
          재공재고 = <Hi>AI 전수검사 공정 재공</Hi> + <Hi>내포장 공정 재공</Hi>
          <br />
          총 생산수량 = <Hi>외포장 완료 수량</Hi> 기준 (사업계획서 성과지표 산출식)
        </FormulaBox>
      </section>

      {/* 공정 흐름 */}
      <section>
        <h2 className="text-xs font-medium text-text-dim mb-2">공정별 수량 현황 (실시간)</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {flow.length === 0 ? (
            <div className="text-text-muted text-xs">공정 데이터가 아직 없습니다.</div>
          ) : (
            flow.map((step, i) => (
              <>
                <div
                  key={step.from_code}
                  className={`bg-surface border rounded-lg px-3 py-2 min-w-[120px] text-center ${
                    step.wip_quantity > 0 ? 'border-warn bg-warn-light' : 'border-border'
                  }`}
                >
                  <div className="text-[10px] text-text-dim">{step.from_name}</div>
                  <div className={`text-lg font-bold ${step.wip_quantity > 0 ? 'text-warn' : 'text-text'}`}>
                    {fmt.int(step.input)}
                  </div>
                  {step.wip_quantity > 0 && (
                    <div className="text-[10px] text-warn mt-0.5">
                      재공 {fmt.int(step.wip_quantity)}
                    </div>
                  )}
                </div>
                <span className="text-text-muted text-sm">→</span>
                {i === flow.length - 1 && (
                  <div className="bg-good-light border border-good rounded-lg px-3 py-2 min-w-[120px] text-center">
                    <div className="text-[10px] text-text-dim">{step.to_name}</div>
                    <div className="text-lg font-bold text-good">{fmt.int(step.output)}</div>
                  </div>
                )}
              </>
            ))
          )}
        </div>
      </section>

      {/* 스탯 카드 4개 */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[11px] text-text-dim">재공재고 합계</div>
          <div className="text-xl font-bold text-warn">{fmt.int(wipTotal)} ea</div>
          <div className="text-[10px] text-text-muted mt-0.5">AI 검사 재공 + 내포장 재공</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[11px] text-text-dim">총 생산수량 (출하완료)</div>
          <div className="text-xl font-bold text-text">{fmt.int(totalProd)} ea</div>
          <div className="text-[10px] text-text-muted mt-0.5">외포장 완료 기준</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[11px] text-text-dim">제조원가 비율</div>
          <div className="text-xl font-bold text-warn">{fmt.pct(ratio, 1)}</div>
          <div className="text-[10px] text-text-muted mt-0.5">
            = {fmt.int(wipTotal)} ÷ {fmt.int(totalProd)} × 100
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[11px] text-text-dim">목표 달성 재공재고 상한</div>
          <div className="text-xl font-bold text-good">≤ {fmt.int(targetMax)} ea</div>
          <div className="text-[10px] text-text-muted mt-0.5">10% 목표 기준</div>
        </div>
      </section>

      {/* 차트 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <ChartCard
          title="제조원가 비율 추이 (최근 7일)"
          legend={
            <>
              <LegendItem color={chartColors.amber} label="실적" />
              <LegendItem color={chartColors.danger} label="목표 10%" />
            </>
          }
        >
          <CostTrendChart points={trend} target={10} />
        </ChartCard>
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text mb-3">공정별 재공재고 비율</h3>
          <div className="space-y-2">
            {flow.filter((s) => s.wip_quantity > 0).map((s) => (
              <div key={s.from_code} className="flex items-center gap-3">
                <div className="text-xs text-text-dim w-24 truncate">{s.from_name}</div>
                <div className="flex-1 bg-surface2 border border-border rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-warn"
                    style={{ width: `${Math.min(100, (s.wip_quantity / wipTotal) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-text-muted font-mono w-16 text-right">
                  {fmt.int(s.wip_quantity)} ea
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="text-center">
        <button
          onClick={() => alert('실제 연동 시 AI 분석 결과가 표시됩니다. (Phase 4 예정)')}
          className="px-5 py-2 bg-surface border border-border rounded text-xs text-text-dim hover:border-primary hover:text-primary"
        >
          제조원가 개선 방안 분석 요청
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 10.2: 검증 + 커밋**

```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(cost): implement cost page with hero, process flow, stats, and charts"
```

---

## Task 11: LotHistoryPage — 필터 + 테이블

**Files:**
- Modify: `src/pages/LotHistoryPage.tsx`

- [ ] **Step 11.1: LotHistoryPage 기본 구현**

Replace `src/pages/LotHistoryPage.tsx`:
```tsx
import { useState } from 'react';
import { useLots } from '../hooks/useLots';
import type { LotSummary } from '../hooks/useLots';
import { DataTable } from '../components/common/DataTable';
import type { Column } from '../components/common/DataTable';
import { Pill } from '../components/common/Pill';
import { fmt } from '../utils/formatting';

const columns: Column<LotSummary>[] = [
  { key: 'lot_no',     header: 'LOT번호',  render: (r) => <span className="font-mono text-xs">{r.lot_no}</span> },
  { key: 'started_at', header: '생산일시', render: (r) => r.started_at ? new Date(r.started_at).toLocaleString('ko-KR') : '-' },
  { key: 'client',     header: '납품처',   render: (r) => r.client_name },
  { key: 'target',     header: '목표수량', align: 'right', render: (r) => r.target_quantity != null ? fmt.int(r.target_quantity) : '-' },
  { key: 'inspected',  header: '검사수량', align: 'right', render: (r) => fmt.int(r.inspected) },
  { key: 'defect',     header: '불량수',   align: 'right', render: (r) => fmt.int(r.defect_count) },
  { key: 'rate',       header: '불량률',   align: 'right', render: (r) => fmt.pct(r.defect_rate_pct, 2) },
  {
    key: 'judgment', header: '판정', align: 'center',
    render: (r) =>
      r.judgment === '정상' ? <Pill variant="ok">정상</Pill> :
      r.judgment === '주의' ? <Pill variant="warn">주의</Pill> :
      r.judgment === '불합격' ? <Pill variant="danger">불합격</Pill> :
      <span className="text-text-muted text-xs">{r.judgment}</span>
  },
];

export function LotHistoryPage() {
  const [search, setSearch]       = useState('');
  const [clientName, setClient]   = useState('');
  const [judgment, setJudgment]   = useState('');
  const [date, setDate]           = useState('');
  const [selected, setSelected]   = useState<LotSummary | null>(null);

  const { data: rows = [], isLoading } = useLots({ search, clientName, judgment, date });

  function reset() {
    setSearch(''); setClient(''); setJudgment(''); setDate('');
  }

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <section className="bg-surface border border-border rounded-lg p-3 flex flex-wrap items-center gap-2">
        <input
          placeholder="LOT번호 / 납품처 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] border border-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
        />
        <select
          value={clientName}
          onChange={(e) => setClient(e.target.value)}
          className="border border-border rounded px-2.5 py-1.5 text-xs bg-surface"
        >
          <option value="">전체 납품처</option>
          <option value="삼성웰스토리">삼성웰스토리</option>
          <option value="CJ프레시웨이">CJ프레시웨이</option>
          <option value="PSI">PSI</option>
        </select>
        <select
          value={judgment}
          onChange={(e) => setJudgment(e.target.value)}
          className="border border-border rounded px-2.5 py-1.5 text-xs bg-surface"
        >
          <option value="">전체 판정</option>
          <option value="정상">정상</option>
          <option value="주의">주의</option>
          <option value="불합격">불합격</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-border rounded px-2.5 py-1.5 text-xs"
        />
        <button
          onClick={() => alert('PDF 출력은 Phase 4에서 구현됩니다.')}
          className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary-dark"
        >
          PDF 출력
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 border border-border rounded text-xs text-text-dim hover:border-primary"
        >
          초기화
        </button>
      </section>

      {/* 테이블 */}
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        onRowClick={(r) => setSelected(r)}
        empty="조건에 맞는 LOT이 없습니다."
      />
      <div className="text-[11px] text-text-muted">총 {rows.length}건</div>

      {/* 상세 패널 */}
      {selected && (
        <section className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-text">LOT 상세 — {selected.lot_no}</div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-text-dim hover:text-danger"
            >
              닫기
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <DetailField label="납품처" value={selected.client_name} />
            <DetailField label="제품명" value={selected.product_name ?? '-'} />
            <DetailField label="목표수량" value={selected.target_quantity != null ? fmt.ea(selected.target_quantity) : '-'} />
            <DetailField label="상태" value={selected.status} />
            <DetailField label="검사수량" value={fmt.ea(selected.inspected)} />
            <DetailField label="양품" value={fmt.ea(selected.good_count)} />
            <DetailField label="불량" value={fmt.ea(selected.defect_count)} />
            <DetailField label="불량률" value={fmt.pct(selected.defect_rate_pct, 2)} />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => alert('클레임 대응 보고서 작성은 Phase 4에서 구현됩니다.')}
              className="px-3 py-1.5 border border-border rounded text-xs text-text-dim hover:border-primary"
            >
              클레임 대응 보고서 작성
            </button>
            <button
              onClick={() => alert('PDF 출력은 Phase 4에서 구현됩니다.')}
              className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary-dark"
            >
              PDF 출력
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-text-muted mb-0.5">{label}</div>
      <div className="text-xs font-medium text-text">{value}</div>
    </div>
  );
}
```

- [ ] **Step 11.2: 검증 + 커밋**

```bash
pnpm lint && pnpm typecheck && pnpm build
git add -A
git commit -m "feat(lot): implement LOT history page with filter, table, detail panel"
```

---

## Task 12: 페이지 스모크 테스트

**Files:**
- Create: `src/pages/KpiPage.test.tsx`, `src/pages/LotHistoryPage.test.tsx`

- [ ] **Step 12.1: KpiPage 스모크 테스트**

Create `src/pages/KpiPage.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KpiPage } from './KpiPage';

vi.mock('../hooks/useKpiData', () => ({
  useKpiData: () => ({
    data: {
      today_production: 11240,
      runtime_sec_today: 22110,
      hourly_production: 1832,
      work_time_per_ea: 1.97,
      inspected: 11240,
      defects: 90,
      defect_rate_pct: 0.80,
      claims_count: 0,
    },
    isLoading: false,
  }),
  useHourlyProduction: () => ({ data: [] }),
}));

vi.mock('../hooks/useCostRatio', () => ({
  useCostRatio: () => ({ data: { wip_total: 1250, total_production: 11240, cost_ratio_pct: 11.2 } }),
  useCostRatio7Days: () => ({ data: [] }),
}));

vi.mock('../hooks/useDeviceStatus', () => ({
  useDeviceStatus: () => ({ data: [] }),
}));

vi.mock('../hooks/useAlarms', () => ({
  useAlarms: () => ({ data: [] }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('KpiPage', () => {
  it('renders all 6 KPI cards with values', () => {
    render(wrap(<KpiPage />));
    expect(screen.getByText('오늘 생산량')).toBeInTheDocument();
    expect(screen.getByText('11,240')).toBeInTheDocument();
    expect(screen.getByText('시간당 생산량')).toBeInTheDocument();
    expect(screen.getByText('1,832')).toBeInTheDocument();
    expect(screen.getByText('작업시간 / ea')).toBeInTheDocument();
    expect(screen.getByText('불량률')).toBeInTheDocument();
    expect(screen.getByText('제조원가 비율')).toBeInTheDocument();
    expect(screen.getByText('고객 클레임')).toBeInTheDocument();
  });

  it('renders formula boxes with calculation results', () => {
    render(wrap(<KpiPage />));
    expect(screen.getAllByText(/산출식:/).length).toBeGreaterThanOrEqual(6);
  });
});
```

- [ ] **Step 12.2: LotHistoryPage 스모크 테스트**

Create `src/pages/LotHistoryPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LotHistoryPage } from './LotHistoryPage';

const useLotsMock = vi.fn();
vi.mock('../hooks/useLots', () => ({
  useLots: (...args: unknown[]) => useLotsMock(...args),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LotHistoryPage', () => {
  beforeEach(() => {
    useLotsMock.mockReturnValue({
      data: [
        {
          id: 'l1', lot_no: 'LOT-TEST-1', client_id: 'c1', client_name: '삼성웰스토리',
          product_name: '온열팩', status: 'running', started_at: '2026-04-23T08:00:00+09:00',
          ended_at: null, target_quantity: 3000, notes: null,
          inspected: 2800, good_count: 2780, defect_count: 15, unknown_count: 5,
          defect_rate_pct: 0.54, judgment: '정상',
        },
      ],
      isLoading: false,
    });
  });

  it('renders table with one LOT row', () => {
    render(wrap(<LotHistoryPage />));
    expect(screen.getByText('LOT-TEST-1')).toBeInTheDocument();
    expect(screen.getByText('삼성웰스토리')).toBeInTheDocument();
    expect(screen.getByText('정상')).toBeInTheDocument();
  });

  it('opens detail panel on row click', () => {
    render(wrap(<LotHistoryPage />));
    fireEvent.click(screen.getByText('LOT-TEST-1'));
    expect(screen.getByText(/LOT 상세 — LOT-TEST-1/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 12.3: 검증 + 커밋**

```bash
pnpm test
```
Expected: 3 (기존) + 2 (KpiPage) + 2 (LotHistoryPage) = 7 tests pass.

Commit:
```bash
git add -A
git commit -m "test: add smoke tests for KpiPage and LotHistoryPage"
```

---

## Task 13: 모바일 반응형 확인 및 정돈

**Files:**
- Modify (as needed): 각 페이지의 grid/flex 클래스 점검

- [ ] **Step 13.1: 뷰포트 수동 확인**

```bash
pnpm dev
```

아래 뷰포트에서 각 페이지 확인 (Chrome DevTools 또는 다른 브라우저):
- iPhone 14 (390 × 844)
- iPad (768 × 1024)
- Desktop (1440 × 900)

체크리스트:
- [ ] Header: 모바일에서 햄버거 메뉴 동작, 로그아웃 버튼 표시되는지
- [ ] KpiPage: 6개 KPI 카드가 모바일에서 2열, 태블릿에서 3열, 데스크톱에서 6열
- [ ] KpiPage: 설비 상태 그리드 동일한 패턴
- [ ] KpiPage: 차트 2개가 모바일에서 세로로 쌓이는지
- [ ] AiPage: 3개 카드가 모바일에서 1열, 데스크톱에서 3열
- [ ] CostPage: 공정 흐름 가로 스크롤 동작 (overflow-x-auto)
- [ ] CostPage: 스탯 카드 4개 모바일 2열, 데스크톱 4열
- [ ] LotHistoryPage: 필터 바 모바일에서 랩, 테이블 가로 스크롤
- [ ] LotHistoryPage: 상세 패널 필드 모바일 2열

이슈 발견 시 해당 컴포넌트의 grid/flex 클래스 보정.

- [ ] **Step 13.2: 커밋 (수정이 있었다면)**

```bash
git add -A
git commit -m "style: refine responsive breakpoints for dashboard pages"
```

수정 없으면 skip.

---

## Task 14: Phase 2 문서 보강 + README 업데이트

**Files:**
- Modify: `README.md`

- [ ] **Step 14.1: README Phase 2 섹션 추가**

`README.md`에서 "**Phase 1 범위:**" 섹션 바로 아래에 추가:
```markdown
**Phase 2 범위:** 모니터링 탭 — 4개 탭(실시간 KPI / AI 성능지표 / 제조원가 / LOT 이력)이 실데이터로 동작, 차트 + 산출식 박스 포함.

## 목업 데이터 로드 (실장비 없이 시각 확인)

\`\`\`bash
supabase db reset              # 마이그레이션 + 시드 재적용
pnpm db:mock                   # 오늘 6시간 분량 mock 메트릭 + 3 LOT
\`\`\`

이후 `pnpm dev` → 로그인 → 각 탭에서 데이터가 채워진 모습 확인 가능.
```

(정확한 위치는 기존 README 구조에 맞게 조정.)

- [ ] **Step 14.2: 커밋**

```bash
git add -A
git commit -m "docs: describe Phase 2 scope and mock data workflow in README"
```

---

## Task 15: Phase 2 전체 회귀 테스트 + 태그

- [ ] **Step 15.1: 전체 회귀**

```bash
cd /Users/seonjecho/Projects/OngiDashboard

# 정적
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test                     # 7 tests 이상

# DB
supabase stop
supabase start
supabase db reset             # 20 migrations
supabase test db              # 48 pgTAP tests

# Mock + 시각 확인
pnpm db:mock
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "select today_production, defect_rate_pct from v_daily_kpi;"

# 타입 동기화 (뷰 추가됐으므로 regen 필요)
pnpm types:gen
git diff src/types/db.ts
# view 타입이 추가되었을 것. diff가 있으면 commit으로 싱크.
```

만약 `pnpm types:gen`이 diff를 만들면:
```bash
git add src/types/db.ts
git commit -m "chore(types): regen Supabase types for Phase 2 views"
```

- [ ] **Step 15.2: 통합 테스트**

```bash
export SUPABASE_ANON_KEY=$(supabase status -o env | grep "^ANON_KEY=" | cut -d= -f2- | tr -d '"')
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep "^SERVICE_ROLE_KEY=" | cut -d= -f2- | tr -d '"')
pnpm test:integration         # 7 tests (Phase 1 ingest, still green)
```

- [ ] **Step 15.3: 수동 브라우저 확인**

`pnpm dev` → 로그인 → 각 탭을 방문. 기대:
- `/kpi`: 6 KPI 카드 모두 mock 데이터 기반 숫자 표시, 산출식 박스 보임, 차트·진행률·설비상태·알람 섹션 모두 렌더링
- `/ai`: 3 AI 카드 + 차트 2개 + 모델 정보 블록
- `/cost`: Hero + 공정 흐름 + 스탯 4개 + 차트 2개
- `/lot`: 3 mock LOT 테이블 표시, 행 클릭 시 상세 패널, 필터 동작

- [ ] **Step 15.4: Phase 2 태그**

```bash
git tag phase-2-complete
git log --oneline | head -25
git tag --list
```

- [ ] **Step 15.5: main 머지 결정**

```bash
git checkout main
git merge --ff-only phase-2-dashboards
git log --oneline | head -5
```

또는 PR 프로세스를 원하면 skip.

---

## Phase 2 완료 판정 체크리스트

- [x] `pnpm lint && pnpm typecheck && pnpm build && pnpm test` 전 녹색
- [x] `supabase db reset && supabase test db` 전 녹색 (48 tests)
- [x] `pnpm db:mock` → `/kpi`, `/ai`, `/cost`, `/lot` 탭 모두 데이터 표시
- [x] 모바일/태블릿/데스크톱 뷰포트 모두 렌더링 깨짐 없음
- [x] `phase-2-complete` 태그 부여
- [x] (선택) main 머지

**다음 단계 (Phase 3):** 관리 기능 — admin CRUD 페이지 6개 + 알람 엔진 (트리거 + Realtime 토스트) + 사용자 초대 Edge Function.
