-- 20261028000001_fn_kpi_daily 롤백: 기간 KPI 일별 집계 함수 제거
-- [프론트엔드] 이 롤백 전에 프론트엔드를 이전 배포로 먼저 되돌린다 (기간 조회가 이 함수를 호출하므로).
-- [백업] 함수만 제거하며 데이터 손실은 없다.

begin;

drop function if exists fn_kpi_daily(date, date);

commit;
