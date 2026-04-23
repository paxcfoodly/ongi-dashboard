-- 알람 평가 트리거: 메트릭 INSERT 시 활성 규칙을 순회하며 뷰 현재값과 비교
create or replace function fn_evaluate_alarms() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r alarm_rules%rowtype;
  v numeric;
  msg text;
begin
  for r in select * from alarm_rules where enabled loop
    -- metric 이름에 따라 현재 값 조회
    case r.metric
      when 'defect_rate'  then select defect_rate_pct   into v from v_daily_kpi;
      when 'cost_ratio'   then select cost_ratio_pct    into v from v_cost_ratio;
      when 'recheck_rate' then select recheck_rate_pct  into v from v_ai_metrics;
      else continue;
    end case;

    -- 조건 평가
    if (r.operator = '>'  and v >  r.threshold) or
       (r.operator = '>=' and v >= r.threshold) or
       (r.operator = '<'  and v <  r.threshold) or
       (r.operator = '<=' and v <= r.threshold) or
       (r.operator = '='  and v =  r.threshold) then
      msg := replace(
               replace(r.message_template, '{{value}}', round(v, 2)::text),
               '{{threshold}}', r.threshold::text
             );
      -- 30분 내 동일 규칙 중복 방지
      if not exists (
        select 1 from alarms
        where rule_id = r.id and created_at > now() - interval '30 minutes'
      ) then
        insert into alarms (rule_id, severity, source, message, metadata)
        values (
          r.id, r.severity, 'auto', msg,
          jsonb_build_object('metric', r.metric, 'value', v, 'threshold', r.threshold)
        );
      end if;
    end if;
  end loop;
  return new;
exception
  -- 트리거 실패가 메트릭 삽입 자체를 막지 않도록 예외 흡수
  when others then
    insert into alarms (severity, source, message, metadata)
    values ('info', 'system',
            'alarm evaluator failed: ' || SQLERRM,
            jsonb_build_object('sqlstate', SQLSTATE));
    return new;
end; $$;

create trigger trg_vision_alarms
  after insert on vision_inspector_metrics
  for each row execute function fn_evaluate_alarms();

create trigger trg_equipment_alarms
  after insert on equipment_metrics
  for each row execute function fn_evaluate_alarms();

comment on function fn_evaluate_alarms() is
  '메트릭 INSERT 시 활성 알람 규칙을 평가하고 alarms 테이블에 기록';
