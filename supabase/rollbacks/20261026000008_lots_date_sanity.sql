-- 20261026000008_lots_date_sanity 롤백: lots 날짜 하한·최대 기간 CHECK 제약 6개 제거
-- [실행 순서] 롤백은 반드시 역순(000008 → 000007 → … → 000001)으로, 중간에 멈추지 말고 실행한다.
-- [프론트엔드] 폼 검증(lotTimeError)은 이 제약보다 엄격하거나 같으므로 프론트엔드를 먼저 되돌릴 필요는 없다.
-- [백업] 제약만 지우므로 데이터 손실이 없다.

begin;

alter table lots
  drop constraint if exists lots_lead_time_max,
  drop constraint if exists lots_work_duration_max,
  drop constraint if exists lots_shipped_at_min,
  drop constraint if exists lots_ordered_at_min,
  drop constraint if exists lots_ended_at_min,
  drop constraint if exists lots_started_at_min;

commit;
