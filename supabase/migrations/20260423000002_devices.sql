create table devices (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  name           text not null,
  type           device_type not null,
  role           text,
  process_order  int not null,
  api_key_hash   text not null,
  active         boolean not null default true,
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_devices_active_order on devices (active, process_order);
create index idx_devices_type on devices (type);

comment on column devices.role is
  '"primary_output" = 일일 생산량 기준 장비, "inspection" = AI 검사, null/기타 = 보조';
