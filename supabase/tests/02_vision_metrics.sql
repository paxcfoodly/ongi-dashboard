begin;
select plan(5);

select has_table('vision_inspector_metrics');

-- 정상 삽입
insert into devices (code, name, type, process_order, api_key_hash)
values ('vim_test', 'vim test', 'vision_inspector', 1, 'h') returning id \gset dev_
insert into vision_inspector_metrics
  (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
values (:'dev_id', '2026-04-23T10:00:00+09:00', 100, 95, 3, 2, 60.5);
select ok(exists (select 1 from vision_inspector_metrics where total_inspected = 100),
  'valid insert succeeds');

-- UNIQUE 위반
prepare dup_insert as
  insert into vision_inspector_metrics
    (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
  values (:'dev_id', '2026-04-23T10:00:00+09:00', 50, 50, 0, 0, 30);
select throws_ok('execute dup_insert', '23505',
  'duplicate key value violates unique constraint "vim_unique_bucket"',
  'UNIQUE (device_id, bucket_at) blocks duplicate');

-- 합계 불일치 CHECK 위반
prepare bad_sum as
  insert into vision_inspector_metrics
    (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
  values (:'dev_id', '2026-04-23T11:00:00+09:00', 100, 10, 10, 10, 30);
select throws_ok('execute bad_sum', '23514',
  'new row for relation "vision_inspector_metrics" violates check constraint "vim_total_sum_check"',
  'sum constraint enforced');

-- 음수 방지
prepare negative as
  insert into vision_inspector_metrics
    (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
  values (:'dev_id', '2026-04-23T12:00:00+09:00', -1, 0, 0, 0, 0);
select throws_ok('execute negative', '23514', null, 'negative value rejected');

select * from finish();
rollback;
