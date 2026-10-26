-- 롤백: hr_kpi_records 제거 (정책·트리거는 테이블과 함께 삭제됨)
-- [실행 순서] 롤백은 반드시 역순(000009 → 000008 → 000007 → … → 000001)으로, 중간에 멈추지 말고 실행한다.
-- [프론트엔드] 000001·000003 롤백 전에 프론트엔드를 이전 배포로 먼저 되돌린다 (새 컬럼·뷰를 조회하므로).
-- [백업] 실행 전 데이터 백업 필수:
--   create schema if not exists backup;
--   create table backup._hr_kpi_records_backup as select * from hr_kpi_records;
--   (API에 노출되는 public 스키마에는 절대 만들지 않는다)
--   롤백 후 검증이 끝나면 삭제: drop table backup._hr_kpi_records_backup; (backup 스키마가 비면 drop schema backup;)

begin;

drop table if exists hr_kpi_records;

commit;
