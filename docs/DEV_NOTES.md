# 온기코퍼레이션 생산 모니터링 대시보드 — 개발 노트

> 작성일: 2026-04-24 · 상태: Phase 1~3 완료, Phase 4 예정
> 저장 경로: `/Users/seonjecho/Projects/OngiDashboard`
> 주요 문서: `docs/superpowers/specs/2026-04-23-ongi-dashboard-design.md`, `docs/superpowers/plans/`

---

## 1. 프로젝트 개요

- **제품**: 온기코퍼레이션(온열팩 제조사)의 생산 라인을 실시간 모니터링하는 내부 대시보드
- **사용자 규모**: 단일 회사 전용, 동시 접속 1~3명
- **데이터 규모**: 일 생산량 15,000ea, 하루 LOT 5~7개
- **핵심 기능**
  - 4개 모니터링 탭: 실시간 KPI / AI 성능지표 / 제조원가 / LOT 이력
  - 6개 관리 페이지: LOT / 클레임 / 장비 / 알람 규칙 / 목표값 / 사용자
  - 장비 → HTTPS 1분 집계 수신, 임계값 초과 시 알람 자동 생성 + 실시간 토스트
  - 로그인 전용(회원가입 없음), 관리자가 직접 계정 발급

---

## 2. 기술 스택

| 분류 | 선택 | 비고 |
|---|---|---|
| **프론트엔드** | Vite 5 + React 18 + TypeScript 5 | |
| **스타일** | Tailwind CSS 3 (라이트 테마 커스텀 토큰) | Noto Sans KR + JetBrains Mono |
| **상태 관리** | @tanstack/react-query 5 | 30초 폴링 + Realtime 조합 |
| **라우팅** | react-router-dom 7 | 선언적 API만 사용 (v6 호환) |
| **차트** | Chart.js 4 + react-chartjs-2 5 | |
| **폼 검증** | Zod 4 (클라 검증에 선택적 사용) | Edge Function은 Zod 3 (Deno) |
| **Toast** | sonner 2 | |
| **백엔드** | Supabase (Postgres 17 + GoTrue + Realtime + Edge Functions) | |
| **테스트** | Vitest (단위·통합) + pgTAP (DB) | |
| **패키지 매니저** | pnpm 9 | |
| **로컬 개발** | Docker Desktop + Supabase CLI | |

---

## 3. 전체 진행 요약

| Phase | 태그 | 커밋 수 | 완료 상태 |
|---|---|---|---|
| Phase 1: 기반 구축 | `phase-1-complete` | 26 | ✅ |
| Phase 2: 모니터링 탭 | `phase-2-complete` | 15 | ✅ |
| Phase 3: 관리 기능 | `phase-3-complete` | 15 | ✅ (main 머지 대기) |
| Phase 4: 리포트·배포 | 예정 | — | ⏳ |

**총 테스트**: 11 단위(Vitest) + 54 pgTAP + 12 통합 = **77 tests green**

**DB 마이그레이션**: 24개 (13개 pgTAP 테스트 파일로 커버)

---

## 4. 개발 방식 — 스펙 기반 에이전트 실행

### 4.1 워크플로우

```
브레인스토밍 (brainstorming)       → docs/superpowers/specs/*.md
       ↓
계획 수립 (writing-plans)           → docs/superpowers/plans/*.md
       ↓
Subagent-Driven 실행               → 각 태스크마다:
                                       1. 구현 에이전트(이행)
                                       2. 스펙 준수 리뷰 에이전트
                                       3. 코드 품질 리뷰 에이전트
       ↓
검증·태그
```

### 4.2 효과
- 각 Phase마다 한 번의 사용자 의사결정 라운드 후 자율 실행 가능
- 리뷰어가 매 커밋마다 byte-for-byte 스펙 준수를 검증해 scope creep 차단
- 실제 발견된 버그(test file pre-prepare issue, `on conflict do nothing` no-target, KST timezone bug 등)가 즉시 별도 fixup 커밋으로 분리되어 이력 추적 용이

