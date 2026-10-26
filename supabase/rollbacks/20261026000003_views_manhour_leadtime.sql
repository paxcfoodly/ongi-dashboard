-- 롤백: KPI 뷰 4개 제거 + v_lot_summary를 20260423000019 원래 정의로 복원
-- (컬럼 축소는 create or replace 불가 → drop 후 재생성)
drop view if exists v_kpi_manhour;
drop view if exists v_kpi_leadtime;
drop view if exists v_lot_manhour;
drop view if exists v_lot_leadtime;
drop view if exists v_lot_summary;

create view v_lot_summary as
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
  end                                                                   as judgment
from lots l
join clients c on c.id = l.client_id
left join vision_inspector_metrics vim
  on vim.bucket_at >= coalesce(l.started_at, l.created_at)
 and (l.ended_at is null or vim.bucket_at <= l.ended_at)
group by l.id, c.name;

grant select on v_lot_summary to authenticated;
