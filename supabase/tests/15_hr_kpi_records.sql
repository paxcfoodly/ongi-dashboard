begin;
select plan(7);

select has_table('hr_kpi_records');

-- 기준 레코드 (슈퍼유저)
insert into hr_kpi_records (measured_on, job_conversion_rate_pct, satisfaction_score)
values ('2026-09-30', 30, 4.0);

-- anon은 읽을 수 없음
set local role anon;
select is((select count(*) from hr_kpi_records), 0::bigint,
  'anon role cannot read hr_kpi_records');
reset role;

-- viewer: 읽기 가능, 쓰기 불가
insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000031', 'hr_viewer@ex.com',
        '00000000-0000-0000-0000-000000000000');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000031';

select lives_ok($$select count(*) from hr_kpi_records$$,
  'viewer can read hr_kpi_records');

prepare viewer_insert as
  insert into hr_kpi_records (measured_on) values ('2026-10-01');
select throws_like('execute viewer_insert', '%row-level security%',
  'viewer cannot write hr_kpi_records');

reset role;

-- admin: 쓰기 가능
insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000032', 'hr_admin@ex.com',
        '00000000-0000-0000-0000-000000000000');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000032';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000032';

insert into hr_kpi_records (measured_on, job_conversion_rate_pct)
values ('2026-10-02', 40);
select ok(exists (select 1 from hr_kpi_records where measured_on = '2026-10-02'),
  'admin can insert hr_kpi_records');

reset role;

-- now()는 트랜잭션 내 상수이므로 시각을 과거로 되돌린 뒤 admin으로 UPDATE
update hr_kpi_records
   set created_at = now() - interval '1 minute',
       updated_at = now() - interval '1 minute'
 where measured_on = '2026-10-02';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000032';
update hr_kpi_records set job_conversion_rate_pct = 45 where measured_on = '2026-10-02';
reset role;

select ok(
  (select updated_at > created_at from hr_kpi_records where measured_on = '2026-10-02'),
  'admin update advances updated_at'
);

-- 만족도 5.1은 check 위반
prepare bad_score as
  insert into hr_kpi_records (measured_on, satisfaction_score) values ('2026-10-03', 5.1);
select throws_like('execute bad_score', '%check%', 'satisfaction_score 5.1 rejected');

select * from finish();
rollback;
