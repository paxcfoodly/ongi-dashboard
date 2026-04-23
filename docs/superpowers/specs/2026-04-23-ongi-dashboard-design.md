# 온기코퍼레이션 생산 모니터링 대시보드 — Design Spec

- **작성일**: 2026-04-23
- **상태**: Draft — 사용자 검토 대기
- **참고 자료**: `Ongi_Sample_Dashboard.html` (단일 파일 목업, 4개 탭 구성)

---

## 1. 개요

온열팩 제조사 "온기코퍼레이션"의 생산 라인을 실시간 모니터링하는 내부용 웹 대시보드. 6대의 생산 장비에서 1분 단위로 집계된 데이터를 HTTPS로 수신하여 Postgres에 저장하고, 인증된 사용자(1~3명)가 브라우저에서 실시간 KPI, AI 성능지표, 제조원가, LOT 이력을 확인한다. 회원가입은 없으며 관리자가 직접 계정을 발급한다.

## 2. 목표 및 범위

### In Scope
- 장비 데이터 수신 API (Supabase Edge Function)
- Postgres 데이터 저장 (1분 집계 영구 보관)
- 로그인 기반 대시보드 (4개 모니터링 탭 + 6개 관리 페이지)
- 데스크톱 + 태블릿 + 모바일 반응형 UI
- 알람 엔진 (임계값 자동 + 수동 등록)
- PDF 리포트 생성 (LOT 성적서 등)
- 관리자용 사용자 초대·역할 관리

### Out of Scope (MVP 단계)
- "AI 분석 요청" 버튼 기능 — UI와 버튼은 구현, 클릭 시 mock 응답 (추후 LLM 연동)
- LOT의 외부 MES/ERP 연동 — MVP는 대시보드에서 수동 생성
- 다공장·다라인 지원
- 모델 성능지표 중 **Precision / Recall / F1**: 장비 데이터만으로는 산출 불가(ground truth 부재) — UI 표시는 유지하되 값은 추후 주입 또는 mock 처리
- 회원가입, 소셜 로그인, 비밀번호 초기화 셀프서비스

## 3. 사용자 및 접근 제어

| 역할 | 인원 | 권한 |
|---|---|---|
| **admin** | 1명 (운영자) | 전체 읽기 + LOT/클레임/장비/알람규칙/목표/사용자 CRUD |
| **viewer** | 1~2명 (현장 담당) | 전체 읽기 + 알람 acknowledge + 클레임 등록 |

- 로그인 방식: Supabase Auth 이메일/비밀번호
- 회원가입 없음. admin이 초대(invite-user Edge Function)로 계정 발급
- RLS로 행 수준 보안 강제

## 4. 아키텍처

```
[ 생산 장비 6대 ]                            [ Supabase ]
 ├ AI 비전검사기                              ┌─────────────────────────────┐
 ├ 삼면포장기       ── HTTPS POST ─────────▶  │ Edge Function: /ingest       │
 ├ 자동제함기          (1분 주기)              │  - API 키 검증                │
 ├ 자동테이핑기                                │  - JSON/CSV 파싱              │
 ├ 자동랩핑기                                  │  - Zod 스키마 검증            │
 └ 컨베이어                                    │  - Postgres INSERT           │
                                              └───────────────┬──────────────┘
                                                              │
                                              ┌───────────────▼──────────────┐
                                              │ Postgres                     │
                                              │  - 테이블 + 뷰 + 트리거       │
                                              │  - RLS                        │
                                              └───────────────┬──────────────┘
                                                              │
                                [ 프론트엔드 (Vite + React + TS) ]
                                 ├ 30초 폴링 (KPI/AI/제조원가/LOT)
                                 ├ Realtime 구독 (alarms만)
                                 └ REST/RPC (CRUD)

                                              ┌──────────────────────────────┐
                                              │ Edge Function: /generate-pdf │
                                              │  - pdfmake + Noto Sans KR    │
                                              │  - Storage 업로드 + 서명 URL │
                                              └──────────────────────────────┘
```

### 기술 스택
- **Frontend**: Vite + React + TypeScript, Tailwind CSS, react-chartjs-2, @tanstack/react-query, react-hook-form + zod, React Router
- **Backend**: Supabase (Postgres + Auth + Realtime + Edge Functions + Storage)
- **Edge Functions**: Deno + TypeScript, pdfmake
- **Hosting**: Vercel 또는 Cloudflare Pages (프론트 정적 호스팅), Supabase (백엔드)

## 5. 데이터 흐름

### 수집 (Ingest)
1. 장비가 1분마다 `POST /functions/v1/ingest`로 집계 데이터 전송
2. Edge Function이 API 키 검증 → 스키마 검증 → 해당 메트릭 테이블 INSERT
3. INSERT 트리거가 알람 규칙 평가 → 조건 만족 시 `alarms` 테이블 INSERT
4. 실패 케이스는 `ingest_logs`에 raw payload와 함께 기록

### 표시 (Display)
1. 프론트가 로그인 상태에서 각 페이지 진입 시 관련 뷰 쿼리
2. `@tanstack/react-query`가 30초 간격 자동 폴링 + 윈도우 포커스 복귀 시 리페치
3. `alarms` 테이블은 Supabase Realtime 구독으로 INSERT 즉시 수신 → Toast 알림
4. 장비 상태(가동중/점검 필요)는 `devices`의 `last_seen` 타임스탬프로 판별 (2분 이상 미수신 시 점검 필요)

