begin;
select plan(3);

select has_table('profiles');
select has_function('handle_new_user');

-- auth.users 직접 삽입 (로컬에서만 가능)
insert into auth.users (id, email, instance_id)
values ('00000000-0000-0000-0000-000000000001', 'test@example.com',
        '00000000-0000-0000-0000-000000000000');

select ok(exists (select 1 from profiles where id = '00000000-0000-0000-0000-000000000001'),
  'profile auto-created on auth.users insert');

select * from finish();
rollback;
