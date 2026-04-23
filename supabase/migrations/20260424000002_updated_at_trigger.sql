create or replace function fn_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

-- updated_at 컬럼이 있는 모든 테이블에 트리거 부착
create trigger trg_devices_updated_at
  before update on devices
  for each row execute function fn_set_updated_at();
create trigger trg_lots_updated_at
  before update on lots
  for each row execute function fn_set_updated_at();
create trigger trg_claims_updated_at
  before update on claims
  for each row execute function fn_set_updated_at();
create trigger trg_targets_updated_at
  before update on targets
  for each row execute function fn_set_updated_at();
create trigger trg_alarm_rules_updated_at
  before update on alarm_rules
  for each row execute function fn_set_updated_at();
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function fn_set_updated_at();