### 조작 (Write)
1. LOT 생성/종료, 클레임 등록, 알람 acknowledge, 목표값 수정 등은 인증 세션으로 RLS 통과
2. 쓰기 성공 시 해당 쿼리 키 invalidate → UI 즉시 반영

## 6. 데이터베이스 스키마

### 6.1 장비 및 메트릭

```sql
-- 장비 마스터 (동적 추가 가능)
create type device_type as enum ('vision_inspector', 'equipment');

create table devices (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,        -- "vision_01", "packaging_01"
  name            text not null,                -- "AI 비전검사기"
  type            device_type not null,
  role            text,                         -- 'primary_output' | 'inspection' | 'secondary' | null
                                                -- 'primary_output': "오늘 생산량"의 기준 장비 (복수 가능, 합산)
                                                -- 'inspection': AI 성능지표·불량률의 기준 장비
  process_order   int not null,                 -- 공정 순서 (재공재고 산출용, 낮은 수 → 높은 수)
  api_key_hash    text not null,                -- 장비 인증키 (해시)
  active          boolean not null default true,
  last_seen_at    timestamptz,                  -- 마지막 데이터 수신 시각
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 초기 시드 예시 (실제 공정 매핑은 담당자 협의 필요 — 17장 참조)
-- code='packaging_01',  name='삼면포장기',    type='equipment',         role='primary_output', process_order=1
-- code='vision_01',     name='AI 비전검사기', type='vision_inspector',  role='inspection',     process_order=2
-- code='caser_01',      name='자동제함기',    type='equipment',         role=null,             process_order=3
-- code='taper_01',      name='자동테이핑기',  type='equipment',         role=null,             process_order=4
-- code='wrapper_01',    name='자동랩핑기',    type='equipment',         role=null,             process_order=5
-- code='conveyor_01',   name='컨베이어',      type='equipment',         role=null,             process_order=6

-- AI 비전검사기 전용 (필드 타입 명시)
create table vision_inspector_metrics (
  id                       bigserial primary key,
  device_id                uuid not null references devices(id),
  bucket_at                timestamptz not null,       -- 1분 버킷 시작
  total_inspected          int not null check (total_inspected >= 0),
  good_count               int not null check (good_count >= 0),
  defect_count             int not null check (defect_count >= 0),
  unknown_count            int not null check (unknown_count >= 0),
  inspection_time_seconds  numeric(10,2) not null check (inspection_time_seconds >= 0),
  created_at               timestamptz not null default now(),
  unique (device_id, bucket_at),
  check (total_inspected = good_count + defect_count + unknown_count)
);
create index on vision_inspector_metrics (bucket_at desc);

-- 일반 장비 (삼면포장기, 제함기, 테이핑기, 랩핑기, 컨베이어)
create table equipment_metrics (
  id               bigserial primary key,
  device_id        uuid not null references devices(id),
  bucket_at        timestamptz not null,
  runtime_seconds  int not null check (runtime_seconds >= 0 and runtime_seconds <= 60),
  output_count     int not null check (output_count >= 0),
  extras           jsonb not null default '{}'::jsonb,   -- 미래 필드 확장
  created_at       timestamptz not null default now(),
  unique (device_id, bucket_at)
);
create index on equipment_metrics (bucket_at desc);
create index on equipment_metrics (device_id, bucket_at desc);
```

### 6.2 LOT / 납품처 / 클레임

```sql
create table clients (
  id            uuid primary key default gen_random_uuid(),
  name          text unique not null,              -- "삼성웰스토리"
  contact_info  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create type lot_status as enum ('planned', 'running', 'completed', 'paused');

create table lots (
  id               uuid primary key default gen_random_uuid(),
  lot_no           text unique not null,           -- "LOT-2609150001"
  client_id        uuid not null references clients(id),
  product_name     text,
  target_quantity  int check (target_quantity > 0),
  started_at       timestamptz,
  ended_at         timestamptz,
  status           lot_status not null default 'planned',
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on lots (started_at desc);
create index on lots (status);

create type claim_status as enum ('open', 'investigating', 'resolved');

create table claims (
  id                   uuid primary key default gen_random_uuid(),
  lot_id               uuid references lots(id),
  client_id            uuid not null references clients(id),
  received_at          timestamptz not null,
  defect_type          text,
  quantity             int check (quantity >= 0),
  description          text,
  status               claim_status not null default 'open',
  response_report_url  text,                        -- Storage signed URL
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on claims (received_at desc);
create index on claims (client_id);
```

### 6.3 목표값 / 알람

