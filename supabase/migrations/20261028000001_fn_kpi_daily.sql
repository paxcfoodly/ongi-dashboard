-- 기간 조회용 KST 날짜별 KPI 집계 RPC (fn_kpi_daily) 추가 — 기간의 모든 날을 한 행씩, 데이터 없는 날은 0 채움
-- 장비 필터는 v_daily_kpi 와 같음 (primary_output + active, vision_inspector + active)
-- 기존 뷰·테이블은 변경하지 않는다

create or replace function fn_kpi_daily(p_from date, p_to date)
returns table (
  day                 date,
  production          int,
  runtime_sec         int,
  inspected           int,
  defects             int,
  "unknown"           int,
  inspection_time_sec numeric,
  claims              int
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_from_ts timestamptz;
  v_to_ts   timestamptz;
begin
  -- 입력 검증: 오늘(KST) 이후·2020 이전·역전·366일 초과 기간은 거부
  if p_from is null or p_to is null then
    raise exception 'p_from, p_to 는 필수입니다';
  end if;
  if p_from > p_to then
    raise exception '시작일이 종료일보다 늦습니다: % > %', p_from, p_to;
  end if;
  if p_from < date '2020-01-01' then
    raise exception '시작일은 2020-01-01 이후여야 합니다: %', p_from;
  end if;
  if p_to > (now() at time zone 'Asia/Seoul')::date then
    raise exception '종료일은 KST 오늘 이전이어야 합니다: %', p_to;
  end if;
  if p_to - p_from + 1 > 366 then
    raise exception '기간은 최대 366일입니다: % ~ %', p_from, p_to;
  end if;

  -- 인덱스를 탈 수 있도록 bucket_at 범위는 timestamptz 경계로 비교
  v_from_ts := p_from::timestamp at time zone 'Asia/Seoul';
  v_to_ts   := (p_to + 1)::timestamp at time zone 'Asia/Seoul';

  return query
  with eq as (
    select (em.bucket_at at time zone 'Asia/Seoul')::date as d,
           sum(em.output_count)    as production,
           sum(em.runtime_seconds) as runtime_sec
    from equipment_metrics em
    join devices dv on dv.id = em.device_id
    where dv.role = 'primary_output' and dv.active
      and em.bucket_at >= v_from_ts and em.bucket_at < v_to_ts
    group by 1
  ),
  vi as (
    select (vim.bucket_at at time zone 'Asia/Seoul')::date as d,
           sum(vim.total_inspected)         as inspected,
           sum(vim.defect_count)            as defects,
           sum(vim.unknown_count)           as unknown_count,
           sum(vim.inspection_time_seconds) as inspection_time_sec
    from vision_inspector_metrics vim
    join devices dv on dv.id = vim.device_id
    where dv.type = 'vision_inspector' and dv.active
      and vim.bucket_at >= v_from_ts and vim.bucket_at < v_to_ts
    group by 1
  ),
  cl as (
    select (c.received_at at time zone 'Asia/Seoul')::date as d,
           count(*) as claims
    from claims c
    where c.received_at >= v_from_ts and c.received_at < v_to_ts
    group by 1
  )
  select g.d::date,
         coalesce(eq.production, 0)::int,
         coalesce(eq.runtime_sec, 0)::int,
         coalesce(vi.inspected, 0)::int,
         coalesce(vi.defects, 0)::int,
         coalesce(vi.unknown_count, 0)::int,
         coalesce(vi.inspection_time_sec, 0)::numeric,
         coalesce(cl.claims, 0)::int
  from generate_series(p_from, p_to, interval '1 day') as g(d)
  left join eq on eq.d = g.d::date
  left join vi on vi.d = g.d::date
  left join cl on cl.d = g.d::date
  order by 1;
end;
$$;

-- 로그인 사용자만 실행 (anon·public 회수)
revoke all on function fn_kpi_daily(date, date) from public, anon;
grant execute on function fn_kpi_daily(date, date) to authenticated;
