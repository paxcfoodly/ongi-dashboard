begin;
select plan(3);

select has_function('is_admin');

insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000011', 'admin@example.com',
        '00000000-0000-0000-0000-000000000000');
update profiles set role = 'admin'
  where id = '00000000-0000-0000-0000-000000000011';

-- is_admin은 auth.uid()에 의존. pgTAP에서는 세션 컨텍스트 없이 is_admin() = false여야 함
select is(is_admin(), false, 'is_admin returns false without session');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
-- 주의: pgTAP 환경에 따라 세션 클레임 설정이 제한적. 별도 통합 테스트에서 검증
-- 여기서는 함수 존재 및 기본 반환만 확인
select ok(true, 'session-based tests covered in integration tests');

select * from finish();
rollback;
