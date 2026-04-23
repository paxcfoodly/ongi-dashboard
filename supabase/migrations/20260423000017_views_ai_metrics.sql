create or replace view v_ai_metrics as
select
  coalesce(sum(total_inspected), 0)::int                   as total_inspected,
  coalesce(sum(defect_count), 0)::int                      as defect_count,
  coalesce(sum(unknown_count), 0)::int                     as unknown_count,
  coalesce(sum(inspection_time_seconds), 0)::numeric       as total_inspection_time_sec,
  case when coalesce(sum(total_inspected), 0) = 0 then 0
       else round(sum(defect_count)::numeric / sum(total_inspected) * 100, 2)
  end                                                       as defect_detection_pct,
  case when coalesce(sum(inspection_time_seconds), 0) = 0 then 0
       else round(sum(total_inspected) / (sum(inspection_time_seconds) / 3600.0), 0)::int
  end                                                       as throughput_ea_per_hr,
  case when coalesce(sum(total_inspected), 0) = 0 then 0
       else round(sum(unknown_count)::numeric / sum(total_inspected) * 100, 2)
  end                                                       as recheck_rate_pct
from vision_inspector_metrics vim
join devices d on d.id = vim.device_id
where d.type = 'vision_inspector' and d.active
  and bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul');

grant select on v_ai_metrics to authenticated;