---

## 5. Phase 1: 기반 구축 (Foundation)

**기간**: 2026-04-23 (1일, ~8시간 집중 실행)
**태그**: `phase-1-complete`
**목표**: 로그인 가능한 빈 껍데기 + 전체 DB 스키마 + 장비 수신 Edge Function

### 5.1 DB 스키마 (15 마이그레이션, 9 pgTAP 파일 39 tests)

| 테이블 | 용도 |
|---|---|
| `devices` | 장비 마스터 (6개 seed: 삼면포장기, AI 비전검사기 등) |
| `vision_inspector_metrics` | AI 비전검사기 1분 집계 (total/good/defect/unknown/inspection_time) |
| `equipment_metrics` | 일반 장비 1분 집계 (runtime_seconds, output_count, extras JSONB) |
| `clients` | 납품처 (삼성웰스토리/CJ프레시웨이/PSI) |
| `lots` | LOT 정보 (수기 입력) |
| `claims` | 고객 클레임 (수기 입력) |
| `targets` | 목표값 (key-value, 8개 seed) |
| `alarm_rules` | 알람 규칙 (3개 seed) |
| `alarms` | 발생한 알람 레코드 |
| `profiles` | 사용자 프로필 (auth.users 확장) |
| `ingest_logs` | 장비 수신 로그 (1000건 롤링) |

### 5.2 주요 DB 구성 요소
- `is_admin()` SECURITY DEFINER 함수 (RLS 정책에서 사용)
- `handle_new_user()` 트리거: `auth.users` 생성 시 `profiles` 자동 생성
- `fn_touch_device_last_seen()` 트리거: 메트릭 INSERT마다 `devices.last_seen_at` 갱신
- RLS 정책: `authenticated` read, `admin` write, metrics는 service_role만 INSERT

### 5.3 프론트엔드
- Vite + React + TS 스캐폴드 + ESLint/Prettier/Vitest
- Tailwind 라이트 테마 디자인 토큰 (Phase 2에서 브랜드 컬러 추출 적용)
- `useAuth` 훅 (Supabase Auth 세션 + role)
- React Router: `/login`, `/kpi~/lot` (뷰어), `/admin/*` (admin 전용)
- AuthGate + AdminGate 가드
- 로그인 페이지 (email/password, Supabase Auth 연동)
- 레이아웃: Header (시계 + 연결 상태 + 로그아웃) + TabBar(데스크톱) + MobileNav(햄버거) + Footer

### 5.4 Edge Function: `/ingest`
- 장비 → `POST /functions/v1/ingest` (API 키 헤더 인증)
- JSON/CSV 둘 다 수용
- Zod 스키마 검증 (비전 검사기: total_inspected = good + defect + unknown)
- 중복 bucket_at → 200 OK + `duplicate: true` (멱등 처리)
- 모든 경로 `ingest_logs`에 기록
- 7 통합 테스트 (404/401/400/200/duplicate/CSV/vision+equipment)

### 5.5 Phase 1 결과
- `pnpm dev` → 로그인 → 빈 대시보드 껍데기
- `supabase db reset` → 전체 스키마·시드·RLS 적용 + pgTAP 39 tests
- 장비가 실제 /ingest에 POST 하면 DB row 생성됨

---

## 6. Phase 2: 모니터링 탭 (Dashboards)

**기간**: 2026-04-23 (1일)
**태그**: `phase-2-complete`
**목표**: 4개 탭이 실데이터와 차트로 렌더링

### 6.1 Postgres 뷰 (KPI 계산 로직 DB 캡슐화)

