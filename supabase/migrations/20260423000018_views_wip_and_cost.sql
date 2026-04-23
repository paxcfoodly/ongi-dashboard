create or replace view v_wip_flow as
with today_by_device as (
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