```sql
create table targets (
  key          text primary key,               -- 'daily_production', 'defect_rate_max', ...
  value        numeric not null,
  unit         text,                           -- 'ea', '%', 's', 'ea/hr'
  description  text,
  updated_at   timestamptz not null default now()
);

-- 초기 seed 값
-- ('daily_production',     15000,  'ea')
-- ('hourly_production',    1800,   'ea/hr')
-- ('work_time_per_ea',     2.0,    's')
-- ('defect_rate_max',      1.0,    '%')
-- ('cost_ratio_target',    10.0,   '%')
-- ('cost_ratio_baseline',  15.0,   '%')
-- ('cost_improvement_target', 33.0, '%')
-- ('claim_quarterly_max',  1,      '건')

create type severity_level as enum ('info', 'warning', 'danger');

create table alarm_rules (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  metric           text not null,              -- 'defect_rate', 'cost_ratio', 'device_offline', ...
  operator         text not null check (operator in ('>', '>=', '<', '<=', '=')),
  threshold        numeric not null,
  severity         severity_level not null default 'warning',
  message_template text not null,              -- "{{metric}} {{value}} — 목표 {{threshold}} 초과"
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create type alarm_source as enum ('auto', 'manual', 'system');

create table alarms (
  id                uuid primary key default gen_random_uuid(),
  rule_id           uuid references alarm_rules(id),
  severity          severity_level not null,
  source            alarm_source not null,
  device_id         uuid references devices(id),
  message           text not null,
  metadata          jsonb not null default '{}'::jsonb,
  acknowledged      boolean not null default false,
  acknowledged_by   uuid references auth.users(id),
  acknowledged_at   timestamptz,
  created_at        timestamptz not null default now()
);
create index on alarms (created_at desc);
create index on alarms (acknowledged) where acknowledged = false;
```

### 6.4 사용자 프로필 및 로그

```sql
create type user_role as enum ('admin', 'viewer');

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'viewer',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 장비 수신 로그 (디버깅용, 1000건 롤링)
create table ingest_logs (
  id             bigserial primary key,
  device_code    text,
  received_at    timestamptz not null default now(),
  status         text not null,                 -- 'success' | 'invalid_key' | 'invalid_schema' | 'db_error'
  error_message  text,
  raw_payload    jsonb
);
create index on ingest_logs (received_at desc);
```

### 6.5 파생 뷰 (KPI 계산 로직)

```sql
-- 오늘 기준 KPI
create view v_daily_kpi as
  with today_packaging as (
    -- role='primary_output'인 모든 장비의 합산 (삼면포장기 복수 대응 가능)
    select coalesce(sum(output_count), 0)::int        as today_production,
           coalesce(sum(runtime_seconds), 0)::numeric as runtime_sec_today
    from equipment_metrics em
    join devices d on d.id = em.device_id
    where d.role = 'primary_output' and d.active
      and bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')
  ),
  today_vision as (
    select coalesce(sum(total_inspected), 0)::int as inspected,
           coalesce(sum(defect_count), 0)::int    as defects
    from vision_inspector_metrics vim
    join devices d on d.id = vim.device_id
    where d.type = 'vision_inspector'
      and bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')
  ),
  quarter_claims as (
    select count(*)::int as claims_count
    from claims
    where received_at >= date_trunc('quarter', now() at time zone 'Asia/Seoul')
  )
  select
    tp.today_production,
    case when tp.runtime_sec_today = 0 then 0
         else round(tp.today_production / (tp.runtime_sec_today / 3600.0), 0) end   as hourly_production,
    case when tp.today_production = 0 then 0
         else round(tp.runtime_sec_today / tp.today_production, 2) end              as work_time_per_ea,
    case when tv.inspected = 0 then 0
         else round(tv.defects::numeric / tv.inspected * 100, 2) end                as defect_rate_pct,
    qc.claims_count
  from today_packaging tp, today_vision tv, quarter_claims qc;

-- AI 성능지표 (오늘 기준)
create view v_ai_metrics as
  -- ① 불량 검출율 산출식은 샘플 그대로 (판정 불량수 ÷ 전체 검사수) × 100
  --    실제 Recall이 아닌 defect observation rate라는 한계는 스펙에 명시
  -- ② 검사 처리량 = 전체 검사수 ÷ 전체 검사시간(hr)
  -- ③ 재검율 = 판정불가수 ÷ 전체 검사수 × 100
  select
    sum(total_inspected)::int                                                as total_inspected,
    sum(defect_count)::int                                                    as defect_count,
    sum(unknown_count)::int                                                   as unknown_count,
    sum(inspection_time_seconds)::numeric                                     as total_inspection_time_sec,
    case when sum(total_inspected) = 0 then 0
         else round(sum(defect_count)::numeric / sum(total_inspected) * 100, 2)
    end                                                                       as defect_detection_pct,
    case when sum(inspection_time_seconds) = 0 then 0
         else round(sum(total_inspected) / (sum(inspection_time_seconds) / 3600.0), 0)
    end                                                                       as throughput_ea_per_hr,
    case when sum(total_inspected) = 0 then 0
         else round(sum(unknown_count)::numeric / sum(total_inspected) * 100, 2)
    end                                                                       as recheck_rate_pct
  from vision_inspector_metrics vim
  join devices d on d.id = vim.device_id
  where d.type = 'vision_inspector'
    and bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul');

-- 재공재고 흐름 (공정 순서 기반)
create view v_wip_flow as
  with today_by_device as (
    select d.id, d.code, d.name, d.process_order,
           coalesce(sum(em.output_count), 0)::int as output_today
    from devices d
    left join equipment_metrics em
      on em.device_id = d.id
     and em.bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')
    where d.type = 'equipment' and d.active
    group by d.id
    union all
    select d.id, d.code, d.name, d.process_order,
           coalesce(sum(vim.total_inspected), 0)::int
    from devices d
    left join vision_inspector_metrics vim
      on vim.device_id = d.id
     and vim.bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')
    where d.type = 'vision_inspector' and d.active
    group by d.id
  )
  select
    a.code          as from_code,
    a.name          as from_name,
    b.code          as to_code,
    b.name          as to_name,
    a.output_today  as input,
    b.output_today  as output,
    greatest(a.output_today - b.output_today, 0) as wip_quantity
  from today_by_device a
  join today_by_device b on b.process_order = a.process_order + 1
  order by a.process_order;

-- 제조원가 비율
create view v_cost_ratio as
  with totals as (
    select
      (select sum(wip_quantity) from v_wip_flow)                        as wip_total,
      (select today_production from v_daily_kpi)                        as total_production
  )
  select
    wip_total,
    total_production,
    case when total_production = 0 then 0
         else round(wip_total::numeric / total_production * 100, 2) end as cost_ratio_pct
  from totals;

-- LOT별 집계
create view v_lot_summary as
  select
    l.id, l.lot_no, l.client_id, l.status, l.started_at, l.ended_at, l.target_quantity,
    coalesce(sum(vim.total_inspected), 0)::int                          as inspected,
    coalesce(sum(vim.good_count), 0)::int                               as good_count,
    coalesce(sum(vim.defect_count), 0)::int                             as defect_count,
    case when sum(vim.total_inspected) = 0 then 0
         else round(sum(vim.defect_count)::numeric / sum(vim.total_inspected) * 100, 2)
    end                                                                  as defect_rate_pct,
    -- 판정 로직: 불량률 >1% = 불합격, 0.5~1% = 주의, <0.5% = 정상
    case when sum(vim.total_inspected) = 0 then '미검사'
         when sum(vim.defect_count)::numeric / sum(vim.total_inspected) > 0.01 then '불합격'
         when sum(vim.defect_count)::numeric / sum(vim.total_inspected) > 0.005 then '주의'
         else '정상'
    end                                                                  as judgment
  from lots l
  left join vision_inspector_metrics vim
    on vim.bucket_at >= l.started_at
   and (l.ended_at is null or vim.bucket_at <= l.ended_at)
  group by l.id;
```

