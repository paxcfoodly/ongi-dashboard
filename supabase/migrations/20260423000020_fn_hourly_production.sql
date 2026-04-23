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
