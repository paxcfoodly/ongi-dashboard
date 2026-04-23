create table ingest_logs (
  id             bigserial primary key,
  device_code    text,
  received_at    timestamptz not null default now(),
  status         text not null,
  error_message  text,
  raw_payload    jsonb
);

create index idx_ingest_logs_received_desc on ingest_logs (received_at desc);