### 6.6 트리거

```sql
-- 1. 메트릭 INSERT 시 devices.last_seen_at 갱신
--    updated_at은 건드리지 않음 (마스터 메타 변경과 수신 타임스탬프 분리)
create function fn_touch_device_last_seen() returns trigger as $$
begin
  update devices set last_seen_at = new.bucket_at
  where id = new.device_id
    and (last_seen_at is null or last_seen_at < new.bucket_at);
  return new;
end $$ language plpgsql;

create trigger trg_vision_last_seen after insert on vision_inspector_metrics
for each row execute function fn_touch_device_last_seen();
create trigger trg_equipment_last_seen after insert on equipment_metrics
for each row execute function fn_touch_device_last_seen();

-- 2. 메트릭 INSERT 시 알람 규칙 평가
create function fn_evaluate_alarms() returns trigger as $$
declare
  r alarm_rules%rowtype;
  v numeric;
  msg text;
begin
  for r in select * from alarm_rules where enabled loop
    -- metric 이름에 따라 현재 값 조회
    case r.metric
      when 'defect_rate'  then select defect_rate_pct into v from v_daily_kpi;
      when 'cost_ratio'   then select cost_ratio_pct  into v from v_cost_ratio;
      when 'recheck_rate' then select recheck_rate_pct into v from v_ai_metrics;
      else continue;
    end case;

    if (r.operator = '>'  and v >  r.threshold) or
       (r.operator = '>=' and v >= r.threshold) or
       (r.operator = '<'  and v <  r.threshold) or
       (r.operator = '<=' and v <= r.threshold) or
       (r.operator = '='  and v =  r.threshold) then
      msg := replace(replace(r.message_template, '{{value}}', v::text), '{{threshold}}', r.threshold::text);
      -- 30분 내 동일 규칙 중복 방지
      if not exists (
        select 1 from alarms
        where rule_id = r.id and created_at > now() - interval '30 minutes'
      ) then
        insert into alarms (rule_id, severity, source, message, metadata)
        values (r.id, r.severity, 'auto', msg, jsonb_build_object('metric', r.metric, 'value', v));
      end if;
    end if;
  end loop;
  return new;
end $$ language plpgsql;

create trigger trg_vision_alarms after insert on vision_inspector_metrics
for each row execute function fn_evaluate_alarms();
create trigger trg_equipment_alarms after insert on equipment_metrics
for each row execute function fn_evaluate_alarms();

-- 3. device_offline 체크 — Edge Function 스케줄(매 분) 또는 프론트 파생
--    본 스펙에서는 프론트에서 devices.last_seen_at < now() - 2min 판별
```

### 6.7 RLS 정책

