-- Phase 4 보안: 장비 API 키를 bcrypt 해시로 저장·검증.
-- seed devices(api_key_hash='seed-hash-replace-on-first-use')는 유효한 bcrypt 해시가 아니므로
-- crypt(plain, api_key_hash) 비교가 graceful하게 실패한다. 시드 장치는 최초 사용 전
-- 관리자 UI 또는 service_role 컨텍스트에서 fn_set_device_api_key 로 키를 재발급해야 한다.
create extension if not exists pgcrypto;

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

grant execute on function fn_set_device_api_key(uuid, text) to authenticated;
grant execute on function fn_set_device_api_key(uuid, text) to service_role;

create or replace function fn_verify_device_api_key(
  p_device_id uuid,
  p_plain_key text
) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from devices
     where id = p_device_id
       and api_key_hash = crypt(p_plain_key, api_key_hash)
  );
$$;

revoke execute on function fn_verify_device_api_key(uuid, text) from public, authenticated;
grant execute on function fn_verify_device_api_key(uuid, text) to service_role;
