begin;
select plan(11);

select has_column('public', 'devices', 'monitored', 'devices.monitored 컬럼 존재');
select col_not_null('public', 'devices', 'monitored', 'monitored는 NOT NULL');
select col_default_is('public', 'devices', 'monitored', 'true', '새 장비는 기본 모니터링 대상');

-- 온기 기준: 포장기·비전검사기만 모니터링
select results_eq(
  $$select code from devices where monitored and code in ('packaging_01','vision_01','caser_01','taper_01','wrapper_01','conveyor_01') order by code$$,
  $$values ('packaging_01'::text), ('vision_01'::text)$$,
  '포장기·비전검사기만 모니터링 대상'
);
select is(
  (select count(*)::int from devices where not monitored and code in ('caser_01','taper_01','wrapper_01','conveyor_01')),
  4, '나머지 4대는 모니터링 제외'
);
select ok(
  (select bool_and(active) from devices where code in ('caser_01','taper_01','wrapper_01','conveyor_01')),
  '제외 장비도 활성 유지 (데이터 수신은 계속 가능)'
);

-- 오프라인 알람 생성 동작
delete from alarms;
update devices set last_seen_at = null;
select fn_check_device_offline();

select is(
  (select count(*)::int from alarms a join devices d on d.id = a.device_id where not d.monitored and a.metadata->>'kind' = 'device_offline'),
  0, '모니터링 제외 장비는 오프라인 알람이 생성되지 않음'
);
select is(
  (select count(*)::int from alarms a join devices d on d.id = a.device_id where d.code in ('packaging_01','vision_01') and a.metadata->>'kind' = 'device_offline'),
  2, '모니터링 장비는 오프라인 알람이 그대로 생성됨'
);

-- 다시 켜면 알람도 다시 생성됨
update devices set monitored = true where code = 'caser_01';
select fn_check_device_offline();
select is(
  (select count(*)::int from alarms a join devices d on d.id = a.device_id where d.code = 'caser_01'),
  1, '다시 켜면 오프라인 알람 재개'
);
-- 30분 중복 방지 유지
select fn_check_device_offline();
select is(
  (select count(*)::int from alarms a join devices d on d.id = a.device_id where d.code = 'caser_01'),
  1, '30분 내 중복 생성 방지 유지'
);

-- 수신 기록이 최근이면 알람 없음
delete from alarms;
update devices set last_seen_at = now();
select fn_check_device_offline();
select is((select count(*)::int from alarms), 0, '최근 수신 장비는 알람 없음');

select * from finish();
rollback;