```sql
alter table devices                      enable row level security;
alter table vision_inspector_metrics     enable row level security;
alter table equipment_metrics            enable row level security;
alter table lots                         enable row level security;
alter table clients                      enable row level security;
alter table claims                       enable row level security;
alter table targets                      enable row level security;
alter table alarm_rules                  enable row level security;
alter table alarms                       enable row level security;
alter table profiles                     enable row level security;
alter table ingest_logs                  enable row level security;

-- 읽기: 인증된 모든 사용자
create policy "authed read" on devices                  for select using (auth.role() = 'authenticated');
create policy "authed read" on vision_inspector_metrics for select using (auth.role() = 'authenticated');
create policy "authed read" on equipment_metrics        for select using (auth.role() = 'authenticated');
create policy "authed read" on lots                     for select using (auth.role() = 'authenticated');
create policy "authed read" on clients                  for select using (auth.role() = 'authenticated');
create policy "authed read" on claims                   for select using (auth.role() = 'authenticated');
create policy "authed read" on targets                  for select using (auth.role() = 'authenticated');
create policy "authed read" on alarm_rules              for select using (auth.role() = 'authenticated');
create policy "authed read" on alarms                   for select using (auth.role() = 'authenticated');

-- 쓰기: admin만 (profiles.role)
create policy "admin write" on devices        for all using (is_admin()) with check (is_admin());
create policy "admin write" on lots           for all using (is_admin()) with check (is_admin());
create policy "admin write" on clients        for all using (is_admin()) with check (is_admin());
create policy "admin write" on claims         for all using (is_admin()) with check (is_admin());  -- MVP에선 admin만, 추후 viewer도 생성 허용 고려
create policy "admin write" on targets        for all using (is_admin()) with check (is_admin());
create policy "admin write" on alarm_rules    for all using (is_admin()) with check (is_admin());

-- alarms: 모든 인증 사용자가 acknowledge 가능
create policy "ack alarm" on alarms for update
  using (auth.role() = 'authenticated')
  with check (acknowledged = true);

-- 메트릭 INSERT는 service_role만 (Edge Function 내부)
-- Edge Function은 SERVICE_ROLE_KEY를 환경변수로 보유 → RLS 우회

-- profiles: 본인 SELECT + admin이 타인 편집
create policy "self read"  on profiles for select using (id = auth.uid() or is_admin());
create policy "admin write" on profiles for all using (is_admin()) with check (is_admin());

-- is_admin() 헬퍼
create function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and active
  );
$$ language sql stable security definer;
```

## 7. 장비 수신 API 계약 (Edge Function `/ingest`)

### 엔드포인트
```
POST https://<project>.supabase.co/functions/v1/ingest
```

### 헤더
```
Authorization: Bearer <SUPABASE_ANON_KEY>          -- Supabase 통과용
X-Device-Code: vision_01                            -- 장비 코드
X-Api-Key:     <장비별 발급 키(평문)>               -- 장비 인증
Content-Type:  application/json | text/csv
```

### 바디 (AI 비전검사기 예시, JSON)
```json
{
  "bucket_at": "2026-04-23T14:15:00+09:00",
  "metrics": {
    "total_inspected": 1832,
    "good_count":      1805,
    "defect_count":    22,
    "unknown_count":   5,
    "inspection_time_seconds": 58.4
  }
}
```

### 바디 (일반 장비 예시, JSON)
```json
{
  "bucket_at": "2026-04-23T14:15:00+09:00",
  "metrics": {
    "runtime_seconds": 58,
    "output_count":    1845
  }
}
```

### CSV 지원 (장비 쪽 제약 시)
`Content-Type: text/csv`, 첫 줄 헤더:
```
bucket_at,total_inspected,good_count,defect_count,unknown_count,inspection_time_seconds
2026-04-23T14:15:00+09:00,1832,1805,22,5,58.4
```

### 검증 규칙 (Zod)
- `bucket_at`: ISO 8601, 미래 아님, 과거 48시간 이내
- 모든 수치 필드: 음수 금지
- 비전검사기: `total_inspected == good + defect + unknown`
- 일반 장비: `runtime_seconds <= 60`

### 응답
| 상태 | 상황 | 바디 |
|---|---|---|
| 200 | 정상 수신 | `{ "ok": true, "ingested_at": "..." }` |
| 200 | 중복 bucket_at (멱등 처리) | `{ "ok": true, "duplicate": true }` |
| 400 | 스키마 오류 | `{ "error": "schema_invalid", "details": [...] }` |
| 401 | API 키 불일치 | `{ "error": "invalid_api_key" }` |
| 404 | device_code 미등록 | `{ "error": "device_not_found" }` |
| 500 | 내부 오류 | `{ "error": "internal", "request_id": "..." }` |

실패 케이스는 모두 `ingest_logs`에 기록.

## 8. 화면 구성

### 8.1 라우팅

```
/login                          Supabase Auth 이메일+비밀번호
/                               인증 후 /kpi로 리다이렉트

(AuthGate)
  /kpi                          실시간 KPI
  /ai                           AI 성능지표
  /cost                         제조원가
  /lot                          LOT 이력

  (AdminGate)
    /admin/lots                 LOT 생성·종료·수정
    /admin/claims               클레임 등록·관리
    /admin/devices              장비 등록·API 키 발급
    /admin/alarm-rules          알람 규칙 관리
    /admin/targets              목표값 관리
    /admin/users                사용자 초대·역할 관리
```

### 8.2 공통 레이아웃
- 상단 헤더: 로고, 페이지 타이틀, 가동 상태 인디케이터(점등), 시계(JetBrains Mono), 사용자 메뉴(로그아웃)
- 탭바: 데스크톱은 상단 가로 탭, 모바일은 햄버거 메뉴로 전환
- 푸터: 버전 정보

