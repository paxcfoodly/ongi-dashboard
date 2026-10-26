-- 인력 지표(직무 전환율, 만족도) 기록 테이블 — 분기/조사 단위 수기 입력
create table hr_kpi_records (
  id                       uuid primary key default gen_random_uuid(),
  measured_on              date not null unique,
  job_conversion_rate_pct  numeric(5,2) check (job_conversion_rate_pct between 0 and 100),
  satisfaction_score       numeric(3,2) check (satisfaction_score between 0 and 5),
  note                     text,
  created_by               uuid references auth.users(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table hr_kpi_records is '인력 지표 기록 (직무 전환율·만족도) — 관리자 수기 입력';
comment on column hr_kpi_records.measured_on is '측정(조사) 기준일, 중복 불가';
comment on column hr_kpi_records.job_conversion_rate_pct is '직무 전환율(%) 0~100, 미입력 시 null';
comment on column hr_kpi_records.satisfaction_score is '만족도(점) 0~5, 미입력 시 null';

-- RLS: 기존 관례 (전체 읽기 / 관리자 쓰기)
alter table hr_kpi_records enable row level security;
create policy "authed read" on hr_kpi_records for select to authenticated using (true);
create policy "admin write" on hr_kpi_records for all to authenticated
  using (is_admin()) with check (is_admin());

-- updated_at 자동 갱신
create trigger trg_hr_kpi_records_updated_at
  before update on hr_kpi_records
  for each row execute function fn_set_updated_at();
