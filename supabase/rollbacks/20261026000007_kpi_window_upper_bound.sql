-- 20261026000007_kpi_window_upper_bound 롤백: 창 뷰 제거 + v_kpi_manhour / v_kpi_leadtime 을
-- 000003 정의(상한 없음)로 되돌리되, security_invoker 와 권한은 000006 상태로 유지
-- [실행 순서] 롤백은 반드시 역순(000007 → 000006 → 000005 → … → 000001)으로, 중간에 멈추지 말고 실행한다.
-- [프론트엔드] 이 롤백 전에 프론트엔드를 이전 배포로 먼저 되돌린다 (v_lot_*_window 뷰를 조회하므로).
--             llm-analyze 함수도 이전 버전으로 재배포한다.
-- [백업] 이 파일은 뷰만 바꿔 데이터 손실이 없다. 다른 파일의 백업은 먼저 수행할 것.

begin;

-- KPI 뷰가 창 뷰를 참조하므로 먼저 원래 정의로 되돌린 뒤 창 뷰를 지운다
create or replace view v_kpi_manhour with (security_invoker = true) as
select
  count(*)::int                    as lot_count,
  round(avg(m.man_hour), 2)        as avg_man_hour,
  (select m2.man_hour
     from v_lot_manhour m2
    where m2.ended_at >= fn_kst_today_start() - interval '29 days'
    order by m2.ended_at desc
    limit 1)                       as latest_man_hour
from v_lot_manhour m
where m.ended_at >= fn_kst_today_start() - interval '29 days';

create or replace view v_kpi_leadtime with (security_invoker = true) as
select
  count(*)::int                            as lot_count,
  round(avg(t.lead_days), 1)::numeric(6,1) as avg_lead_days
from v_lot_leadtime t
where t.shipped_at >= (fn_kst_today_start() at time zone 'Asia/Seoul')::date - 29;

revoke all on v_kpi_manhour, v_kpi_leadtime from anon, authenticated, public;
grant select on v_kpi_manhour, v_kpi_leadtime to authenticated;

drop view if exists v_lot_manhour_window;
drop view if exists v_lot_leadtime_window;

commit;