### 8.3 페이지별 핵심 요소

| 페이지 | 주요 구성 |
|---|---|
| **실시간 KPI** | 6개 KPI 카드 (각 카드 하단에 산출식 박스 표시) / 진행률 카드 2개 / 설비 상태 그리드 / 시간대별 생산량·제조원가 추이 차트 / 최근 알람 리스트 |
| **AI 성능지표** | 3개 AI 카드(불량검출율·검사처리량·재검율) + 각 산출식 / AI 성능 7일 추이·PR/F1 차트 / 모델 성능 기준 설명 박스 |
| **제조원가** | 제조원가 비율 Hero / 공정 흐름도(재공재고 시각화) / 4개 스탯 카드 / 7일 추이·공정별 재공 차트 / "개선방안 분석 요청" 버튼 |
| **LOT 이력** | 필터(검색·납품처·판정·날짜) / LOT 테이블 / 행 클릭 시 상세 패널 / PDF 출력 버튼 |
| **/admin/lots** | LOT 테이블(상태별) / 생성·수정 폼(lot_no, client, target_quantity, planned_at, notes) / 시작·종료 토글 |
| **/admin/claims** | 클레임 테이블 / 등록 폼(client, lot_no, defect_type, quantity, description) / 상태 변경 |
| **/admin/devices** | 장비 테이블 / 등록·수정 폼(code, name, type, process_order) / API 키 발급·재발급(1회 노출) |
| **/admin/alarm-rules** | 규칙 테이블 / 생성 폼(name, metric, operator, threshold, severity, message_template) / 활성 토글 |
| **/admin/targets** | 키·값 편집 테이블 (seed 후 값만 수정) |
| **/admin/users** | 초대 폼(email, role) → invite-user Edge Function 호출 / 역할 변경·비활성화 |

### 8.4 디렉토리 구조

```
src/
├ lib/                supabase.ts, queryClient.ts, chartDefaults.ts
├ hooks/              useAuth, useKpiData, useAiMetrics, useCostRatio, useWipFlow, useLots, useAlarms, useClaims
├ pages/              LoginPage, KpiPage, AiPage, CostPage, LotHistoryPage, admin/*
├ components/
│  ├ layout/          Header, TabBar, MobileNav, Footer, Clock, LiveDot
│  ├ common/          KpiCard, FormulaBox, ProgressBar, Pill, StatusDot, ChartCard, DataTable, FormField
│  ├ charts/          HourlyProductionChart, CostTrendChart, AiTrendChart, PrfBarChart, WipPieChart
│  └ alarm/           AlarmList, AlarmToast, AlarmRuleForm
├ types/              db.ts (Supabase CLI 자동 생성)
└ styles/             tokens.css, tailwind.config.ts
```

## 9. KPI 산출 규칙

산출식은 DB 뷰(`v_daily_kpi`, `v_ai_metrics`, `v_cost_ratio`, `v_wip_flow`, `v_lot_summary`)에 캡슐화. UI는 뷰 결과를 표시만 하고 산출식 박스로 수식을 사용자에게 노출.

### 실시간 KPI 탭 (카드 하단 산출식 박스)

| 카드 | 산출식 | 데이터 출처 |
|---|---|---|
| 오늘 생산량 | `Σ(일 생산량)` — 오늘 00:00 이후 누적 | 삼면포장기 `equipment_metrics.output_count` |
| 시간당 생산량 | `총 생산수량(ea) ÷ 가동시간(hr)` | 삼면포장기 `output_count / (runtime_seconds/3600)` |
| 작업시간 / ea | `총 생산시간(sec) ÷ 총 생산수량(ea)` | 삼면포장기 `runtime_seconds / output_count` |
| 불량률 | `(불량수량 ÷ 총 생산수량) × 100` | AI 비전검사기 `defect_count / total_inspected` |
| 제조원가 비율 | `(재공재고 합계 ÷ 총 생산수량) × 100` | `v_cost_ratio` |
| 고객 클레임 | `분기 내 COUNT(claims)` | `claims` 테이블 |

### AI 성능지표 탭

| 카드 | 산출식 | 주의 |
|---|---|---|
| ① 불량 검출율 | `(판정 불량수 ÷ 전체 검사수) × 100` | 실제로는 관측 불량률. True recall은 ground truth 필요. UI 설명에 "현장 검증 중" 표기 |
| ② 검사 처리량 | `총 검사수량 ÷ 총 검사시간(hr)` | 목표 1,800 ea/hr |
| ③ 재검율 | `(판정불가수 ÷ 전체 검사수) × 100` | 정상 범위 1% 이하 |
| Precision / Recall / F1 | — (ground truth 부재) | MVP는 mock 값 + "추후 모델 평가 리포트 연동" 안내 |

## 10. 디자인 시스템

### 10.1 컬러 토큰 (라이트 테마)

