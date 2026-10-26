-- 작업공수(man-hour)·납기 리드타임 KPI 뷰 + v_lot_summary 확장

-- LOT별 작업공수: 시작·종료·투입인원이 모두 있는 LOT만
create or replace view v_lot_manhour as
select
  l.id, l.lot_no, l.started_at, l.ended_at, l.worker_count,
  round((extract(epoch from l.ended_at - l.started_at) / 3600)::numeric, 2)
    ::numeric(10,2)                                                    as work_hours,
  round((l.worker_count * extract(epoch from l.ended_at - l.started_at) / 3600)::numeric, 2)
    ::numeric(10,2)                                                    as man_hour
from lots l
where l.started_at is not null
  and l.ended_at is not null
  and l.worker_count is not null;

-- 최근 30일(KST) 종료 LOT 평균 — 집계 뷰라 LOT이 없어도 항상 1행(lot_count=0, 나머지 null)
create or replace view v_kpi_manhour as
select
  count(*)::int                    as lot_count,
  round(avg(m.man_hour), 2)        as avg_man_hour,
  (select m2.man_hour
     from v_lot_manhour m2
    where m2.ended_at >= fn_kst_today_start() - interval '29 days'
    order by m2.ended_at desc
    limit 1)                       as latest_man_hour
from v_lot_manhour m
where m.ended_at >= fn_kst_today_start() - interval '29 days';

-- LOT별 리드타임: 수주일·출하일이 모두 있는 LOT (같은 날이면 0일)
create or replace view v_lot_leadtime as
select
  l.id, l.lot_no, l.ordered_at, l.shipped_at,
  (l.shipped_at - l.ordered_at)::int as lead_days
from lots l
where l.ordered_at is not null
  and l.shipped_at is not null;

-- 최근 30일(KST 날짜 기준) 출하 LOT 평균 리드타임 — 항상 1행
-- (세션 타임존과 무관하게 KST 날짜로 변환해 비교)
create or replace view v_kpi_leadtime as
select
  count(*)::int                            as lot_count,
  round(avg(t.lead_days), 1)::numeric(6,1) as avg_lead_days
from v_lot_leadtime t
where t.shipped_at >= (fn_kst_today_start() at time zone 'Asia/Seoul')::date - 29;

-- v_lot_summary: 기존 컬럼 순서 유지, 신규 컬럼은 맨 뒤에 추가
create or replace view v_lot_summary as
select
  l.id, l.lot_no, l.client_id, l.product_name, l.status,
  l.started_at, l.ended_at, l.target_quantity, l.notes,
  c.name                                                              as client_name,
  coalesce(sum(vim.total_inspected), 0)::int                           as inspected,
  coalesce(sum(vim.good_count), 0)::int                                as good_count,
  coalesce(sum(vim.defect_count), 0)::int                              as defect_count,
  coalesce(sum(vim.unknown_count), 0)::int                             as unknown_count,
  case when coalesce(sum(vim.total_inspected), 0) = 0 then 0
       else round(sum(vim.defect_count)::numeric / sum(vim.total_inspected) * 100, 2)
  end                                                                   as defect_rate_pct,
  case when coalesce(sum(vim.total_inspected), 0) = 0 then '미검사'
       when sum(vim.defect_count)::numeric / sum(vim.total_inspected) > 0.01 then '불합격'
       when sum(vim.defect_count)::numeric / sum(vim.total_inspected) > 0.005 then '주의'
       else '정상'
  end                                                                   as judgment,
  l.worker_count,
  l.ordered_at,
  l.shipped_at,
  round((extract(epoch from l.ended_at - l.started_at) / 3600)::numeric, 2)
    ::numeric(10,2)                                                     as work_hours,
  round((l.worker_count * extract(epoch from l.ended_at - l.started_at) / 3600)::numeric, 2)
    ::numeric(10,2)                                                     as man_hour,
  (l.shipped_at - l.ordered_at)::int                                    as lead_days
from lots l
join clients c on c.id = l.client_id
left join vision_inspector_metrics vim
  on vim.bucket_at >= coalesce(l.started_at, l.created_at)
 and (l.ended_at is null or vim.bucket_at <= l.ended_at)
group by l.id, c.name;

grant select on v_lot_manhour, v_kpi_manhour, v_lot_leadtime, v_kpi_leadtime to authenticated;
grant select on v_lot_summary to authenticated;
