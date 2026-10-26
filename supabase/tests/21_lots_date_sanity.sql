begin;
select plan(10);

-- 연도 오타(0026 등)·비정상 기간으로 공수·리드타임 숫자가 넘치지 않도록 lots 날짜 제약을 검증한다
insert into clients (name) values ('Date Sanity Client') returning id \gset client_

-- 하한: 2020-01-01 이전 시각·날짜는 필드별 제약으로 거부
prepare bad_start as
  insert into lots (lot_no, client_id, started_at)
  values ('DS-START', :'client_id', '0026-10-20T09:00:00+09:00');
select throws_like('execute bad_start', '%lots_started_at_min%', 'started_at in year 0026 rejected');

prepare bad_end as
  insert into lots (lot_no, client_id, ended_at)
  values ('DS-END', :'client_id', '2019-12-31T23:59:59+09:00');
select throws_like('execute bad_end', '%lots_ended_at_min%', 'ended_at before 2020-01-01 KST rejected');

prepare bad_order as
  insert into lots (lot_no, client_id, ordered_at)
  values ('DS-ORDER', :'client_id', '0026-10-20');
select throws_like('execute bad_order', '%lots_ordered_at_min%', 'ordered_at in year 0026 rejected');

prepare bad_ship as
  insert into lots (lot_no, client_id, shipped_at)
  values ('DS-SHIP', :'client_id', '2019-12-31');
select throws_like('execute bad_ship', '%lots_shipped_at_min%', 'shipped_at before 2020-01-01 rejected');

-- 정상 행: 하한 경계(2020-01-01 KST 0시), 작업 31일, 리드타임 366일은 허용
select lives_ok($$
  insert into lots (lot_no, client_id, worker_count, started_at, ended_at, ordered_at, shipped_at)
  values ('DS-OK', (select id from clients where name = 'Date Sanity Client'), 6,
          '2020-01-01T00:00:00+09:00', '2020-02-01T00:00:00+09:00', '2020-01-01', '2021-01-01')
$$, 'valid row at all boundaries (2020-01-01, 31 days, 366 days) accepted');

-- 작업 기간 32일은 거부 (update)
prepare long_work as
  update lots set ended_at = '2020-02-02T00:00:00+09:00' where lot_no = 'DS-OK';
select throws_like('execute long_work', '%lots_work_duration_max%', '32-day work duration rejected');

-- 시작 시각을 0026 년으로 바꾸는 update 도 거부 (공수 overflow 재현 경로)
prepare typo_update as
  update lots set started_at = '0026-01-01T00:00:00+09:00' where lot_no = 'DS-OK';
select throws_like('execute typo_update', '%lots_%', 'started_at typo update rejected');

-- 리드타임 400일은 거부 (insert / update)
prepare long_lead as
  insert into lots (lot_no, client_id, ordered_at, shipped_at)
  values ('DS-LEAD', :'client_id', '2025-01-01', date '2025-01-01' + 400);
select throws_like('execute long_lead', '%lots_lead_time_max%', '400-day lead time rejected');

prepare long_lead_update as
  update lots set shipped_at = ordered_at + 400 where lot_no = 'DS-OK';
select throws_like('execute long_lead_update', '%lots_lead_time_max%', '400-day lead time update rejected');

-- 정상 행은 KPI 뷰 조회에서 overflow 없이 계산된다 (6명 x 31일 = 4464.00)
select is((select man_hour from v_lot_manhour where lot_no = 'DS-OK'), 4464.00::numeric,
  'v_lot_manhour computes max-duration row without overflow');

select * from finish();
rollback;
