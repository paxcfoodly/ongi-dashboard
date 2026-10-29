begin;
select plan(17);

-- 장비 API 키 확인: 발급 시 앞 4자리 저장, 관리자 키 대조(정리 후 일치 포함), 권한
select has_column('public', 'devices', 'api_key_prefix', 'devices.api_key_prefix 존재');
select has_function('public', 'fn_admin_check_device_key', array['uuid', 'text']);

insert into auth.users (id, email, instance_id) values
  ('00000000-0000-0000-0000-000000000241', 'kc_admin@ex.com', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-000000000242', 'kc_viewer@ex.com', '00000000-0000-0000-0000-000000000000');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000241';

insert into devices (code, name, type, process_order, api_key_hash)
values ('kc_dev', 'key check', 'equipment', 241, 'seed-hash-replace-on-first-use');
select id as dev_id from devices where code = 'kc_dev' \gset

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000241';

-- 미발급 상태에서도 오류 없이 '미등록'으로 답한다
select is((fn_admin_check_device_key(:'dev_id', 'whatever') ->> 'key_registered')::boolean, false,
  '미발급 장비는 key_registered=false');

select fn_set_device_api_key(:'dev_id', 'abcd1234ef567890abcd1234ef567890abcd1234ef567890');
select is((select api_key_prefix from devices where id = :'dev_id'), 'abcd', '발급 시 앞 4자리 저장');

select is((fn_admin_check_device_key(:'dev_id', 'abcd1234ef567890abcd1234ef567890abcd1234ef567890') ->> 'match')::boolean,
  true, '정확한 키는 match=true');

select is((fn_admin_check_device_key(:'dev_id', 'ffff1234ef567890abcd1234ef567890abcd1234ef567890') ->> 'match')::boolean,
  false, '다른 키는 match=false');
select is((fn_admin_check_device_key(:'dev_id', 'ffff1234ef567890abcd1234ef567890abcd1234ef567890') ->> 'match_after_cleanup')::boolean,
  false, '다른 키는 정리 후에도 불일치');

-- 앞뒤 공백·줄바꿈
select is((fn_admin_check_device_key(:'dev_id', E' abcd1234ef567890abcd1234ef567890abcd1234ef567890\n') ->> 'match')::boolean,
  false, '공백 섞인 키는 그대로는 불일치');
select is((fn_admin_check_device_key(:'dev_id', E' abcd1234ef567890abcd1234ef567890abcd1234ef567890\n') ->> 'match_after_cleanup')::boolean,
  true, '공백 제거하면 일치');
select is((fn_admin_check_device_key(:'dev_id', E' abcd1234ef567890abcd1234ef567890abcd1234ef567890\n') ->> 'has_whitespace')::boolean,
  true, '공백 포함 표시');

-- Bearer 접두어·따옴표
select is((fn_admin_check_device_key(:'dev_id', 'Bearer abcd1234ef567890abcd1234ef567890abcd1234ef567890') ->> 'has_bearer')::boolean,
  true, 'Bearer 포함 표시');
select is((fn_admin_check_device_key(:'dev_id', 'Bearer abcd1234ef567890abcd1234ef567890abcd1234ef567890') ->> 'match_after_cleanup')::boolean,
  true, 'Bearer 제거하면 일치');
select is((fn_admin_check_device_key(:'dev_id', '"abcd1234ef567890abcd1234ef567890abcd1234ef567890"') ->> 'match_after_cleanup')::boolean,
  true, '따옴표 제거하면 일치');

-- 길이·앞자리 비교 정보
select is(fn_admin_check_device_key(:'dev_id', 'ffff12') ->> 'length', '6', '입력 길이');
select is(fn_admin_check_device_key(:'dev_id', 'ffff12') ->> 'registered_prefix', 'abcd', '등록된 키 앞 4자리');

-- 관리자 아닌 사용자는 호출 불가
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000242';
select throws_ok(format('select fn_admin_check_device_key(%L, %L)', :'dev_id', 'x'),
  'only admin can check device api key', '일반 사용자는 거부');

-- 로그인 안 한 요청(anon)은 실행 권한 자체가 없다
select ok(not has_function_privilege('anon', 'fn_admin_check_device_key(uuid, text)', 'execute'),
  'anon 실행 권한 없음');

select * from finish();
rollback;
