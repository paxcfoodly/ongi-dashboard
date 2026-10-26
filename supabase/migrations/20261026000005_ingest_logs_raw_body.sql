-- /ingest 요청 원문 저장: 업체가 보낸 데이터를 관리자 화면에서 그대로 확인하기 위함
alter table ingest_logs
  add column if not exists raw_body text,
  add column if not exists content_type text;

create index if not exists idx_ingest_logs_device_received
  on ingest_logs (device_code, received_at desc);

-- 90일 초과 로그 정리
create or replace function fn_purge_ingest_logs() returns void
language sql security definer set search_path = public as $$
  delete from ingest_logs where received_at < now() - interval '90 days';
$$;

-- 매일 UTC 18:00 (= KST 03:00). db reset 시에도 중복되지 않도록 기존 잡 해제 후 등록
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ingest-logs-purge') then
    perform cron.unschedule('ingest-logs-purge');
  end if;
end $$;

select cron.schedule('ingest-logs-purge', '0 18 * * *', $$select fn_purge_ingest_logs();$$);
