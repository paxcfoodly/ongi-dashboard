-- 롤백: ingest_logs 원문 컬럼·인덱스·90일 정리 함수·cron 제거
-- [실행 순서] 롤백은 반드시 역순(000008 → 000007 → 000006 → 000005 → … → 000001)으로, 중간에 멈추지 말고 실행한다.
-- [프론트엔드] 000001·000003 롤백 전에 프론트엔드를 이전 배포로 먼저 되돌린다 (새 컬럼·뷰를 조회하므로).
-- [백업] 실행 전 데이터 백업 필수 (raw_body·content_type 컬럼이 삭제됨):
--   create schema if not exists backup;
--   create table backup._ingest_logs_raw_backup as select id, raw_body, content_type from ingest_logs;
--   (API에 노출되는 public 스키마에는 절대 만들지 않는다)
--   롤백 후 검증이 끝나면 삭제: drop table backup._ingest_logs_raw_backup; (backup 스키마가 비면 drop schema backup;)

begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ingest-logs-purge') then
    perform cron.unschedule('ingest-logs-purge');
  end if;
end $$;

drop function if exists fn_purge_ingest_logs();
drop index if exists idx_ingest_logs_device_received;
alter table ingest_logs drop column if exists content_type, drop column if exists raw_body;

commit;
