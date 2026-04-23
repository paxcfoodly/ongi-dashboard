begin;
select plan(4);

-- anon은 어떤 테이블도 읽을 수 없음
set local role anon;
select is((select count(*) from devices), 0::bigint,
  'anon role cannot read devices');

reset role;

-- authenticated (role 미설정) 은 읽기 가능하지만 쓰기 불가
insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000021', 'viewer@ex.com',
        '00000000-0000-0000-0000-000000000000');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';

select ok((select count(*) from devices) >= 6::bigint,
  'authenticated (viewer) can read devices');

prepare viewer_insert as
  insert into devices (code, name, type, process_order, api_key_hash)
  values ('x', 'x', 'equipment', 99, 'h');
select throws_like('execute viewer_insert', '%row-level security%',
  'viewer cannot write devices');

reset role;

-- admin이 쓰기 가능
insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000022', 'admin@ex.com',
        '00000000-0000-0000-0000-000000000000');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000022';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';

insert into devices (code, name, type, process_order, api_key_hash)
values ('rls_admin_test', 'admin test', 'equipment', 100, 'h');
select ok(exists (select 1 from devices where code = 'rls_admin_test'),
  'admin can write devices');

select * from finish();
rollback;
