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
