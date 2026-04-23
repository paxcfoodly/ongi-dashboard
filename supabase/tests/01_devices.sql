begin;
select plan(7);

select has_table('devices');
select has_column('devices', 'code');
select has_column('devices', 'role');
select col_is_unique('devices', array['code']);
select col_type_is('devices', 'type', 'device_type');
select col_not_null('devices', 'process_order');

insert into devices (code, name, type, process_order, api_key_hash)
values ('test_01', '테스트장비', 'equipment', 99, 'hash');
select ok((select active from devices where code = 'test_01'),
  'active defaults to true');

select * from finish();
rollback;
