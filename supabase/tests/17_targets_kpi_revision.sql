begin;
select plan(6);

select is((select value from targets where key = 'manhour_target'), 16::numeric,
  'manhour_target = 16');
select is((select value from targets where key = 'manhour_baseline'), 24::numeric,
  'manhour_baseline = 24');
select is((select value from targets where key = 'leadtime_target'), 12::numeric,
  'leadtime_target = 12');
select is((select value from targets where key = 'satisfaction_target'), 4.5::numeric,
  'satisfaction_target = 4.5');
select is((select count(*) from targets
            where key in ('cost_ratio_target', 'cost_ratio_baseline', 'cost_improvement_target')),
  0::bigint, 'cost-ratio target keys removed');
select is((select enabled from alarm_rules where name = '제조원가 상한 초과'), false,
  'cost-ratio alarm rule disabled');

select * from finish();
rollback;
