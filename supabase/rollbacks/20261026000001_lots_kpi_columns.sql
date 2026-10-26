-- 롤백: lots KPI 컬럼 제거 (제약 → 컬럼 순서)
-- [실행 순서] 롤백은 반드시 역순(000006 → 000005 → … → 000001)으로, 중간에 멈추지 말고 실행한다.
-- [프론트엔드] 000001·000003 롤백 전에 프론트엔드를 이전 배포로 먼저 되돌린다 (새 컬럼·뷰를 조회하므로).
-- [백업] 실행 전 데이터 백업 필수:
--   create table _lots_kpi_backup as select id, worker_count, ordered_at, shipped_at from lots;

begin;

alter table lots drop constraint if exists lots_shipped_after_ordered;
alter table lots drop constraint if exists lots_worker_count_range;
alter table lots
  drop column if exists worker_count,
  drop column if exists ordered_at,
  drop column if exists shipped_at;

commit;
