-- 20261026000006_secure_kpi_views 롤백: fn_purge_ingest_logs 실행 권한만 000006 이전 상태(public)로 복원
-- KPI 뷰의 security_invoker 와 '로그인 사용자 select 전용' 권한은 그대로 둔다
-- (anon·authenticated 의 뷰 경유 lots 쓰기를 다시 열지 않기 위함)
-- [실행 순서] 롤백은 반드시 역순(000006 → 000005 → … → 000001)으로, 중간에 멈추지 말고 실행한다.
-- [프론트엔드] 000001·000003 롤백 전에 프론트엔드를 이전 배포로 먼저 되돌린다 (새 컬럼·뷰를 조회하므로).
-- [백업] 이 파일은 권한만 바꿔 데이터 손실이 없다. 다른 파일의 백업은 먼저 수행할 것.

begin;

grant execute on function fn_purge_ingest_logs() to public;

commit;
