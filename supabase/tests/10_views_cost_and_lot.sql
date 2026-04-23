begin;
select plan(4);

select is((select today_production from v_daily_kpi), 0,
  'v_daily_kpi.today_production returns 0 when no metrics');

select is((select defect_rate_pct from v_daily_kpi), 0::numeric,
  'v_daily_kpi.defect_rate_pct returns 0 when no metrics');

select is((select cost_ratio_pct from v_cost_ratio), 0::numeric,
  'v_cost_ratio.cost_ratio_pct returns 0 when no production');

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