| 뷰 | 산출 내용 |
|---|---|
| `v_daily_kpi` | 오늘 생산량/시간당/작업시간/불량률/분기 클레임 |
| `v_ai_metrics` | 불량 검출율·처리량·재검율 |
| `v_wip_flow` | 공정 간 재공재고 (process_order 기반) |
| `v_cost_ratio` | (재공재고 ÷ 총 생산량) × 100 |
| `v_lot_summary` | LOT별 생산/검사/불량/판정 |

+ RPC: `fn_hourly_production_today()`, `fn_cost_ratio_7days()`

### 6.2 Mock 데이터
- `supabase/mock-seed.sql` + `pnpm db:mock`
- 오늘 KST 08:00~14:00 분당 메트릭 (361 rows × 2 장비) + 3 LOT + 1 클레임
- 실장비 없이 시각 테스트 가능

### 6.3 프론트엔드 산출물
- **공통 UI**: KpiCard / FormulaBox / ProgressBar / Pill / StatusDot / ChartCard / DataTable
- **차트 4종**: HourlyProductionChart / CostTrendChart / AiTrendChart / PrfBarChart
- **8 데이터 훅**: useKpiData / useAiMetrics / useCostRatio(+7Days) / useWipFlow / useLots / useLotDetail / useDeviceStatus / useAlarms
- **4 페이지 완성**:
  - **실시간 KPI**: 6 KPI 카드 + 산출식 박스 + 진행률 바 2개 + 설비 상태 6개 + 차트 2개 + 최근 알람 리스트
  - **AI 성능지표**: 3 AI 카드(불량검출율/처리량/재검율) + AI 트렌드 차트 + PRF 막대 + 모델 기준 설명
  - **제조원가**: Hero 숫자 + 공정 흐름도 + 스탯 4개 + 차트 2개 + AI 분석 요청 버튼(mock)
  - **LOT 이력**: 필터(검색/납품처/판정/날짜) + 테이블 + 상세 패널 + PDF 버튼(mock)

### 6.4 디자인 토큰 (라이트 테마)

```css
--bg:      #F5F8FC   /* 블루그레이 배경 */
--surface: #FFFFFF   /* 카드 */
--primary: #1E64B4   /* 라인블루 (액션/프로그레스) */
--primary-light: #D2E6FA
--good:    #1D9E75   /* 달성/정상 */
--warn:    #E8933A   /* 주의 */
--danger:  #D94444   /* 초과/불합격 */
```

KPI 카드 하단 **산출식 박스** (formula-box 클래스): 연한 블루그레이 배경 + 프라이머리 강조 숫자 (샘플의 cost-formula-box 스타일 이식).

---

## 7. Phase 3: 관리 기능 (Admin + Alarm Engine)

**기간**: 2026-04-24
**태그**: `phase-3-complete`
**목표**: admin CRUD + 임계값 자동 알람 + 실시간 토스트 + 사용자 초대

### 7.1 알람 엔진
- `fn_evaluate_alarms()` 트리거: 메트릭 INSERT 시 활성 규칙을 순회하며 `v_daily_kpi` / `v_ai_metrics` / `v_cost_ratio` 현재값과 비교
- 조건 충족 시 `alarms` 테이블에 INSERT (severity/source='auto')
- **30분 내 동일 rule 중복 방지** (re-fire 억제)
- 예외 발생 시에도 메트릭 INSERT 자체는 실패하지 않도록 exception handler로 격리

### 7.2 Realtime 토스트
- `alarms` 테이블 → `supabase_realtime` publication 등록
- `useAlarmRealtime(onNew)` 훅: `postgres_changes` INSERT 구독 → 콜백 실행 + react-query cache 무효화
- `AlarmToast` 컴포넌트: severity에 따라 toast.error/warn/info 호출
- `AppLayout`에 mount → 인증 사용자가 페이지에 있으면 어디서든 토스트 수신

### 7.3 6개 admin CRUD 페이지

