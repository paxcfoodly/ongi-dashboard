begin;
select plan(3);

-- 인력 지표 측정일 하한: 연도 오타(0026 등)가 DB 에 들어가지 않도록 막는다
prepare bad_measured as
  insert into hr_kpi_records (measured_on, job_conversion_rate_pct) values ('0026-03-31', 40);
select throws_like('execute bad_measured', '%hr_kpi_records_measured_on_min%',
  'measured_on before 2020-01-01 rejected');

select lives_ok($$
  insert into hr_kpi_records (measured_on, job_conversion_rate_pct) values ('2020-01-01', 40)
$$, 'measured_on at lower bound 2020-01-01 accepted');

prepare bad_measured_update as
  update hr_kpi_records set measured_on = '2019-12-31' where measured_on = '2020-01-01';
select throws_like('execute bad_measured_update', '%hr_kpi_records_measured_on_min%',
  'measured_on update before 2020-01-01 rejected');

select * from finish();
rollback;