```css
:root {
  /* 베이스 */
  --bg:          #F5F8FC;   /* 블루그레이 배경 */
  --surface:     #FFFFFF;   /* 카드 */
  --surface2:    #EEF4FB;   /* 호버·섹션 구분 */
  --border:      #DCE6F2;
  --border2:     #B9CCE1;

  /* 텍스트 */
  --text:        #0F2340;   /* 본문 (딥 네이비) */
  --text-dim:    #5F708A;
  --text-muted:  #8CA0B8;

  /* 프라이머리 */
  --primary:       #1E64B4;
  --primary-light: #D2E6FA;
  --primary-dark:  #154A89;
  --primary-gradient: linear-gradient(90deg, #1E64B4 0%, #4A90D9 60%, #7FB5E8 100%);

  /* 시맨틱 */
  --green:       #1D9E75;  --green-light:  #E6F5EE;  --green-dark:  #14704F;
  --amber:       #E8933A;  --amber-light:  #FDF1DE;  --amber-dark:  #A2600F;
  --red:         #D94444;  --red-light:    #FBE6E6;  --red-dark:    #932929;

  /* 반경 */
  --radius:    8px;
  --radius-lg: 12px;
}

/* KPI 카드 강조 */
.accent-warn { background: #FEF6E7; border-color: #F0D39A; }
.accent-ok   { background: #EAF7F1; border-color: #A9DEC6; }
```

Tailwind 매핑: 위 토큰을 `tailwind.config.ts`의 `theme.extend.colors`로 이식.

### 10.2 타이포그래피
- UI 본문: **Noto Sans KR** (300, 400, 500, 700)
- 숫자·시계·산출식: **JetBrains Mono** (400, 500)
- 기본 크기: 13px / line-height 1.6

### 10.3 프로그레스바 (그라디언트)
- 달성률/진행률 표시 시 `--primary-gradient` 사용
- 경고 상태는 `--amber`, 위험은 `--red` 단색

### 10.4 KPI 산출식 박스 (신규)

```css
.formula-box {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.7;
}
.formula-box .hi     { color: var(--primary); font-weight: 500; }
.formula-box .label  { color: var(--text-muted); margin-right: 4px; }
```

렌더링 예 (오늘 생산량):
```
산출식: Σ(삼면포장기 일 생산량) 오늘 00:00 이후
     = 11,240 ea
출처: equipment_metrics (1분 집계)
```

## 11. 알람 규칙 및 처리

### 엔진
- 메트릭 INSERT 트리거 `fn_evaluate_alarms`가 활성 규칙을 순회하며 현재 뷰 값과 비교
- 조건 충족 시 `alarms` INSERT (30분 내 동일 규칙 중복 차단)
- 프론트는 `alarms` Realtime 구독 → 새 레코드 수신 시 Toast + 리스트 갱신
- 수동 알람은 `source='manual'`, `rule_id=null`로 관리자 직접 등록

### 초기 시드 규칙 (예시)
- `defect_rate > 1.0` → warning "불량률 {value}% — 목표 1% 초과"
- `cost_ratio > 10.0` → warning "제조원가 {value}% — 목표 10% 초과"
- `recheck_rate > 1.0` → info "재검율 {value}% — 정상범위 이탈"

### 장비 오프라인
- `devices.last_seen_at < now() - 2min`을 프론트가 매 폴링 시 평가
- 2분 이상 미수신 시 "점검 필요" 배지 + 별도 경고
- 알람 테이블에도 자동 INSERT하려면 별도 Edge Function cron (MVP 범위 외, 프론트 표시만 우선)

## 12. PDF 생성

### Edge Function `/generate-pdf`
- 입력: `{ type: 'lot_summary' | 'claim_response', id: uuid }`
- 처리:
  1. 해당 데이터 조회 (`v_lot_summary` 또는 `claims` + 관련 정보)
  2. pdfmake 템플릿에 주입 (템플릿은 함수 내 하드코딩 또는 Storage의 JSON)
  3. Noto Sans KR TTF를 Storage에서 로드 후 pdfmake `vfs`에 등록
  4. PDF 생성 → Storage `/reports/{type}/{id}.pdf` 업로드
  5. Signed URL 15분 반환

### 템플릿 (LOT 성적서 v1)
- 헤더: 회사 로고, LOT번호, 발행일, 납품처
- 본문: 생산일자, 목표/실적 수량, 검사수량, 불량수, 불량률, 판정
- 차트(이미지): 해당 LOT의 시간대별 불량률 (선택사항, v1 이후)
- 푸터: 품질관리 책임자명, 서명란

## 13. 에러 처리

| 계층 | 상황 | 대응 |
|---|---|---|
| Ingest | 포맷 오류 | 400 + `ingest_logs` 기록, 장비는 다음 주기 재시도로 자연 복구 |
| Ingest | 중복 bucket_at | 200 (멱등), 덮어쓰지 않음 |
| Ingest | DB 장애 | 500, 장비 재시도 허용 |
| Frontend | 쿼리 실패 | react-query 자동 재시도 3회 + Toast "데이터 불러오기 실패" |
| Frontend | 401 | `/login` 리다이렉트 (직전 URL 보존) |
| Frontend | Realtime 끊김 | Supabase 자동 재연결, 끊긴 동안 폴링이 갭 메움 |
| PDF | 폰트 로드 실패 | 500 + Toast "PDF 생성 실패" |
| Alarm 평가 | 트리거 내 예외 | `alarms(severity='info', source='system')`로 기록 |

## 14. 테스트 전략

### 단위 테스트 (Vitest)
- Zod 스키마 케이스 (성공/실패)
- KPI 계산 훅 (MSW 모킹)
- 공통 컴포넌트 (`KpiCard`, `FormulaBox`, `ProgressBar`)