| 페이지 | 기능 |
|---|---|
| `/admin/lots` | LOT 생성·편집·시작/종료·삭제 |
| `/admin/claims` | 클레임 등록·상태 변경(미처리/조사중/완료)·삭제 |
| `/admin/devices` | 장비 CRUD + API 키 1회 노출 모달 + 재발급 |
| `/admin/alarm-rules` | 규칙 CRUD + enable 토글 |
| `/admin/targets` | 목표값 인라인 편집 |
| `/admin/users` | invite-user 호출 + role/active 토글 |

### 7.4 공통 Form 컴포넌트
- `Button` (primary/secondary/danger/ghost)
- `Modal` (ESC + outside click 닫기, aria-modal)
- `ConfirmDialog` (파괴적 작업 2단 확인)
- `FormField` + `TextInput` + `TextArea`
- `Select`
- `toast` (sonner 래퍼: success/error/info/warn)

### 7.5 invite-user Edge Function
- `POST /functions/v1/invite-user` (admin 전용, 호출자 JWT로 `is_admin()` RPC 확인)
- GoTrue Admin API (`admin.auth.admin.createUser`) 경유 → Phase 2에서 발견한 직접 INSERT 이슈 회피
- `role='admin'` 요청 시 `handle_new_user` 트리거가 생성한 viewer 기본값을 admin으로 승격
- 5 통합 테스트 (401/403/200 viewer/200 admin+promote/400 invalid email)

### 7.6 기타
- `fn_set_updated_at()` 트리거 공용화 → 6개 테이블에 `BEFORE UPDATE` 부착
- `alter publication supabase_realtime add table alarms` (idempotent wrap)

---

## 8. 주요 기술 결정

### 8.1 Supabase 로컬 + 동일 스키마를 클라우드로
- 개발: Docker의 로컬 Supabase 스택 (포트 54321 API / 54322 DB / 54323 Studio / 54324 Mailpit)
- 배포: `supabase db push` 로 같은 마이그레이션을 클라우드 프로젝트에 적용 (Phase 4 예정)
- **데이터는 옮기지 않음** — 스키마 정의만 공유

### 8.2 KPI 계산은 DB 뷰에 캡슐화
- 프론트는 `select * from v_daily_kpi` 형태로 단순 조회
- 수식 변경 시 뷰 마이그레이션만 교체 → 앱 재배포 없이도 적용 가능

### 8.3 장비 인증 방식 (Phase 1)
- 장비별 평문 API 키 + DB에 `api_key_hash` 컬럼(Phase 1은 평문 비교)
- Phase 4에서 bcrypt 해시로 전환 예정 (문자열 비교 → constant-time 비교)

### 8.4 알람 중복 억제
- 트리거 내부에서 `rule_id` 기준 30분 윈도우 체크
- 장비가 분당 데이터를 보내도 같은 규칙은 30분에 한 번만 토스트

### 8.5 데이터 훅에서 `as any` 캐스트
- `supabase gen types` 가 뷰를 완전히 타입 추론하지 못해 `sb = supabase as any` 패턴 사용
- 컴포넌트 경계에선 명시적 interface 타입 반환 → 소비자 쪽은 그대로 강타입

### 8.6 프론트엔드 상태 관리
- 서버 상태: react-query 전담 (staleTime 15s, refetchInterval 30s, retry 3)
- 클라이언트 상태: React Context는 `useAuth`만, 그 외는 URL 쿼리/로컬 state
- Realtime은 `alarms` 테이블만 구독 (나머지는 30초 폴링으로 충분)

---

## 9. 교훈 (Lessons Learned)

### 9.1 ⚠️ `auth.users`에 직접 INSERT 금지 (Phase 2에서 발견)

**증상**: 직접 SQL로 admin 계정을 만든 뒤 로그인하면 `"Database error querying schema"` 500 에러.

**원인**: GoTrue Go 코드가 `confirmation_token` 등 여러 text 컬럼의 NULL 값을 처리하지 못함. 직접 INSERT 시 기본값이 NULL이라 GoTrue가 쿼리할 때 터짐.

