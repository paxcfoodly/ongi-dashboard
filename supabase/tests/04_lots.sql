begin;
select plan(4);

select has_table('clients');
select has_table('lots');
select has_table('claims');

-- CHECK (ended_at >= started_at) 제약 검증
insert into clients (name) values ('Test Client') returning id \gset client_

prepare bad_end as
  insert into lots (lot_no, client_id, target_quantity, started_at, ended_at)
  values ('LOT-TEST-2', :'client_id', 100, '2026-04-23T08:00:00+09:00', '2026-04-23T07:00:00+09:00');
select throws_ok('execute bad_end', '23514', null, 'ended_at < started_at rejected');

select * from finish();
rollback;
