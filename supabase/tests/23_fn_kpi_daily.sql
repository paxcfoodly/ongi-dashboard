begin;
select plan(13);

-- 기간 KPI 일별 집계 RPC 검증: KST 날짜 귀속, 장비 필터, 0 채움, 입력 검증, 권한
-- 기대값은 seed 데이터가 없는 2026-01-05 ~ 2026-01-07 에만 둔다
insert into devices (code, name, type, process_order, api_key_hash, role, active) values
  ('kd_p', 'kd primary',  'equipment',        91, 'h', 'primary_output', true),
  ('kd_x', 'kd inactive', 'equipment',        92, 'h', 'primary_output', false),
  ('kd_q', 'kd other',    'equipment',        93, 'h', 'process',        true),
  ('kd_v', 'kd vision',   'vision_inspector', 94, 'h', null,             true);
select id as p_id from devices where code = 'kd_p' \gset
select id as x_id from devices where code = 'kd_x' \gset
select id as q_id from devices where code = 'kd_q' \gset
select id as v_id from devices where code = 'kd_v' \gset

-- P: 01-05 3건(자정 직전 포함) + 01-06 00:00 1건
insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count) values
  (:'p_id', '2026-01-05 10:00+09', 58, 28),
  (:'p_id', '2026-01-05 10:01+09', 54, 30),
  (:'p_id', '2026-01-05 23:59+09', 60, 5),
  (:'p_id', '2026-01-06 00:00+09', 60, 7),
  -- 비활성 장비·다른 role 장비는 집계에서 제외되어야 한다
  (:'x_id', '2026-01-05 10:00+09', 60, 1000),
  (:'q_id', '2026-01-05 10:00+09', 60, 1000);

insert into vision_inspector_metrics
  (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
values (:'v_id', '2026-01-05 10:00+09', 30, 28, 1, 1, 55.5);

-- 01-06 23:30 KST 클레임은 다음 날(UTC 기준 01-06)로 밀리지 않고 01-06 에 잡혀야 한다
insert into clients (name) values ('KPI Daily Client') returning id \gset client_
insert into claims (client_id, received_at) values (:'client_id', '2026-01-06 23:30+09');

select is((select count(*) from fn_kpi_daily('2026-01-05', '2026-01-07')), 3::bigint,
  'fn_kpi_daily: 기간의 모든 날짜가 한 행씩 나온다');
select is(array(select day from fn_kpi_daily('2026-01-05', '2026-01-07') order by day),
  array['2026-01-05', '2026-01-06', '2026-01-07']::date[],
  'fn_kpi_daily: 기본 반환이 day 오름차순이다');
select is(array(select day from fn_kpi_daily('2026-01-05', '2026-01-07')),
  array['2026-01-05', '2026-01-06', '2026-01-07']::date[],
  'fn_kpi_daily: ORDER BY 없이도 day 오름차순');

select results_eq(
  $$ select production, runtime_sec, inspected, defects, "unknown", inspection_time_sec, claims
       from fn_kpi_daily('2026-01-05', '2026-01-07') where day = '2026-01-05' $$,
  $$ values (63, 172, 30, 1, 1, 55.5::numeric, 0) $$,
  'fn_kpi_daily: 01-05 행 (제외 장비 미포함, 23:59 KST 포함)');
select results_eq(
  $$ select production, runtime_sec, inspected, defects, "unknown", inspection_time_sec, claims
       from fn_kpi_daily('2026-01-05', '2026-01-07') where day = '2026-01-06' $$,
  $$ values (7, 60, 0, 0, 0, 0::numeric, 1) $$,
  'fn_kpi_daily: 01-06 행 (00:00 KST 는 01-06, 23:30 KST 클레임은 01-06)');
select results_eq(
  $$ select production, runtime_sec, inspected, defects, "unknown", inspection_time_sec, claims
       from fn_kpi_daily('2026-01-05', '2026-01-07') where day = '2026-01-07' $$,
  $$ values (0, 0, 0, 0, 0, 0::numeric, 0) $$,
  'fn_kpi_daily: 데이터 없는 01-07 은 0 채움 행');

-- 입력 검증
select throws_ok($$ select * from fn_kpi_daily('2026-01-07', '2026-01-05') $$, 'P0001', null,
  'fn_kpi_daily: from > to 거부');
select throws_ok(
  format($$ select * from fn_kpi_daily(%L, %L) $$,
    ((now() at time zone 'Asia/Seoul')::date + 1), ((now() at time zone 'Asia/Seoul')::date + 1)),
  'P0001', null, 'fn_kpi_daily: KST 기준 미래 날짜 거부');
select throws_ok($$ select * from fn_kpi_daily('2025-01-01', '2026-01-02') $$, 'P0001', null,
  'fn_kpi_daily: 367일 초과 거부');
select throws_ok($$ select * from fn_kpi_daily('2019-12-31', '2020-01-01') $$, 'P0001', null,
  'fn_kpi_daily: 2020-01-01 이전 거부');
select lives_ok($$ select * from fn_kpi_daily('2025-01-01', '2025-12-31') $$,
  'fn_kpi_daily: 365일 범위는 허용');

-- 권한: anon 은 실행 불가, authenticated 는 가능
-- 주의: 로컬 Postgres 17.6 이미지가 함수 권한 거부(42501) 에러 보고 중 segfault 하므로
--       anon 으로 직접 호출하지 않고 권한 카탈로그로 검증한다
select ok(not has_function_privilege('anon', 'fn_kpi_daily(date,date)', 'execute'),
  'fn_kpi_daily: anon 실행 권한 없음');
select ok(has_function_privilege('authenticated', 'fn_kpi_daily(date,date)', 'execute'),
  'fn_kpi_daily: authenticated 실행 가능');

select * from finish();
rollback;
