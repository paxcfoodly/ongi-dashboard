-- 장비 API 키 확인 기능
-- 1) 발급 시 키 앞 4자리(api_key_prefix)를 저장 — 수신 실패 시 '등록된 키'와 '받은 키'를 비교하는 단서
--    (48자리 16진수 키의 4자리만 남기므로 키 추측에 의미 있는 정보가 아님)
-- 2) 관리자가 키를 붙여 넣어 등록된 키와 맞는지 확인하는 fn_admin_check_device_key

alter table devices add column if not exists api_key_prefix text;

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
     set api_key_hash = crypt(p_plain_key, gen_salt('bf', 10)),
         api_key_prefix = left(p_plain_key, 4)
   where id = p_device_id;
end; $$;

-- 관리자 전용: 입력한 키가 등록된 키와 맞는지, 흔한 복사 실수(공백·줄바꿈·Bearer·따옴표)를 지우면 맞는지 알려 줌
create or replace function fn_admin_check_device_key(
  p_device_id uuid,
  p_plain_key text
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_hash    text;
  v_prefix  text;
  v_clean   text;
  v_bcrypt  boolean;
begin
  if not is_admin() then
    raise exception 'only admin can check device api key';
  end if;

  select api_key_hash, api_key_prefix into v_hash, v_prefix from devices where id = p_device_id;
  if not found then
    raise exception 'device not found';
  end if;
  v_bcrypt := coalesce(v_hash like '$2%', false);

  -- 앞뒤 공백·줄바꿈 → Bearer 접두어 → 따옴표 순으로 정리
  v_clean := btrim(p_plain_key, E' \t\r\n');
  v_clean := regexp_replace(v_clean, '^bearer\s+', '', 'i');
  v_clean := btrim(v_clean, E' \t\r\n"''');

  return jsonb_build_object(
    'key_registered',      v_bcrypt,
    'match',               v_bcrypt and v_hash = crypt(p_plain_key, v_hash),
    'match_after_cleanup', v_bcrypt and v_hash = crypt(v_clean, v_hash),
    'length',              length(p_plain_key),
    'clean_length',        length(v_clean),
    'has_whitespace',      p_plain_key ~ '\s',
    'has_bearer',          p_plain_key ~* '^\s*bearer\s',
    'has_quotes',          p_plain_key ~ '["'']',
    'prefix',              left(v_clean, 4),
    'registered_prefix',   v_prefix
  );
end; $$;

revoke execute on function fn_admin_check_device_key(uuid, text) from public, anon;
grant execute on function fn_admin_check_device_key(uuid, text) to authenticated;
