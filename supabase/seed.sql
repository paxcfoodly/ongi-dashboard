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
