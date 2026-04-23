create table equipment_metrics (
  id               bigserial primary key,
  device_id        uuid not null references devices(id) on delete cascade,
  bucket_at        timestamptz not null,
  runtime_seconds  int not null check (runtime_seconds >= 0 and runtime_seconds <= 60),
  output_count     int not null check (output_count >= 0),
  extras           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  constraint em_unique_bucket unique (device_id, bucket_at)
);

create index idx_em_bucket_desc on equipment_metrics (bucket_at desc);
create index idx_em_device_bucket on equipment_metrics (device_id, bucket_at desc);