**해결**: 반드시 세 가지 중 하나를 사용
- Supabase Studio의 Authentication 화면
- **GoTrue Admin API (`POST /auth/v1/admin/users`)** ← invite-user가 이 방식 사용
- 프론트의 `supabase.auth.signUp()`

### 9.2 ⚠️ Postgres 세션 타임존이 UTC일 때 KST 필터 버그 (Phase 3에서 발견)

**증상**: 뷰가 "오늘 KST" 데이터를 반환해야 하는데, 특정 시간대(KST 오전)에 빈 결과를 반환.

**원인**: 뷰 필터가 `bucket_at >= date_trunc('day', now() at time zone 'Asia/Seoul')` 형태였는데,
- 좌변 `bucket_at`: `timestamptz`
- 우변: naive `timestamp` 타입
- Postgres가 암묵적으로 우변을 session timezone(UTC)로 해석해 timestamptz로 변환 → **KST 오늘 09시 이후** 데이터만 필터 통과

**해결**: 헬퍼 함수 `fn_kst_today_start()` 도입 — `(date_trunc('day', now() at time zone 'Asia/Seoul'))::timestamp at time zone 'Asia/Seoul'` 로 명시적 KST → timestamptz 변환. 마이그레이션 `20260424000004_fix_kst_timezone_filter.sql`.

**재발 방지**: 앞으로 timestamp 관련 비교는 명시적 `AT TIME ZONE` 변환 사용.

### 9.3 ⚠️ `on conflict do nothing` 에 target 생략 시 silent duplicate (Phase 2에서 발견)

**증상**: seed 재실행 시 alarm_rules에 중복 row가 쌓임.

**원인**: `insert ... on conflict do nothing` 구문은 UNIQUE 제약이 존재할 때만 작동. `name` 컬럼에 UNIQUE가 없으면 아예 conflict가 나지 않아 그대로 INSERT.

**해결**: `alarm_rules.name` 에 UNIQUE 제약 추가 + seed도 `on conflict (name) do nothing` 로 명시.

### 9.4 ⚠️ Supabase CLI `functions serve` 재로드 이슈 (Phase 3에서 발견)

**증상**: 새 Edge Function 추가 후 config.toml 수정했는데도 routing 안 됨.

**원인**: 기존 `supabase start` 가 시작 시점의 config.toml을 로드하고 runtime을 재시작하지 않음.

**해결**: 새 함수 추가 후 `supabase stop && supabase start` 로 재기동 필요.

### 9.5 플랜 파일의 실제 코드에도 버그가 있을 수 있다

- Phase 2 mock-seed: 두 번의 독립적 `random()` 호출이 `total_inspected = good + defect + unknown` CHECK 위반
  - → `cross join lateral`로 random 값 materialize 1회로 해결
- Phase 1 `04_lots.sql` 테스트: `prepare` 이전에 불량 insert 실행으로 transaction abort
  - → pre-prepare insert 제거로 수정

**시사점**: 자동화 에이전트가 플랜을 byte-for-byte 이행하더라도, 스펙 자체 버그는 실행 시점에만 발견. 정기 리뷰 + 재현 가능한 테스트가 필수.

### 9.6 ⚠️ Vercel Hobby는 Private repo + Collaborator 조합 차단 (Phase 4 배포에서 발견)

**증상**: GitHub push 성공했는데 Vercel이 `"The deployment was blocked because the commit author did not have contributing access to the project on Vercel. The Hobby Plan does not support collaboration for private repositories."` 에러로 차단.

**상황**: 회사 조직 GitHub (`paxcfoodly`) 소유 **Private** 레포 + 개인 GitHub (`koreakinglab`)으로 collaborator 추가 + 커밋 작성자 이메일은 개인 계정(`choseonje@gmail.com`).

