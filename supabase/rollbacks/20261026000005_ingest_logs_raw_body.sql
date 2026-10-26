do $$
begin
  if exists (select 1 from cron.job where jobname = 'ingest-logs-purge') then
    perform cron.unschedule('ingest-logs-purge');
  end if;
end $$;

drop function if exists fn_purge_ingest_logs();
drop index if exists idx_ingest_logs_device_received;
alter table ingest_logs drop column if exists content_type, drop column if exists raw_body;
