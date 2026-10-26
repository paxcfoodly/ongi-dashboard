-- 롤백: hr_kpi_records 제거 (정책·트리거는 테이블과 함께 삭제됨)
-- [실행 순서] 롤백은 반드시 역순(000006 → 000005 → … → 000001)으로, 중간에 멈추지 말고 실행한다.
-- [프론트엔드] 000001·000003 롤백 전에 프론트엔드를 이전 배포로 먼저 되돌린다 (새 컬럼·뷰를 조회하므로).
-- [백업] 실행 전 데이터 백업 필수:
--   create table _hr_kpi_records_backup as select * from hr_kpi_records;

begin;

drop table if exists hr_kpi_records;

commit;
