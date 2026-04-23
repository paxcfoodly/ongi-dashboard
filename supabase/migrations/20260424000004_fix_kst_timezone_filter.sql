-- Fix: 세션 타임존(UTC)에서 뷰 필터 `bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')` 이
-- naive timestamp를 세션 tz(UTC)로 해석해서 "KST 오늘 09시 이후" 데이터만 걸러내는 버그 수정.
-- 올바른 방식: naive KST timestamp를 명시적으로 `AT TIME ZONE 'Asia/Seoul'`로 timestamptz(UTC)로 재변환.
--
-- 헬퍼 함수로 축약: fn_kst_today_start() returns UTC timestamptz of "today 00:00 KST"

create or replace function fn_kst_today_start() returns timestamptz
language sql stable as $$
  select (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamp at time zone 'Asia/Seoul'
$$;

-- ─────────────────────────────────────────────────────────────
-- v_daily_kpi
-- ─────────────────────────────────────────────────────────────
create or replace view v_daily_kpi as
with today_packaging as (
  select coalesce(sum(output_count), 0)::int        as today_production,
         coalesce(sum(runtime_seconds), 0)::numeric as runtime_sec_today
  from equipment_metrics em
  join devices d on d.id = em.device_id
  where d.role = 'primary_output' and d.active
    and bucket_at >= fn_kst_today_start()
),
today_vision as (
  select coalesce(sum(total_inspected), 0)::int as inspected,
         coalesce(sum(defect_count), 0)::int    as defects
  from vision_inspector_metrics vim
  join devices d on d.id = vim.device_id
  where d.type = 'vision_inspector' and d.active
    and bucket_at >= fn_kst_today_start()
),
quarter_claims as (
  select count(*)::int as claims_count
  from claims
  where received_at >= (date_trunc('quarter', now() at time zone 'Asia/Seoul'))::timestamp at time zone 'Asia/Seoul'
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

-- ─────────────────────────────────────────────────────────────
-- v_ai_metrics
-- ─────────────────────────────────────────────────────────────
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
  and bucket_at >= fn_kst_today_start();

-- ─────────────────────────────────────────────────────────────
-- v_wip_flow
-- ─────────────────────────────────────────────────────────────
create or replace view v_wip_flow as
with today_by_device as (
  select d.id, d.code, d.name, d.type, d.process_order,
         coalesce(
           (select sum(em.output_count)
            from equipment_metrics em
            where em.device_id = d.id
              and em.bucket_at >= fn_kst_today_start()),
           (select sum(vim.total_inspected)
            from vision_inspector_metrics vim
            where vim.device_id = d.id
              and vim.bucket_at >= fn_kst_today_start()),
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

-- v_cost_ratio는 변경 없음 (v_daily_kpi, v_wip_flow 참조만 하므로 자동 수정됨)

grant execute on function fn_kst_today_start() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RPC 함수들도 수정
-- ─────────────────────────────────────────────────────────────
create or replace function fn_hourly_production_today()
returns table(hour text, output int)
language sql stable security definer set search_path = public as $$
  select
    to_char(date_trunc('hour', bucket_at at time zone 'Asia/Seoul'), 'HH24') as hour,
    sum(output_count)::int as output
  from equipment_metrics em
  join devices d on d.id = em.device_id
  where d.role = 'primary_output'
    and bucket_at >= fn_kst_today_start()
  group by 1
  order by 1;
$$;

-- fn_cost_ratio_7days는 `d.day` (date) vs `em.bucket_at` (timestamptz) 비교인데,
-- 일자(date)를 timestamptz로 암묵 변환 시 세션 tz(UTC)로 해석됨 → KST day 경계와 오차 발생.
-- 명시적으로 KST 경계 사용.
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
  bounds as (
    select day,
           (day::timestamp            at time zone 'Asia/Seoul') as day_start_kst,
           ((day + 1)::timestamp      at time zone 'Asia/Seoul') as day_end_kst
      from days
  ),
  daily as (
    select
      b.day,
      coalesce(
        (select sum(em.output_count)::int
         from equipment_metrics em
         join devices dv on dv.id = em.device_id
         where dv.role = 'primary_output'
           and em.bucket_at >= b.day_start_kst
           and em.bucket_at <  b.day_end_kst),
        0
      ) as total_prod,
      coalesce(
        (select sum(vim.total_inspected - vim.good_count)::int
         from vision_inspector_metrics vim
         join devices dv on dv.id = vim.device_id
         where dv.type = 'vision_inspector'
           and vim.bucket_at >= b.day_start_kst
           and vim.bucket_at <  b.day_end_kst),
        0
      ) as wip_approx
    from bounds b
  )
  select
    to_char(day, 'MM/DD') as label,
    case when total_prod = 0 then 0
         else round(wip_approx::numeric / total_prod * 100, 2)
    end as value
  from daily
  order by day;
$$;