**원인**: Vercel Hobby(무료) 플랜 정책.
- Public repo: 협업자가 push 한 커밋도 자유롭게 배포 ✅
- Private repo: 레포 owner 계정과 Vercel 프로젝트 owner 계정이 일치해야만 배포 ❌
- Private + Team: Vercel **Pro** ($20/월/사용자) 필요

**해결 (우리가 택한 경로)**: GitHub 레포를 **Public으로 전환**.
1. git history에 API 키·JWT·Project Ref 같은 민감 정보가 없는지 `git log --all -p | grep -E 'eyJ|sb_secret_|sk-'` 로 검사
2. GitHub Settings → Danger Zone → Change visibility → Public
3. Vercel 재배포 (push 또는 Redeploy 버튼)

**대안**:
- **Cloudflare Pages**: 무료 + Private/Public · 협업자 제한 없음. Vercel UX 거의 동일. 회사 정책상 반드시 Private이어야 하면 이쪽이 깔끔.
- **Vercel Pro**: 팀 멤버 초대로 해결. 유료.

**재발 방지**:
- 초기 레포 생성 시 Public 기본 (회사 관행과도 일치).
- 반드시 Private 필요 시 Cloudflare Pages로 출발.
- 민감 정보는 **코드/문서에 절대 커밋 금지** — `.env.local`, `supabase/.env.local`에만 두고 `.gitignore` 재확인.

---

## 10. 로컬 개발 환경 셋업

### 10.1 전제 조건
- macOS (Apple Silicon 검증)
- Homebrew
- Node 20+, pnpm 9+
- **Docker Desktop** 설치 + 실행 중
- **Supabase CLI** (`brew install supabase/tap/supabase`)

### 10.2 설치

```bash
# 저장소 클론 (로컬에 이미 있음)
cd ~/Projects/OngiDashboard

# 의존성
pnpm install

# 환경변수
cp .env.example .env.local
# .env.local의 VITE_SUPABASE_ANON_KEY를 supabase status 출력값으로 교체

# Supabase 로컬 기동
supabase start

# 마이그레이션 + seed 재적용
supabase db reset

# TypeScript 타입 재생성
pnpm types:gen

# Mock 데이터 (시각 테스트용)
pnpm db:mock
```

### 10.3 개발 서버

```bash
# 프론트엔드
pnpm dev                    # http://localhost:5173

# Edge Functions (admin 기능 테스트 시 필요)
supabase functions serve --env-file ./supabase/.env.local --no-verify-jwt

# Supabase Studio (DB 직접 조회)
# → http://127.0.0.1:54323

# Mailpit (이메일 전송 확인 — 현재 invite-user는 이메일 발송 안 함)
# → http://127.0.0.1:54324
```

### 10.4 테스트 admin 계정 생성 (`db reset` 후 필요)

```bash
SERVICE_KEY=$(supabase status -o env | grep "^SERVICE_ROLE_KEY=" | cut -d'"' -f2)

curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ongi.kr","password":"ongi1234","email_confirm":true,"user_metadata":{"full_name":"관리자"}}'

# admin 권한으로 승격
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "update profiles set role='admin' where id=(select id from auth.users where email='admin@ongi.kr');"
```

→ `admin@ongi.kr` / `ongi1234` 로 로그인.

### 10.5 알람 트리거 수동 테스트

```bash
# 기존 auto 알람 비우고 재발화 시뮬레이션
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -c "delete from alarms; \
insert into vision_inspector_metrics \
(device_id, bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds) \
values ((select id from devices where code='vision_01'), now(), 100, 50, 45, 5, 60);"
```

→ 브라우저 우측 상단에 "알람: 불량률 45.00% — 목표 1.0% 초과" 토스트가 즉시 떠야 정상.

### 10.6 테스트 실행

```bash
pnpm lint
pnpm typecheck
pnpm test                   # 단위 테스트 (11)
supabase test db            # pgTAP DB 테스트 (54)

# 통합 테스트 (Edge Functions 서빙 중이어야 함)
export SUPABASE_ANON_KEY=$(supabase status -o env | grep "^ANON_KEY=" | cut -d'"' -f2)
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep "^SERVICE_ROLE_KEY=" | cut -d'"' -f2)
pnpm test:integration       # 12 (ingest 7 + invite-user 5)
```

