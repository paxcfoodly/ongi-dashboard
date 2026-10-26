begin;
select plan(4);

select has_column('public', 'ingest_logs', 'raw_body', 'raw_body 컬럼 존재');
select has_column('public', 'ingest_logs', 'content_type', 'content_type 컬럼 존재');

-- 100일 전 로그와 오늘 로그를 넣고 정리 함수 실행
insert into ingest_logs (device_code, received_at, status)
values ('purge_old', now() - interval '100 days', 'success'),
       ('purge_new', now(), 'success');
select fn_purge_ingest_logs();
select is(
  (select array_agg(device_code order by device_code) from ingest_logs
    where device_code in ('purge_old', 'purge_new')),
  array['purge_new']::text[],
  '90일 초과 로그만 삭제');

select is((select count(*) from cron.job where jobname = 'ingest-logs-purge'), 1::bigint,
  'ingest-logs-purge cron 등록');

select * from finish();
rollback;
