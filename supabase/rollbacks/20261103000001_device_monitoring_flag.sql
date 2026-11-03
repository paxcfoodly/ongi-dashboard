-- 20261103000001_device_monitoring_flag 되돌리기
create or replace function fn_check_device_offline() returns void
language plpgsql security definer set search_path = public as $$
declare
  d record;
begin
  for d in
    select id, code, name, last_seen_at
      from devices
     where active
       and (last_seen_at is null or last_seen_at < now() - interval '2 minutes')
  loop
    if not exists (
      select 1 from alarms
       where source = 'system'
         and device_id = d.id
         and metadata->>'kind' = 'device_offline'
         and created_at > now() - interval '30 minutes'
    ) then
      insert into alarms (severity, source, device_id, message, metadata)
      values (
        'warning', 'system', d.id,
        format('장비 %s (%s) 2분 이상 수신 없음', d.name, d.code),
        jsonb_build_object(
          'kind', 'device_offline',
          'last_seen_at', d.last_seen_at
        )
      );
    end if;
  end loop;
end; $$;

alter table devices drop column monitored;
