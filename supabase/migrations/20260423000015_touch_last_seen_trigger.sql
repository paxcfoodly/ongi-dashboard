create or replace function fn_touch_device_last_seen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update devices
  set last_seen_at = new.bucket_at
  where id = new.device_id
    and (last_seen_at is null or last_seen_at < new.bucket_at);
  return new;
end; $$;

create trigger trg_vision_last_seen
  after insert on vision_inspector_metrics
  for each row execute function fn_touch_device_last_seen();

create trigger trg_equipment_last_seen
  after insert on equipment_metrics
  for each row execute function fn_touch_device_last_seen();
