begin;
select plan(4);

select has_function('fn_evaluate_alarms');

-- 임계값 초과 시나리오: defect_rate > 1.0 규칙이 seed되어 있음
-- 비전검사기에 고불량 데이터 삽입 → alarms 생성되어야 함
insert into devices (code, name, type, role, process_order, api_key_hash)
values ('alarm_test_vision', 'alarm test vim', 'vision_inspector', null, 99, 'h')
returning id \gset vim_

insert into vision_inspector_metrics
  (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
values (:'vim_id',
        (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + interval '10 hours',
        100, 70, 25, 5, 60);  -- 불량률 25% → 1% 초과

select ok(
  (select count(*) from alarms where source = 'auto' and metadata->>'metric' = 'defect_rate') >= 1,
  'auto alarm created for defect_rate over threshold'
);

-- 중복 방지: 같은 규칙이 30분 내 재삽입되지 않음
insert into vision_inspector_metrics
  (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
values (:'vim_id',
        (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + interval '11 hours',
        100, 50, 45, 5, 60);

select is(
  (select count(*)::int from alarms where source = 'auto' and metadata->>'metric' = 'defect_rate'),
  1,
  'duplicate alarm suppressed within 30 minutes'
);

-- 정상 범위 삽입 시 새 알람 없음
insert into devices (code, name, type, role, process_order, api_key_hash)
values ('alarm_test_ok', 'alarm test ok', 'equipment', null, 98, 'h')
returning id \gset eq_

-- 기존 alarm row 개수 스냅샷 후 정상 데이터 삽입
select count(*)::int as before_count from alarms where source = 'auto' \gset
insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
values (:'eq_id',
        (date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamptz + interval '12 hours',
        60, 2000);

select is(
  (select count(*)::int from alarms where source = 'auto'),
  :before_count,
  'no new auto alarm when within threshold'
);

select * from finish();
rollback;
