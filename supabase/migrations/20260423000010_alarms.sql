create table alarms (
  id                uuid primary key default gen_random_uuid(),
  rule_id           uuid references alarm_rules(id) on delete set null,
  severity          severity_level not null,
  source            alarm_source not null,
  device_id         uuid references devices(id) on delete set null,
  message           text not null,
  metadata          jsonb not null default '{}'::jsonb,
  acknowledged      boolean not null default false,
  acknowledged_by   uuid references auth.users(id),
  acknowledged_at   timestamptz,
  created_at        timestamptz not null default now()
);

create index idx_alarms_created_desc on alarms (created_at desc);
create index idx_alarms_unacked on alarms (acknowledged) where acknowledged = false;
