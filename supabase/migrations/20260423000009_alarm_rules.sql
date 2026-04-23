create table alarm_rules (
  id                uuid primary key default gen_random_uuid(),
  name              text unique not null,
  metric            text not null,
  operator          text not null check (operator in ('>', '>=', '<', '<=', '=')),
  threshold         numeric not null,
  severity          severity_level not null default 'warning',
  message_template  text not null,
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
