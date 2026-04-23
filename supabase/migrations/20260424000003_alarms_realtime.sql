-- alarms 테이블의 Realtime 이벤트를 구독자에게 전달
-- 이미 publication에 포함되어 있으면 skip
do $$
begin
  alter publication supabase_realtime add table alarms;
exception
  when duplicate_object then null;
  when others then raise notice 'alarms realtime add skipped: %', SQLERRM;
end $$;
