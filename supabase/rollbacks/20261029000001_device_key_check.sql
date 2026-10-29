-- 20261029000001_device_key_check 롤백: 키 확인 함수 제거, 키 발급 함수 원복, 앞자리 컬럼 제거
-- [프론트엔드·수신 함수] 이 롤백 전에 프론트엔드와 ingest 함수를 이전 버전으로 먼저 되돌린다
--   (장비 화면이 fn_admin_check_device_key·api_key_prefix를, ingest가 api_key_prefix를 읽음).
-- [데이터] 등록된 키(해시)는 그대로 유지되어 업체 전송에는 영향 없음. 앞 4자리 기록만 사라짐.

begin;

drop function if exists fn_admin_check_device_key(uuid, text);

create or replace function fn_set_device_api_key(
  p_device_id uuid,
  p_plain_key text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'only admin or service_role can set device api key';
  end if;
  update devices
     set api_key_hash = crypt(p_plain_key, gen_salt('bf', 10))
   where id = p_device_id;
end; $$;

alter table devices drop column if exists api_key_prefix;

commit;
