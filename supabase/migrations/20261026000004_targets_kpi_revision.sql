-- 성과지표 개정: 기존(baseline)/목표 targets 키 upsert, 원가비율 키 삭제, 원가 알람 비활성화
insert into targets (key, value, unit, description) values
('hourly_production_baseline', 1500, 'ea/hr',    '시간당 생산량 기존'),
('hourly_production',          1800, 'ea/hr',    '시간당 목표 생산량'),
('defect_rate_baseline',       2.0,  '%',        '불량률 기존'),
('defect_rate_max',            1.0,  '%',        '불량률 상한(목표)'),
('work_time_baseline',         2.4,  's',        '제품당 작업시간 기존'),
('work_time_per_ea',           2.0,  's',        '제품당 최대 작업 시간(목표)'),
('manhour_baseline',           24,   'man-hour', 'LOT당 작업공수 기존'),
('manhour_target',             16,   'man-hour', 'LOT당 작업공수 목표'),
('lot_weight_kg',              300,  'kg',       '1 LOT 중량 (표시용)'),
('leadtime_baseline',          15,   '일',       '납기 기존'),
('leadtime_target',            12,   '일',       '납기 목표'),
('job_conversion_baseline',    0,    '%',        '직무 전환율 기존'),
('job_conversion_target',      50,   '%',        '직무 전환율 목표'),
('satisfaction_baseline',      0,    '점',       '만족도 기존'),
('satisfaction_target',        4.5,  '점',       '만족도 목표'),
('claim_quarterly_baseline',   4,    '건',       '분기 클레임 기존'),
('claim_quarterly_max',        1,    '건',       '분기 클레임 상한(목표)'),
('daily_production',           15000,'ea',       '일일 목표 생산량 (운영 참고, 성과지표 아님)')
on conflict (key) do update
  set value = excluded.value, unit = excluded.unit, description = excluded.description;

-- 제조원가 비율 지표 폐기
delete from targets
 where key in ('cost_ratio_target', 'cost_ratio_baseline', 'cost_improvement_target');

-- 원가비율 알람 규칙은 삭제하지 않고 비활성화
update alarm_rules set enabled = false where name = '제조원가 상한 초과';
