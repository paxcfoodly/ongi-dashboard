begin;
select plan(12);

-- 미래 날짜(오타·시간대 착오)로 입력된 LOT이 30일 KPI 평균·목록에 섞이지 않아야 한다
insert into clients (name) values ('KPI Window Client') returning id \gset client_

insert into lots (lot_no, client_id, worker_count, started_at, ended_at, ordered_at, shipped_at, status) values
-- A: 정상 (어제 종료, 2명 x 4h = 8) / 수주 10일 전, 오늘 출하 -> 10일
 ('WIN-A', :'client_id', 2, now() - interval '1 day 4 hours', now() - interval '1 day',
  current_date - 10, current_date, 'completed'),
-- F: 미래 종료 (3일 뒤, 10명 x 10h = 100) / 미래 출하 (5일 뒤) -> 평균에서 제외
 ('WIN-F', :'client_id', 10, now() + interval '3 days', now() + interval '3 days 10 hours',
  current_date - 1, current_date + 5, 'completed'),
-- O: 40일 전 종료 / 40일 전 출하 -> 30일 창 밖
 ('WIN-O', :'client_id', 1, now() - interval '40 days 2 hours', now() - interval '40 days',
  current_date - 45, current_date - 40, 'completed');

-- 헤드라인 집계 뷰: 미래 LOT 제외
select is((select lot_count from v_kpi_manhour), 1, 'v_kpi_manhour: future ended_at excluded from count');
select is((select avg_man_hour from v_kpi_manhour), 8.00::numeric, 'v_kpi_manhour: avg ignores future LOT');
select is((select latest_man_hour from v_kpi_manhour), 8.00::numeric, 'v_kpi_manhour: latest is not the future LOT');
select is((select lot_count from v_kpi_leadtime), 1, 'v_kpi_leadtime: future shipped_at excluded from count');
select is((select avg_lead_days from v_kpi_leadtime), 10.0::numeric(6,1), 'v_kpi_leadtime: avg ignores future LOT');

-- 표·차트·LLM용 창 뷰: 헤드라인과 같은 30일 창(미래·30일 초과 제외)
select is(array(select lot_no from v_lot_manhour_window where lot_no like 'WIN-%' order by lot_no),
  array['WIN-A']::text[], 'v_lot_manhour_window: same 30-day window as v_kpi_manhour');
select is(array(select lot_no from v_lot_leadtime_window where lot_no like 'WIN-%' order by lot_no),
  array['WIN-A']::text[], 'v_lot_leadtime_window: same 30-day window as v_kpi_leadtime');

-- 000006 보안 설정 유지: security_invoker + 로그인 사용자 select 전용
select ok((select coalesce(reloptions, '{}') @> array['security_invoker=true']
             from pg_class where relname = 'v_kpi_manhour'),
  'v_kpi_manhour keeps security_invoker');
select ok((select coalesce(reloptions, '{}') @> array['security_invoker=true']
             from pg_class where relname = 'v_lot_manhour_window')
      and (select coalesce(reloptions, '{}') @> array['security_invoker=true']
             from pg_class where relname = 'v_lot_leadtime_window'),
  'window views use security_invoker');
select ok(not has_table_privilege('anon', 'v_kpi_leadtime', 'select')
      and not has_table_privilege('anon', 'v_lot_manhour_window', 'select')
      and not has_table_privilege('anon', 'v_lot_leadtime_window', 'select'),
  'anon cannot read KPI/window views');
select ok(has_table_privilege('authenticated', 'v_kpi_manhour', 'select')
      and has_table_privilege('authenticated', 'v_lot_manhour_window', 'select')
      and has_table_privilege('authenticated', 'v_lot_leadtime_window', 'select'),
  'authenticated can read KPI/window views');
select ok(not has_table_privilege('authenticated', 'v_lot_manhour_window', 'update')
      and not has_table_privilege('authenticated', 'v_kpi_manhour', 'update'),
  'authenticated cannot write via KPI/window views');

select * from finish();
rollback;
