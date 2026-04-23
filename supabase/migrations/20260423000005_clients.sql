create table clients (
  id            uuid primary key default gen_random_uuid(),
  name          text unique not null,
  contact_info  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
