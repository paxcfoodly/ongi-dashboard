-- 인력 지표 측정일 하한(2020-01-01) CHECK 제약
-- 연도 오타(0026 등) 행이 DB 에 들어가지 않도록 막는다. 미래 상한(KST 오늘)은 날짜에 따라 바뀌어
-- CHECK 로 표현할 수 없으므로 폼 검증(hrMeasuredOnError)이 담당한다
--
-- [push 전 확인] hr_kpi_records 는 같은 배치의 000002 에서 새로 생기는 테이블이라 push 전에는 위반 행이 있을 수 없다.
-- 이미 000002 가 적용된 환경이면 아래 SELECT 가 0행인지 먼저 본다.
--
--   select id, measured_on from hr_kpi_records where measured_on < date '2020-01-01';

alter table hr_kpi_records
  add constraint hr_kpi_records_measured_on_min
    check (measured_on >= date '2020-01-01');
