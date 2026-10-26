-- lots에 KPI 산출용 컬럼 추가: 투입인원, 수주일, 출하일
alter table lots
  -- 투입인원은 1~1000명 (오입력 방지 상한)
  add column worker_count int constraint lots_worker_count_range check (worker_count between 1 and 1000),
  add column ordered_at   date,
  add column shipped_at   date;

alter table lots
  add constraint lots_shipped_after_ordered
    check (shipped_at is null or ordered_at is null or shipped_at >= ordered_at);

comment on column lots.worker_count is '투입인원(명) — 관리자 입력, 작업공수(man-hour) 산출에 사용';
comment on column lots.ordered_at   is '수주일(KST 기준 날짜) — 납기 리드타임 산출 시작점';
comment on column lots.shipped_at   is '출하일(KST 기준 날짜) — 수주일 이상이어야 함';
