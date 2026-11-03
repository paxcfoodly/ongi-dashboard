-- 현장에서 지켜볼 장비만 가동상태·오프라인 알람 대상으로 둔다 (데이터 수신과는 무관)
alter table devices add column monitored boolean not null default true;

comment on column devices.monitored is
  '가동상태 표시·오프라인 알람 대상 여부. false여도 데이터 수신은 계속된다.';

update devices set monitored = false
 where code in ('caser_01', 'taper_01', 'wrapper_01', 'conveyor_01');

create or replace function fn_check_device_offline() returns void
language plpgsql security definer set search_path = public as $$
declare
  d record;
begin
  for d in
    select id, code, name, last_seen_at
      from devices
     where active
       and monitored
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
