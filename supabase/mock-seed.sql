-- 실제 장비 데이터가 도착하기 전, 시각 테스트용 mock metrics.
-- supabase db reset 후 `pnpm db:mock` 으로 로드.
-- 중복 삽입 안전 (ON CONFLICT).

-- 오늘 오전 8:00 ~ 14:00 (6시간 × 60분) 분당 버킷 생성
with minutes as (
  select generate_series(
    fn_kst_today_start() + interval '8 hours',
    fn_kst_today_start() + interval '14 hours',
    interval '1 minute'
  ) as bucket_at
),
packaging_device as (
  select id from devices where code = 'packaging_01'
),
vision_device as (
  select id from devices where code = 'vision_01'
),
equipment_rows as (
  insert into equipment_metrics (device_id, bucket_at, runtime_seconds, output_count)
  select (select id from packaging_device), m.bucket_at, 58, 30 + (random() * 5)::int
  from minutes m
  on conflict (device_id, bucket_at) do nothing
  returning 1
),
vision_rows as (
  insert into vision_inspector_metrics
    (device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds)
  select
    (select id from vision_device),
    m.bucket_at,
    30,                                  -- total
    28,                                  -- good
    d.defect,                            -- defect 1~2
    30 - 28 - d.defect,                  -- unknown (나머지)
    58
  from minutes m
  cross join lateral (select (1 + (random() * 1)::int) as defect) d
  on conflict (device_id, bucket_at) do nothing
  returning 1
)
select
  (select count(*) from equipment_rows) as eq_inserted,
  (select count(*) from vision_rows)    as vim_inserted;

-- 샘플 LOT 3개 (오늘)
insert into lots (lot_no, client_id, product_name, target_quantity, started_at, status)
select
  'LOT-' || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD') || '-00' || n,
  (select id from clients where name = c.name),
  '온열팩 (mock)',
  3000,
  fn_kst_today_start() + (n || ' hours')::interval,
  'running'
from (values (1, '삼성웰스토리'), (2, 'CJ프레시웨이'), (3, 'PSI')) as c(n, name)
on conflict (lot_no) do nothing;

-- 샘플 클레임 1건 (이번 분기)
insert into claims (client_id, received_at, defect_type, quantity, description, status)
select
  (select id from clients where name = '삼성웰스토리'),
  now() - interval '10 days',
  '외포장 파손',
  5,
  '배송 중 박스 파손 — 5개 교체 요청 (mock 데이터)',
  'resolved'
where not exists (
  select 1 from claims where description like '%mock 데이터%'
);
