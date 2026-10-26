-- 롤백: 신규 키 삭제 → 삭제했던 원가 키 복원(20260424000009 원래 값) → 알람 재활성화
-- 주의: 기존 키(hourly_production 등)의 description은 원래 문구로 되돌린다.
-- [실행 순서] 롤백은 반드시 역순(000006 → 000005 → … → 000001)으로, 중간에 멈추지 말고 실행한다.
-- [프론트엔드] 000001·000003 롤백 전에 프론트엔드를 이전 배포로 먼저 되돌린다 (새 컬럼·뷰를 조회하므로).
-- [백업] 실행 전 데이터 백업 필수:
--   create schema if not exists backup;
--   create table backup._targets_backup as select * from targets;
--   (API에 노출되는 public 스키마에는 절대 만들지 않는다)
--   롤백 후 검증이 끝나면 삭제: drop table backup._targets_backup; (backup 스키마가 비면 drop schema backup;)

begin;

delete from targets where key in (
  'hourly_production_baseline', 'defect_rate_baseline', 'work_time_baseline',
  'manhour_baseline', 'manhour_target', 'lot_weight_kg',
  'leadtime_baseline', 'leadtime_target',
  'job_conversion_baseline', 'job_conversion_target',
  'satisfaction_baseline', 'satisfaction_target',
  'claim_quarterly_baseline'
);

insert into targets (key, value, unit, description) values
('daily_production', 15000, 'ea', '일일 목표 생산량'),
('hourly_production', 1800, 'ea/hr', '시간당 목표 생산량'),
('work_time_per_ea', 2.0, 's', '제품당 최대 작업 시간'),
('defect_rate_max', 1.0, '%', '불량률 상한'),
('cost_ratio_target', 10.0, '%', '제조원가 비율 목표'),
('cost_ratio_baseline', 15.0, '%', '도입 전 제조원가 비율'),
('cost_improvement_target', 33.0, '%', '제조원가 개선 목표'),
('claim_quarterly_max', 1.0, '건', '분기 클레임 상한')
on conflict (key) do update set value = excluded.value, unit = excluded.unit, description = excluded.description;

update alarm_rules set enabled = true where name = '제조원가 상한 초과';

commit;