---

## 11. 디렉토리 구조 (주요)

```
OngiDashboard/
├── docs/
│   ├── DEV_NOTES.md                                   ← 이 파일
│   └── superpowers/
│       ├── specs/2026-04-23-ongi-dashboard-design.md
│       └── plans/
│           ├── 2026-04-23-phase-1-foundation.md
│           ├── 2026-04-23-phase-2-dashboards.md
│           └── 2026-04-24-phase-3-admin.md
├── src/
│   ├── lib/                  supabase, queryClient, chartDefaults, toast
│   ├── hooks/                useAuth + 15+ data/mutation hooks
│   ├── routes/               AuthGate, AdminGate
│   ├── pages/                LoginPage + 4 viewer pages + 6 admin pages
│   ├── components/
│   │   ├── common/           KpiCard, FormulaBox, Pill, StatusDot, ProgressBar,
│   │   │                     ChartCard, DataTable, Modal, FormField, Button,
│   │   │                     Select, ConfirmDialog
│   │   ├── charts/           HourlyProductionChart, CostTrendChart,
│   │   │                     AiTrendChart, PrfBarChart
│   │   ├── alarm/            AlarmToast
│   │   └── layout/           AppLayout, Header, TabBar, MobileNav,
│   │                         Clock, LiveDot, Footer
│   └── types/
│       └── db.ts             (supabase gen types — auto-generated)
├── supabase/
│   ├── config.toml
│   ├── seed.sql              6 devices + 3 clients + 8 targets + 3 alarm_rules
│   ├── mock-seed.sql         시각 테스트용 메트릭 + LOT + 클레임
│   ├── migrations/           24개 SQL (enums → tables → RLS → views → triggers → TZ fix)
│   ├── functions/
│   │   ├── ingest/           장비 데이터 수신
│   │   └── invite-user/      GoTrue Admin API 기반 사용자 초대
│   └── tests/                13개 pgTAP SQL (54 assertions)
└── tests/
    ├── ingest.test.ts        7 통합 테스트
    └── invite-user.test.ts   5 통합 테스트
```

---

## 12. API 계약

### 12.1 장비 데이터 수신

```
POST https://<project>.supabase.co/functions/v1/ingest
Headers:
  Authorization: Bearer <SUPABASE_ANON_KEY>     (Supabase routing용)
  X-Device-Code: packaging_01                    (장비 식별자)
  X-Api-Key:     <device api_key_hash>          (장비 인증)
  Content-Type:  application/json | text/csv

Body (vision_inspector):
  {
    "bucket_at": "2026-04-24T10:00:00+09:00",
    "metrics": {
      "total_inspected": 100,
      "good_count": 95,
      "defect_count": 3,
      "unknown_count": 2,
      "inspection_time_seconds": 58.4
    }
  }

Body (equipment):
  {
    "bucket_at": "2026-04-24T10:00:00+09:00",
    "metrics": { "runtime_seconds": 58, "output_count": 1850 }
  }

Responses:
  200 OK         { "ok": true, "ingested_at": "..." }
  200 OK         { "ok": true, "duplicate": true }     (멱등)
  400 Bad        스키마/파싱 오류
  401 Unauth     API 키 불일치
  404 Not Found  device_code 미등록 / inactive
  500            내부 오류
```

### 12.2 사용자 초대

```
POST /functions/v1/invite-user
Authorization: Bearer <admin JWT>
Content-Type: application/json

Body:
  {
    "email": "viewer@test.kr",
    "full_name": "홍길동",
    "role": "viewer",                    // or "admin"
    "password": "optional-8-128-chars"   // 미지정 시 사용자 자가 설정
  }

Responses:
  200 { "ok": true, "user_id": "...", "email": "...", "role": "viewer" }
  400 schema invalid
  401 missing auth
  403 caller is not admin
  409 email already exists (GoTrue 422 → 409 변환)
```

