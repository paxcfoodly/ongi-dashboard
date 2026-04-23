create table vision_inspector_metrics (
  id                       bigserial primary key,
  device_id                uuid not null references devices(id) on delete cascade,
  bucket_at                timestamptz not null,
  total_inspected          int not null check (total_inspected >= 0),
  good_count               int not null check (good_count >= 0),
  defect_count             int not null check (defect_count >= 0),
  unknown_count            int not null check (unknown_count >= 0),
  inspection_time_seconds  numeric(10,2) not null check (inspection_time_seconds >= 0),
  created_at               timestamptz not null default now(),
  constraint vim_unique_bucket unique (device_id, bucket_at),
  constraint vim_total_sum_check
    check (total_inspected = good_count + defect_count + unknown_count)
);

create index idx_vim_bucket_desc on vision_inspector_metrics (bucket_at desc);
create index idx_vim_device_bucket on vision_inspector_metrics (device_id, bucket_at desc);
