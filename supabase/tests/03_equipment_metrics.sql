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
