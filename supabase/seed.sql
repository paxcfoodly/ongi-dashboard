-- Seed data for local development (populated in later tasks).

-- 장비 6대 시드 (실제 공정 매핑은 담당자 협의 후 조정)
insert into devices (code, name, type, role, process_order, api_key_hash) values
  ('packaging_01', '삼면포장기',    'equipment',        'primary_output', 1, 'seed-hash-replace-on-first-use'),
  ('vision_01',    'AI 비전검사기', 'vision_inspector', 'inspection',     2, 'seed-hash-replace-on-first-use'),
  ('caser_01',     '자동제함기',    'equipment',         null,            3, 'seed-hash-replace-on-first-use'),
  ('taper_01',     '자동테이핑기',  'equipment',         null,            4, 'seed-hash-replace-on-first-use'),
  ('wrapper_01',   '자동랩핑기',    'equipment',         null,            5, 'seed-hash-replace-on-first-use'),
  ('conveyor_01',  '컨베이어',      'equipment',         null,            6, 'seed-hash-replace-on-first-use')
on conflict (code) do nothing;

insert into clients (name) values
  ('삼성웰스토리'),
  ('CJ프레시웨이'),
  ('PSI')
on conflict (name) do nothing;

insert into targets (key, value, unit, description) values
  ('daily_production',        15000, 'ea',    '일일 목표 생산량'),
  ('hourly_production',        1800, 'ea/hr', '시간당 목표 생산량'),
  ('work_time_per_ea',          2.0, 's',     '제품당 최대 작업 시간'),
  ('defect_rate_max',           1.0, '%',     '불량률 상한'),
  ('cost_ratio_target',        10.0, '%',     '제조원가 비율 목표'),
  ('cost_ratio_baseline',      15.0, '%',     '도입 전 제조원가 비율'),
  ('cost_improvement_target',  33.0, '%',     '제조원가 개선 목표'),
  ('claim_quarterly_max',       1.0, '건',    '분기 클레임 상한')
on conflict (key) do update set value = excluded.value, unit = excluded.unit, description = excluded.description;

insert into alarm_rules (name, metric, operator, threshold, severity, message_template) values
  ('불량률 상한 초과',  'defect_rate',  '>', 1.0, 'warning', '불량률 {{value}}% — 목표 {{threshold}}% 초과'),
  ('제조원가 상한 초과','cost_ratio',   '>', 10.0,'warning', '제조원가 {{value}}% — 목표 {{threshold}}% 초과'),
  ('재검율 이상',       'recheck_rate', '>', 1.0, 'info',    '재검율 {{value}}% — 정상범위 이탈')
on conflict do nothing;
