-- 20261026000009_hr_kpi_measured_on_min 롤백: 인력 지표 측정일 하한 CHECK 제약 제거
-- [실행 순서] 롤백은 반드시 역순(000009 → 000008 → … → 000001)으로, 중간에 멈추지 말고 실행한다.
-- [프론트엔드] 폼 검증(hrMeasuredOnError)은 이 제약보다 엄격하므로 프론트엔드를 먼저 되돌릴 필요는 없다.
-- [백업] 제약만 지우므로 데이터 손실이 없다.

begin;

alter table hr_kpi_records
  drop constraint if exists hr_kpi_records_measured_on_min;

commit;
