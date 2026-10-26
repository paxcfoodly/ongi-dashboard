-- 롤백: lots KPI 컬럼 제거 (제약 → 컬럼 순서)
alter table lots drop constraint if exists lots_shipped_after_ordered;
alter table lots
  drop column if exists worker_count,
  drop column if exists ordered_at,
  drop column if exists shipped_at;
