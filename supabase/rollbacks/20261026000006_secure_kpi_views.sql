-- 20261026000006_secure_kpi_views 롤백: 이전 권한 상태로 복원
-- (주의: 복원 시 anon 이 KPI 뷰를 통해 lots 를 변경할 수 있는 상태로 돌아감)
grant execute on function fn_purge_ingest_logs() to public, anon, authenticated;

grant all on v_lot_manhour, v_lot_leadtime, v_kpi_manhour, v_kpi_leadtime
  to anon, authenticated;

alter view v_lot_manhour  reset (security_invoker);
alter view v_lot_leadtime reset (security_invoker);
alter view v_kpi_manhour  reset (security_invoker);
alter view v_kpi_leadtime reset (security_invoker);
