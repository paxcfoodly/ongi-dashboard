begin;
select plan(13);

-- 기준 데이터 (슈퍼유저)
insert into clients (name) values ('Secure View Client') returning id \gset client_
insert into lots (lot_no, client_id, worker_count, started_at, ended_at, ordered_at, shipped_at, status)
values ('SEC-A', :'client_id', 3, now() - interval '3 hours', now() - interval '1 hour',
        current_date - 2, current_date, 'completed');

-- anon: KPI 뷰를 통한 UPDATE/DELETE 불가 (공개 anon 키로 lots 변조 차단)
set local role anon;
prepare anon_upd_manhour as update v_lot_manhour set worker_count = 99;
select throws_like('execute anon_upd_manhour', '%permission denied%',
  'anon cannot UPDATE via v_lot_manhour');
prepare anon_del_manhour as delete from v_lot_manhour;
select throws_like('execute anon_del_manhour', '%permission denied%',
  'anon cannot DELETE via v_lot_manhour');
prepare anon_upd_leadtime as update v_lot_leadtime set lot_no = 'HACK';
select throws_like('execute anon_upd_leadtime', '%permission denied%',
  'anon cannot UPDATE via v_lot_leadtime');
prepare anon_del_leadtime as delete from v_lot_leadtime;
select throws_like('execute anon_del_leadtime', '%permission denied%',
  'anon cannot DELETE via v_lot_leadtime');
reset role;

-- 비관리자 authenticated: 쓰기 불가, 읽기 가능
insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000041', 'sec_viewer@ex.com',
        '00000000-0000-0000-0000-000000000000');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000041';

prepare viewer_upd_manhour as update v_lot_manhour set worker_count = 99;
select throws_like('execute viewer_upd_manhour', '%permission denied%',
  'viewer cannot UPDATE via v_lot_manhour');
prepare viewer_del_leadtime as delete from v_lot_leadtime;
select throws_like('execute viewer_del_leadtime', '%permission denied%',
  'viewer cannot DELETE via v_lot_leadtime');

-- security_invoker + lots "authed read" 정책 → 읽기는 그대로 가능하고 행도 보임
select ok(exists (select 1 from v_lot_manhour where lot_no = 'SEC-A'),
  'viewer can read v_lot_manhour rows');
select ok(exists (select 1 from v_lot_leadtime where lot_no = 'SEC-A'),
  'viewer can read v_lot_leadtime rows');
select ok((select lot_count from v_kpi_manhour) >= 1,
  'viewer can read v_kpi_manhour');
select ok((select lot_count from v_kpi_leadtime) >= 1,
  'viewer can read v_kpi_leadtime');
reset role;

-- lots 원본은 변하지 않음
select is((select worker_count from lots where lot_no = 'SEC-A'), 3,
  'lots.worker_count unchanged');
select is((select count(*)::int from lots where lot_no = 'SEC-A'), 1,
  'lots row not deleted');

-- 90일 정리 함수는 anon이 실행할 수 없음 (pg_cron은 postgres로 실행)
select ok(not has_function_privilege('anon', 'fn_purge_ingest_logs()', 'execute'),
  'anon cannot execute fn_purge_ingest_logs');

select * from finish();
rollback;
