create table lots (
  id               uuid primary key default gen_random_uuid(),
  lot_no           text unique not null,
  client_id        uuid not null references clients(id),
  product_name     text,
  target_quantity  int check (target_quantity > 0),
  started_at       timestamptz,
  ended_at         timestamptz,
  status           lot_status not null default 'planned',
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lots_end_after_start
    check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index idx_lots_started_desc on lots (started_at desc nulls last);
create index idx_lots_status on lots (status);
