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
