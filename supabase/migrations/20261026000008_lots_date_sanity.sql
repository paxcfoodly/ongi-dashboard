-- LOT 날짜 오입력 방지: 하한(2020-01-01)·최대 작업 기간(31일)·최대 리드타임(366일) CHECK 제약
-- 연도를 0026 처럼 잘못 입력하면 v_lot_summary / v_lot_manhour 의 man_hour(numeric(10,2))나
-- v_kpi_leadtime.avg_lead_days(numeric(6,1))가 넘쳐(numeric field overflow) LOT 화면·llm-analyze 가 깨진다
-- 숫자 타입은 넓히지 않는다 — 입력 단계에서 막는 것이 이 파일의 유일한 목적
--
-- [push 전 확인] Cloud SQL Editor 에서 아래 SELECT 를 먼저 실행해 위반 행이 없는지 본다 (0행이어야 함).
-- 위반 행이 있으면 이 마이그레이션만 제약 추가(검증) 단계에서 실패한다 (db push 는 파일별 트랜잭션이라
-- 000001~000007 은 적용된 채 남음). 해당 행의 시각을 바로잡은 뒤 db push 를 다시 실행하면 이 파일만 적용된다.
-- ordered_at/shipped_at 은 같은 배치의 000001 에서 새로 생기므로 push 전에는 조회할 수 없고 위반 행도 없다.
--
--   select id, lot_no, started_at, ended_at
--   from lots
--   where started_at < timestamptz '2020-01-01 00:00:00+09'
--      or ended_at   < timestamptz '2020-01-01 00:00:00+09'
--      or ended_at - started_at > interval '31 days';
--
-- 하한 시각은 KST 2020-01-01 0시로 고정 (세션 시간대와 무관, 폼 검증과 같은 기준)
-- lots 는 행 수가 적어 NOT VALID 없이 바로 검증한다 (위반 행이 있으면 push 가 즉시 실패해 원인을 알 수 있음)

alter table lots
  add constraint lots_started_at_min
    check (started_at is null or started_at >= timestamptz '2020-01-01 00:00:00+09'),
  add constraint lots_ended_at_min
    check (ended_at is null or ended_at >= timestamptz '2020-01-01 00:00:00+09'),
  add constraint lots_ordered_at_min
    check (ordered_at is null or ordered_at >= date '2020-01-01'),
  add constraint lots_shipped_at_min
    check (shipped_at is null or shipped_at >= date '2020-01-01'),
  -- 한 LOT 의 작업(시작~종료)은 최대 31일
  add constraint lots_work_duration_max
    check (ended_at is null or started_at is null or ended_at - started_at <= interval '31 days'),
  -- 납기 리드타임(수주~출하)은 최대 366일 (date 차이는 정수 일수)
  add constraint lots_lead_time_max
    check (shipped_at is null or ordered_at is null or shipped_at - ordered_at <= 366);
