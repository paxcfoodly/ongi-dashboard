begin;
select plan(11);

-- 빈 상태: 행은 항상 1개, lot_count = 0, 평균은 null (0 아님)
select is((select lot_count from v_kpi_manhour), 0,
  'v_kpi_manhour: empty -> lot_count = 0');
select ok((select avg_man_hour is null and latest_man_hour is null from v_kpi_manhour),
  'v_kpi_manhour: empty -> avg/latest are NULL (not 0)');

insert into clients (name) values ('KPI View Client') returning id \gset client_

-- A: 3명 x 8h = 24, 완료 (1일 전 종료)
insert into lots (lot_no, client_id, worker_count, started_at, ended_at, status) values
 ('KPI3-A', :'client_id', 3, now() - interval '1 day 8 hours', now() - interval '1 day', 'completed'),
-- B: 4명 x 2h = 8, 완료 (A보다 늦게 종료 -> 최신)
 ('KPI3-B', :'client_id', 4, now() - interval '2 hours', now(), 'completed'),
-- C: 진행 중 (ended_at null) -> 제외
 ('KPI3-C', :'client_id', 5, now() - interval '3 hours', null, 'running'),
-- D: 완료지만 worker_count null -> 제외
 ('KPI3-D', :'client_id', null, now() - interval '5 hours', now() - interval '1 hour', 'completed');

select is((select count(*)::int from v_lot_manhour where lot_no like 'KPI3-%'), 2,
  'v_lot_manhour: only completed LOTs with worker_count (A, B)');
select is((select man_hour from v_lot_manhour where lot_no = 'KPI3-A'), 24.00::numeric,
  'v_lot_manhour: A man_hour = 3 x 8h = 24.00');
select is((select avg_man_hour from v_kpi_manhour), 16.00::numeric,
  'v_kpi_manhour: avg = (24 + 8) / 2 = 16.00');
select is((select lot_count from v_kpi_manhour), 2, 'v_kpi_manhour: lot_count = 2');
select is((select latest_man_hour from v_kpi_manhour), 8.00::numeric,
  'v_kpi_manhour: latest_man_hour = B (8.00)');

-- E: 40일 전 종료 -> 30일 범위 밖, 평균/건수에 영향 없음
insert into lots (lot_no, client_id, worker_count, started_at, ended_at, status)
values ('KPI3-E', :'client_id', 10, now() - interval '40 days 5 hours',
        now() - interval '40 days', 'completed');
select is((select lot_count from v_kpi_manhour), 2,
  'v_kpi_manhour: 40-day-old LOT excluded');

-- F: 수주일 = 출하일(같은 날) -> lead_days = 0 이고 집계에 포함
insert into lots (lot_no, client_id, ordered_at, shipped_at)
values ('KPI3-F', :'client_id', current_date, current_date);
select is((select lead_days from v_lot_leadtime where lot_no = 'KPI3-F'), 0,
  'v_lot_leadtime: same-day order/ship -> lead_days = 0');
select is((select lot_count from v_kpi_leadtime), 1,
  'v_kpi_leadtime: same-day LOT is counted');

-- v_lot_summary 확장 컬럼
select is((select man_hour from v_lot_summary where lot_no = 'KPI3-A'), 24.00::numeric,
  'v_lot_summary: A man_hour = 24.00');

select * from finish();
rollback;
