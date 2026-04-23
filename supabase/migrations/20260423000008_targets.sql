create table targets (
  key          text primary key,
  value        numeric not null,
  unit         text,
  description  text,
  updated_at   timestamptz not null default now()
);
