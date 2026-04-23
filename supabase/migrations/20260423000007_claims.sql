create table claims (
  id                   uuid primary key default gen_random_uuid(),
  lot_id               uuid references lots(id),
  client_id            uuid not null references clients(id),
  received_at          timestamptz not null,
  defect_type          text,
  quantity             int check (quantity >= 0),
  description          text,
  status               claim_status not null default 'open',
  response_report_url  text,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_claims_received_desc on claims (received_at desc);
create index idx_claims_client on claims (client_id);
