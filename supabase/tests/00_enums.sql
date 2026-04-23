begin;
select plan(6);

select has_type('device_type',    'device_type enum exists');
select has_type('lot_status',     'lot_status enum exists');
select has_type('claim_status',   'claim_status enum exists');
select has_type('severity_level', 'severity_level enum exists');
select has_type('alarm_source',   'alarm_source enum exists');
select has_type('user_role',      'user_role enum exists');

select * from finish();
rollback;
