-- 1. RLS 활성화
alter table devices                     enable row level security;
alter table vision_inspector_metrics    enable row level security;
alter table equipment_metrics           enable row level security;
alter table lots                        enable row level security;
alter table clients                     enable row level security;
alter table claims                      enable row level security;
alter table targets                     enable row level security;
alter table alarm_rules                 enable row level security;
alter table alarms                      enable row level security;
alter table profiles                    enable row level security;
alter table ingest_logs                 enable row level security;

-- 2. 읽기 정책 (인증된 사용자)
create policy "authed read" on devices                  for select to authenticated using (true);
create policy "authed read" on vision_inspector_metrics for select to authenticated using (true);
create policy "authed read" on equipment_metrics        for select to authenticated using (true);
create policy "authed read" on lots                     for select to authenticated using (true);
create policy "authed read" on clients                  for select to authenticated using (true);
create policy "authed read" on claims                   for select to authenticated using (true);
create policy "authed read" on targets                  for select to authenticated using (true);
create policy "authed read" on alarm_rules              for select to authenticated using (true);
create policy "authed read" on alarms                   for select to authenticated using (true);

-- 3. 쓰기 정책 (admin만)
create policy "admin write" on devices     for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on lots        for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on clients     for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on claims      for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on targets     for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin write" on alarm_rules for all to authenticated using (is_admin()) with check (is_admin());

-- 4. alarms는 모든 인증자가 acknowledge 업데이트 가능
create policy "ack alarm" on alarms for update to authenticated
  using (true)
  with check (acknowledged = true);
create policy "admin insert alarm" on alarms for insert to authenticated with check (is_admin());
create policy "admin delete alarm" on alarms for delete to authenticated using (is_admin());

-- 5. profiles
create policy "self or admin read" on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy "admin write profiles" on profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- 6. ingest_logs는 admin만 조회
create policy "admin read logs" on ingest_logs for select to authenticated using (is_admin());
