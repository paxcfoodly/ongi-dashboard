begin;
select plan(2);

select has_function('fn_set_updated_at');

-- 장비 UPDATE → updated_at이 created_at 이후로 갱신되어야 함
insert into devices (code, name, type, process_order, api_key_hash)
values ('updated_test', 'updated test', 'equipment', 99, 'h')
returning id \gset dev_

-- 1초 대기 대신 created_at을 과거로 수동 세팅
update devices set created_at = now() - interval '1 minute',
                   updated_at = now() - interval '1 minute'
 where id = :'dev_id';

update devices set name = 'updated' where id = :'dev_id';

select ok(
  (select updated_at > created_at from devices where id = :'dev_id'),
  'updated_at advances on UPDATE'
);

select * from finish();
rollback;
