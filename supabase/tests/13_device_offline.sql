begin;
select plan(2);

select has_function('fn_check_device_offline');

insert into devices (code, name, type, process_order, api_key_hash, last_seen_at)
values ('offline_test', 'offline test', 'equipment', 99, 'h', now() - interval '5 minutes')
returning id \gset off_

select fn_check_device_offline();

select ok(
  (select count(*) from alarms where source='system' and device_id = :'off_id') >= 1,
  'offline alarm created'
);

select * from finish();
rollback;