---

## 13. 남은 작업 (Phase 4 예정)

### 13.1 기능
- **PDF 리포트 생성**: LOT 품질 성적서, 클레임 대응 보고서
  - Supabase Edge Function + pdfmake + Noto Sans KR 임베드
- **LLM 분석 연동**
  - "제조원가 개선 방안 분석 요청" 버튼 → Claude/OpenAI API
  - "클레임 대응 보고서 자동 작성" → 구조화된 프롬프트 → PDF 발행
- **API 키 bcrypt 해시**화 (Phase 1 평문 비교 → constant-time)
- **장비 오프라인 감지 cron**: last_seen_at 2분 이상 공백 → warning 알람
- **초대 이메일 방식 옵션**: `inviteUserByEmail` API — Mailpit에서 확인 가능

### 13.2 배포
- **Supabase 클라우드 프로젝트 생성** + `supabase db push`
- **GitHub Actions CI**
  - PR: lint / typecheck / unit / build
  - main push: `supabase db push` + 프론트 자동 배포
- **호스팅**: Vercel 또는 Cloudflare Pages (정적 프론트)
- **시크릿 관리**: Supabase Vault 또는 GitHub Actions Secrets
- **환경 변수 분리**: production / staging

### 13.3 품질
- E2E 테스트 (Playwright)
- 모바일 실기기 검증
- 장비 담당자 협의 후 실제 API 계약 확정

---

## 14. 미해결 질문 (담당자 협의 필요)

1. **공정 단계와 실제 장비 매핑** — 샘플의 "초음파 포장 → AI 전수검사 → 내포장 → 외포장 → 출하"가 실제 장비 6대(삼면포장기/AI비전검사기/자동제함기/자동테이핑기/자동랩핑기/컨베이어)와 1:1인지
2. **장비 데이터 전송 최종 스펙** — 현재 Zod 스키마 확정본은 우리가 제시한 권장안. 펌웨어 담당자와 필드·주기·헤더 조율 필요
3. **LOT 시작/종료 시점 정의** — 대시보드 입력 시각 vs 계획 시각 중 `v_lot_summary` 조인 기준
4. **클레임 생성 권한** — MVP는 admin만. viewer도 허용할지 현장 운영 확인
5. **제조원가 "재공재고" 공정 정의** — `v_wip_flow`가 연속 공정 차이를 모두 집계 중. 실제 포함 공정만 필터링할지 재검토

---

## 15. 주요 참고 자료

- **설계 스펙**: `docs/superpowers/specs/2026-04-23-ongi-dashboard-design.md` (15 섹션, 879줄)
- **UI 참조**: `Ongi_Sample_Dashboard.html` (891줄 단일 HTML 목업 — Phase 2 구현의 시각적 기준)
- **Phase별 plan**: `docs/superpowers/plans/` 하위 4개 파일 (총 ~10,000줄)
- **Supabase 문서**: https://supabase.com/docs
- **Chart.js 문서**: https://www.chartjs.org/docs/latest/

---

## 변경 이력

- **2026-04-23**: Phase 1 완료 (`phase-1-complete`)
- **2026-04-23**: Phase 2 완료 (`phase-2-complete`)
- **2026-04-24**: Phase 3 완료 (`phase-3-complete`) + KST 타임존 버그 수정 + DEV_NOTES.md 작성
- **2026-04-24**: Phase 4 완료 (`phase-4-complete`) — PDF, LLM, bcrypt, E2E, CI, 배포 문서
- **2026-04-24**: Supabase Cloud + Vercel 실제 배포 완료. seed 마이그레이션 승격 (`20260424000009_seed_baseline.sql`). 교훈 9.6 추가 (Vercel Hobby Private repo 제약).
