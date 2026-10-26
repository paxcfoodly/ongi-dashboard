-- KPI 뷰·로그 정리 함수 권한 잠금
-- v_lot_manhour / v_lot_leadtime 은 단일 테이블 자동 갱신 뷰라, 소유자(postgres, RLS 우회) 권한으로
-- anon·authenticated 가 뷰를 통해 lots 를 UPDATE/DELETE 할 수 있었음 → 차단

-- 호출자 권한으로 실행 → lots RLS("authed read" / "admin write")가 그대로 적용됨
alter view v_lot_manhour  set (security_invoker = true);
alter view v_lot_leadtime set (security_invoker = true);
alter view v_kpi_manhour  set (security_invoker = true);
alter view v_kpi_leadtime set (security_invoker = true);

-- Supabase 기본 권한으로 부여된 쓰기 권한 회수, 읽기는 로그인 사용자만
revoke all on v_lot_manhour, v_lot_leadtime, v_kpi_manhour, v_kpi_leadtime
  from anon, authenticated, public;
grant select on v_lot_manhour, v_lot_leadtime, v_kpi_manhour, v_kpi_leadtime
  to authenticated;

-- 90일 로그 정리 함수(security definer)는 pg_cron(postgres)만 실행
revoke execute on function fn_purge_ingest_logs() from public, anon, authenticated;