### DB 테스트 (pgTAP 또는 Supabase 로컬 + SQL 스크립트)
- 뷰 결과 검증: 픽스쳐 데이터 삽입 → 기대값 비교
- 트리거 동작: 알람 규칙 임계값 경계 케이스
- RLS 정책: admin/viewer/익명 각각의 SELECT/INSERT/UPDATE/DELETE 시나리오

### E2E (Playwright — 핵심 플로우만)
1. 로그인 → 각 탭 로딩 스모크
2. Admin: LOT 생성 → LOT 이력 탭에 노출 확인
3. 임계값 초과 데이터 주입 → 알람 토스트 확인
4. PDF 출력 → 파일 다운로드 검증
5. 모바일 뷰포트 (iPhone 14, iPad) 레이아웃

### 수동 테스트 체크리스트
- 장비 2분 미수신 시 "점검 필요" 상태 전환
- 네트워크 끊김 재연결 시 누락 데이터 확인
- 분기 경계 (클레임 카운트 리셋)
- 일일 경계 00:00 KPI 리셋

## 15. 배포 및 운영

### 환경
- **Production**: Supabase Cloud + Vercel/Cloudflare Pages
- **Staging**: Supabase 별도 프로젝트
- **Local**: Supabase CLI + Docker (`supabase start`)

### CI/CD
- GitHub Actions
  - PR: 타입체크, ESLint, Vitest, Playwright
  - main push: 프론트 자동 배포, 마이그레이션 자동 적용(`supabase db push`)

### 시크릿
- `SUPABASE_SERVICE_ROLE_KEY` (Edge Function env)
- `INGEST_SHARED_SECRET` (선택적 추가 방어 레이어)
- 장비별 API 키는 DB에 `pgcrypto` bcrypt 해시 저장, 발급 시에만 평문 노출

### 관측성
- Supabase Logs (Edge Function, Postgres)
- `ingest_logs` 테이블 1000건 롤링 보존
- 간단한 상태 페이지는 `/admin/devices`의 `last_seen_at` 표시로 대체

### 데이터 보관
- 영구 보관 (사용자 요청)
- 1년 후 성능 이슈 시 아카이브 테이블 + 일 집계 테이블 도입 (future work)

## 16. 제외 범위 / 향후 과제

- **LLM 연동** (제조원가 개선방안 분석, 클레임 대응 보고서 작성): MVP는 mock
- **외부 MES/ERP 연동**: 담당자 미팅 후 재결정
- **Precision/Recall/F1 자동 산출**: ground truth 수집 체계 마련 후
- **장비 오프라인 감지 Edge Function cron**: 프론트 폴링으로 1차 대응
- **다공장·다라인**: 현재 단일 회사
- **모델 A/B 비교, 재학습 트리거**: MLOps 별도 프로젝트
- **모바일 네이티브 앱**: 반응형 웹으로 커버
- **2FA / SSO**: Supabase Auth 기본 로그인

## 17. 미해결 질문 (구현 착수 전 담당자 협의 필요)

아래 항목은 핵심 설계에는 영향 없으나, 실제 시드 데이터/매핑을 확정하기 위해 현장 담당자와 협의 필요.

1. **공정 단계와 실제 장비의 매핑**
   - 샘플 대시보드 제조원가 탭에 그려진 공정 흐름(초음파 포장 → AI 전수검사 → 불량배출 → 내포장 → 외포장 → 출하)이 실제 장비 6대(삼면포장기/AI비전검사기/자동제함기/자동테이핑기/자동랩핑기/컨베이어)와 1:1 매칭되는가?
   - 특히 "내포장/외포장" 단계를 담당하는 장비는 무엇인가 (자동제함기? 자동랩핑기? 조합?)
   - 확정 시 `devices.process_order`와 `role`을 현실에 맞게 시드

2. **장비 최종 데이터 전송 스펙**
   - 현재 8장 API 계약안은 우리가 제시하는 권장안. 펌웨어/PC 프로그램 담당자와 협의하여 최종 JSON/CSV 포맷·헤더·전송 주기 확정
   - 변경 시 Zod 스키마와 `ingest` Edge Function 조정

3. **LOT 시작·종료 시점 정의**
   - 수동 입력 시, "시작 시각 = 대시보드 입력 시각" vs "시작 시각 = 사용자가 입력한 계획 시각" 중 어느 쪽?
   - LOT 시간 범위로 `v_lot_summary`를 조인하기 때문에 정의 필요

4. **클레임 생성 권한**
   - MVP 스펙은 admin만 클레임 생성. viewer도 허용할지 현장 운영 확인 후 RLS 완화 가능

5. **제조원가 "재공재고" 공정 정의 확정**
   - 샘플은 AI전수검사(680) + 내포장(570)만 재공재고로 카운트. `v_wip_flow`는 연속 공정의 차이를 모두 집계하므로, 실제 재공재고에 포함할 공정만 별도 필터링할지 여부 확정 필요

---

## 변경 이력
- 2026-04-23: 초안 작성
- 2026-04-23: 자체 검토 — `devices.role` 추가, `v_daily_kpi` 하드코딩 제거, 트리거 updated_at 누락, 시드 예시·미해결 질문 보강
