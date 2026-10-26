-- KPI 30일 창(KST) 경계 정리
-- 1) 상한 추가: 미래 날짜로 잘못 입력된 LOT이 평균에 섞이지 않도록
--    종료 시각 < 내일 0시(KST), 출하일 <= 오늘(KST)
-- 2) 표·차트·LLM이 헤드라인과 같은 창을 쓰도록 창 뷰 추가 (v_lot_*_window)
-- 컬럼 순서는 000003 그대로, security_invoker 와 권한은 000006 상태 유지

-- 최근 30일(KST) 종료 LOT별 작업공수 — v_kpi_manhour 와 같은 창
create view v_lot_manhour_window with (security_invoker = true) as
select m.*
from v_lot_manhour m
where m.ended_at >= fn_kst_today_start() - interval '29 days'
  and m.ended_at <  fn_kst_today_start() + interval '1 day';

-- 최근 30일(KST 날짜) 출하 LOT별 리드타임 — v_kpi_leadtime 과 같은 창
create view v_lot_leadtime_window with (security_invoker = true) as
select t.*
from v_lot_leadtime t
where t.shipped_at >= (fn_kst_today_start() at time zone 'Asia/Seoul')::date - 29
  and t.shipped_at <= (fn_kst_today_start() at time zone 'Asia/Seoul')::date;

-- create or replace 는 reloptions 를 새 정의로 바꾸므로 security_invoker 를 다시 명시
create or replace view v_kpi_manhour with (security_invoker = true) as
select
  count(*)::int                    as lot_count,
  round(avg(m.man_hour), 2)        as avg_man_hour,
  (select m2.man_hour
     from v_lot_manhour_window m2
    order by m2.ended_at desc
    limit 1)                       as latest_man_hour
from v_lot_manhour_window m;

create or replace view v_kpi_leadtime with (security_invoker = true) as
select
  count(*)::int                            as lot_count,
  round(avg(t.lead_days), 1)::numeric(6,1) as avg_lead_days
from v_lot_leadtime_window t;

-- 000006 과 같은 권한: 쓰기 회수, 읽기는 로그인 사용자만
revoke all on v_lot_manhour_window, v_lot_leadtime_window, v_kpi_manhour, v_kpi_leadtime
  from anon, authenticated, public;
grant select on v_lot_manhour_window, v_lot_leadtime_window, v_kpi_manhour, v_kpi_leadtime
  to authenticated;
