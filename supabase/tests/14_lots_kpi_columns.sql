begin;
select plan(8);

select has_column('lots', 'worker_count', 'lots.worker_count 존재');
select has_column('lots', 'ordered_at', 'lots.ordered_at 존재');
select has_column('lots', 'shipped_at', 'lots.shipped_at 존재');

insert into clients (name) values ('KPI Col Client') returning id \gset client_

-- worker_count = 0 은 check 위반
prepare bad_worker as
  insert into lots (lot_no, client_id, worker_count)
  values ('LOT-KPI-W0', :'client_id', 0);
select throws_like('execute bad_worker', '%check%', 'worker_count = 0 rejected');

-- worker_count 상한(1000) 초과는 거부
prepare bad_worker_max as
  insert into lots (lot_no, client_id, worker_count)
  values ('LOT-KPI-W1001', :'client_id', 1001);
select throws_like('execute bad_worker_max', '%lots_worker_count_range%', 'worker_count = 1001 rejected');

-- 출하일 < 수주일은 거부
prepare bad_ship as
  insert into lots (lot_no, client_id, ordered_at, shipped_at)
  values ('LOT-KPI-S1', :'client_id', '2026-10-10', '2026-10-09');
select throws_like('execute bad_ship', '%lots_shipped_after_ordered%',
  'shipped_at < ordered_at rejected');

-- 수주일 = 출하일 (같은 날)은 허용
select lives_ok($$
  insert into lots (lot_no, client_id, ordered_at, shipped_at)
  values ('LOT-KPI-S2', (select id from clients where name = 'KPI Col Client'),
          '2026-10-10', '2026-10-10')
$$, 'ordered_at = shipped_at accepted');

-- 기존 lots_end_after_start 제약: ended_at < started_at update 거부
insert into lots (lot_no, client_id, started_at, ended_at)
values ('LOT-KPI-E1', :'client_id', '2026-10-10T08:00:00+09:00', '2026-10-10T10:00:00+09:00');
prepare bad_end_update as
  update lots set ended_at = '2026-10-10T07:00:00+09:00' where lot_no = 'LOT-KPI-E1';
select throws_like('execute bad_end_update', '%lots_end_after_start%',
  'ended_at < started_at update rejected');

select * from finish();
rollback;
