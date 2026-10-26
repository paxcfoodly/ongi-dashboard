# KPI 수정 반영 + 가상 실데이터 시뮬레이터 — 설계

- 작성일: 2026-10-26
- 근거 문서: `성과지표 수정 의견서` (KPI수정.pdf)
- 브랜치: `feat/kpi-revision`

## 1. 의도와 배경

11월 말 사업 종료 시 **평가위원이 성과지표 달성 여부를 대시보드로 확인**한다. 온기코퍼레이션 담당자·실무자도 함께 본다.
사업계획서의 성과지표가 실제 운영에 맞게 수정되었으므로 대시보드의 지표·산정식·목표값을 의견서에 맞춘다.

또한 다음 주 실데이터(장비 → HTTPS `/ingest`) 수신 전에, **가상 실데이터를 실제 장비와 똑같은 경로(HTTPS `/ingest`)로 전송**해 수집 → 집계 → 표시 전 구간이 정상 동작하는지 검증한다.

### 성공 기준
- 평가위원이 KPI 화면 한 장에서 각 성과지표의 **기존값 → 목표치 → 현재 실적 → 달성 여부**를 읽을 수 있다.
- 원가 개선율은 "1 LOT(300kg) 생산 작업공수(man-hour)"로 표시된다.
- 납기 개선율(수주일 → 출하일, 일)이 신규로 표시된다.
- 인력 직무 전환율·만족도가 관리자 수기 입력값으로 표시된다.
- 시뮬레이터를 켜면 실제 장비가 보낸 것처럼 KPI·AI·LOT 화면이 채워진다.

## 2. 성과지표 매핑 (확정)

| 구분 | 지표 | 단위 | 기존 | 목표 | 산정 | 상태 |
|---|---|---|---|---|---|---|
| 공통 | 생산성 개선율 (= 자율 "시간당 생산량") | ea/hr | 1,500 | 1,800 | 오늘 생산수량 ÷ 가동시간 (기존 로직) | 유지 |
| 공통 | 품질 개선율 (불량률) | % | 2.0 | 1.0 | 불량 ÷ 검사 × 100 (기존 로직) | 유지 |
| 공통 | 작업시간 개선율 | sec/ea | 2.4 | 2.0 | 가동시간 ÷ 생산수량 (기존 로직) | 유지 |
| 공통 | **원가 개선율** | man-hour/LOT | 24 | 16 | 투입인원 × (LOT 종료 − 시작) 시간 | **교체** |
| 공통 | **납기 개선율** | 일 | 15 | 12 | 출하일 − 수주일 | **신규** |
| 자율 | 인력 직무 전환율 | % | 0 | 50 | 관리자 수기 입력 (최신값) | **신규** |
| 자율 | 직무 전환 후 만족도 | 점(5점) | 0 | 4.5 | 관리자 수기 입력 (최신값) | **신규** |
| 자율 | 고객 클레임 건수 | 건/분기 | 4 | 1 | 분기 내 클레임 수 (기존 로직) | 유지 |
| 자율 | 환경개선율 | kWh/ea | — | 5% 개선 | — | **대시보드 미표시** (사용자 결정) |

사용자 결정 사항:
1. 투입인원은 관리자가 LOT마다 직접 입력. 작업시간은 LOT 시작~종료 시각으로 계산.
2. 출하 제품이 1종이므로 LOT = 300kg **고정** (중량 입력 없음).
3. 납기 = 수주일 → 출하일.
4. 환경개선율(전력)은 표시하지 않음.
5. 직무 전환율·만족도는 관리자가 주기적으로 수기 입력하고 대시보드에 표시.

## 3. 목표

- G1. 목표값을 DB `targets`에서 읽도록 변경 (현재 `KpiPage.tsx`의 하드코딩 `TARGETS` 제거) — 관리자 "목표값" 메뉴 수정이 화면에 반영되게.
- G2. 각 성과지표에 기존값(baseline)·목표치를 `targets`에 저장하고 KPI 카드에 표시.
- G3. 원가 지표를 재공재고 비율(%) → LOT당 작업공수(man-hour)로 교체.
- G4. 납기(리드타임) 지표 신규.
- G5. 인력 지표(직무 전환율·만족도) 입력 화면 + 표시.
- G6. HTTPS `/ingest`로 가상 장비 데이터를 보내는 시뮬레이터 스크립트.

## 4. 비목표 / 안티골

- 비목표: 환경개선율(kWh) 수집·표시, 다품목·중량 입력, 공정 매핑 재조정(§14 별건), 멀티테넌트(`tenant_id`) 도입 — 이 프로젝트는 단일 회사 전용이며 기존 테이블 모두 `tenant_id` 없이 `is_admin()` RLS 구조. 새 테이블도 기존 구조를 따른다.
- 비목표: 기존 재공재고 뷰(`v_wip_flow`, `v_cost_ratio`, `fn_cost_ratio_7days`)의 DB 삭제. UI·알람에서만 사용 중단(롤백 여지 유지).
- 안티골: 평가 현장에서 **숫자가 0/NaN/빈 카드로 보이는 것**. 데이터가 없을 때는 "데이터 없음"과 그 이유(예: "완료된 LOT 없음")를 명시한다.
- 안티골: 시뮬레이터 데이터가 실데이터와 섞여 평가 수치에 남는 것. 정리 절차를 문서화한다.

## 5. 데이터 모델 변경 (migration — 의도별 1파일, rollback 별도)

### 5.1 `lots` 컬럼 추가
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `worker_count` | `int` (null 허용, `> 0` check) | 투입인원 (관리자 입력) |
| `ordered_at` | `date` (null 허용) | 수주일 |
| `shipped_at` | `date` (null 허용) | 출하일, `shipped_at >= ordered_at` check |

### 5.2 신규 테이블 `hr_kpi_records`
| 컬럼 | 타입 |
|---|---|
| `id` | uuid pk |
| `measured_on` | date not null unique — 측정(조사) 기준일 |
| `job_conversion_rate_pct` | numeric(5,2) null, 0~100 |
| `satisfaction_score` | numeric(3,2) null, 0~5 |
| `note` | text null |
| `created_by`, `created_at`, `updated_at` | 기존 테이블 관례 (updated_at 트리거 적용) |

RLS: 기존 관례 그대로 — `authed read`(select, authenticated), `admin write`(all, `is_admin()`).

### 5.3 뷰
- `v_lot_manhour`: 완료 LOT(`started_at`, `ended_at`, `worker_count` 모두 not null)별 `work_hours = (ended_at − started_at)/3600`, `man_hour = worker_count × work_hours` (소수 2자리).
- `v_kpi_manhour`: 최근 30일(KST) 내 종료된 LOT의 평균 man-hour, LOT 수, 최신 LOT의 man-hour.
- `v_lot_leadtime`: `ordered_at`, `shipped_at` 모두 있는 LOT별 `lead_days = shipped_at − ordered_at`.
- `v_kpi_leadtime`: 최근 30일(KST) 내 출하된 LOT의 평균 리드타임(일), LOT 수.
- 모두 `grant select ... to authenticated`.

### 5.4 `targets` 키 (upsert)
| key | value | unit | 설명 |
|---|---|---|---|
| `hourly_production_baseline` | 1500 | ea/hr | 시간당 생산량 기존 |
| `hourly_production` | 1800 | ea/hr | (기존 키 유지) 목표 |
| `defect_rate_baseline` | 2.0 | % | 불량률 기존 |
| `defect_rate_max` | 1.0 | % | (기존 키 유지) 목표 |
| `work_time_baseline` | 2.4 | s | 작업시간 기존 |
| `work_time_per_ea` | 2.0 | s | (기존 키 유지) 목표 |
| `manhour_baseline` | 24 | man-hour | LOT당 작업공수 기존 |
| `manhour_target` | 16 | man-hour | LOT당 작업공수 목표 |
| `lot_weight_kg` | 300 | kg | 1 LOT 중량 (표시용) |
| `leadtime_baseline` | 15 | 일 | 납기 기존 |
| `leadtime_target` | 12 | 일 | 납기 목표 |
| `job_conversion_baseline` | 0 | % | 직무 전환율 기존 |
| `job_conversion_target` | 50 | % | 직무 전환율 목표 |
| `satisfaction_baseline` | 0 | 점 | 만족도 기존 |
| `satisfaction_target` | 4.5 | 점 | 만족도 목표 |
| `claim_quarterly_baseline` | 4 | 건 | 분기 클레임 기존 |
| `claim_quarterly_max` | 1 | 건 | (기존 키 유지) 목표 |
| `daily_production` | 15000 | ea | (기존 유지) 일 목표 — 성과지표 아님, 운영 참고 |

삭제: `cost_ratio_target`, `cost_ratio_baseline`, `cost_improvement_target`.
알람 규칙 `제조원가 상한 초과`는 `enabled = false`로 비활성화(삭제 아님).

## 6. 화면 변경

### 6.1 실시간 KPI (`/kpi`) — 평가용 성과지표 보드
- 상단 섹션 "공통 성과지표" 5카드: 생산성(시간당 생산량) · 품질(불량률) · 작업시간 · 원가(LOT당 작업공수) · 납기.
- 다음 섹션 "자율 성과지표" 3카드: 직무 전환율 · 직무 전환 후 만족도 · 고객 클레임. (시간당 생산량은 공통과 동일 지표이므로 중복 카드 없이 공통 카드에 "자율지표 공통" 표기)
- 각 카드: 현재값, `기존 X → 목표 Y` 줄, 달성 배지(달성/미달), 산출식 박스(기존 `FormulaBox` 관례 유지 — 산출식·대입값·출처).
- 방향성: 생산성·직무전환율·만족도는 클수록 좋음, 나머지는 작을수록 좋음.
- 데이터 없을 때 카드 값 `—` + 사유 문구.
- 기존 "오늘 생산량 / 목표 달성률" 진행바는 운영 참고로 유지, "제조원가 개선률" 진행바와 "제조원가 비율 추이" 차트는 제거하고 **LOT별 작업공수 추이(최근 완료 LOT 막대 + 목표선 16)** 차트로 교체.
- 설비 상태, 시간대별 생산량, 최근 알람은 유지.
- `KpiPage.tsx`가 현재 324줄 → 카드 8개로 증가. **섹션 컴포넌트로 분리**(`components/kpi/`)해 각 파일 300줄 이하 유지. (전역 규칙상 분리 전 보고 — 본 문서로 보고, 승인 시 진행)

### 6.2 탭 "제조원가" → "원가·납기" (`/cost` 경로 유지)
- 히어로: 최근 30일 평균 LOT당 작업공수, `기존 24 → 목표 16`, 개선률 `(24 − 현재) ÷ 24 × 100`(0~100 클램프) / 목표 개선률 33.3%.
- 산출식: `작업공수(man-hour) = 투입인원 × 작업시간(LOT 시작~종료)`, 1 LOT = 300kg.
- LOT별 작업공수 표: LOT번호, 시작, 종료, 작업시간, 투입인원, man-hour, 목표 대비.
- 납기 섹션: 평균 리드타임, `기존 15 → 목표 12`, LOT별 수주일·출하일·리드타임 표.
- 재공재고 공정흐름·재공 카드 제거.
- "제조원가 개선 방안 분석 요청"(LLM) 버튼 유지, 입력 컨텍스트를 작업공수·리드타임 데이터로 교체(프롬프트 문구도 man-hour 기준).

### 6.3 관리자 — LOT 관리
- LOT 등록/수정 모달에 `투입인원(명)`, `수주일`, `출하일` 필드 추가.
- **시작·종료 시각 수정 필드 추가**(datetime-local). 사유: 작업공수가 시작~종료 시각에 직접 의존하므로, 버튼을 늦게 누른 경우 실제 시각으로 정정할 수 있어야 함.
- 목록 컬럼에 투입인원·man-hour 표시.

### 6.4 관리자 — 신규 탭 "인력 지표" (`/admin/hr-kpi`)
- 측정일·직무 전환율(%)·만족도(점)·메모 입력/수정/삭제 목록. 기존 admin CRUD 페이지(Claim 등) 패턴 재사용.
- KPI 화면은 `measured_on` 최신 행을 표시하고 카드에 "기준일 YYYY-MM-DD" 표기.

### 6.5 LOT 이력 (`/lot`)
- 상세 패널에 투입인원·작업공수·수주일·출하일·리드타임 추가.

### 6.6 관리자 — "수신 원본 데이터" 화면 (`/admin/ingest-logs`) — 2026-10-26 추가 요청
목적: 장비(또는 데이터 제공 업체)가 HTTPS로 보낸 **원본 요청을 그대로 눈으로 확인**하고, 업체가 보유한 데이터와 대조하며, 업체에 전송 형식을 안내한다. 메인 대시보드 탭이 아닌 관리자 메뉴의 별도 화면.
- 현재 결함: `/ingest`는 성공 요청의 원본을 저장하지 않음(`raw_payload = null`). → 모든 요청(성공 포함)의 **원본 바디 문자열 그대로**와 `Content-Type`을 저장하도록 변경. `X-Api-Key`는 **절대 저장하지 않음**.
- `ingest_logs`에 `raw_body text`, `content_type text` 추가(migration). 기존 `raw_payload`(파싱 결과)는 유지.
- 보관 기간: pg_cron으로 **90일** 경과 로그 삭제(1일 1회). 하루 약 8,640행(6대 × 1,440분) 기준 용량 부담 없음.
- 화면 구성
  1. **전송 규격 안내**: 엔드포인트 URL(현재 `VITE_SUPABASE_URL` 기반), 필수 헤더, 장비 유형별 JSON 예시(비전검사기 / 일반 장비), 응답 코드 표 — 각 예시 복사 버튼. 업체에 그대로 전달 가능한 형태.
  2. **수신 로그 표**: 수신 시각(KST, 초 단위), 장비 코드, 상태(success/duplicate/오류 종류 — 색 구분), 원본 바디(고정폭, 한 줄 요약), 오류 메시지. 행 클릭 시 원본 바디 전체(들여쓰기 정렬본 + 원문)와 Content-Type 표시.
  3. 필터: 장비, 상태, 기간(날짜). 최신순, 페이지당 100건. 5초 자동 새로고침 토글.
  4. **CSV 다운로드**: 현재 필터 결과(수신 시각, 장비, 상태, bucket_at, 원본 바디) — 업체 데이터와 대조용.
- 권한: 관리자만(기존 `ingest_logs` "admin read logs" 정책 유지).

## 7. 가상 실데이터 시뮬레이터

### 7.1 장비 데이터 — `scripts/simulate-devices.ts`
- Node 24 네이티브 TS 실행(`node scripts/simulate-devices.ts`), 신규 의존성 없음.
- 실제 장비와 동일하게 `POST {SUPABASE_URL}/functions/v1/ingest`, 헤더 `X-Device-Code`, `X-Api-Key`, JSON 바디(`docs/DEV_NOTES.md §12` 계약).
- 6대 장비 각각 1분 버킷 전송:
  - 삼면포장기(primary_output): `runtime_seconds` 55~60, `output_count` ≈ 28~32/분(≈1,700~1,900 ea/hr).
  - AI 비전검사기: 상류 생산량 기준 `total_inspected`, 불량 0.5~1.2%, unknown 소량, `good = total − defect − unknown` 유지.
  - 하류 4대: 상류보다 약간 적은 출력.
- 모드
  - `--live`: 매 분 현재 KST 버킷으로 전송(종료 시 Ctrl+C).
  - `--backfill <hours>`: 과거 N시간 버킷을 순차 전송(시간대별 차트 채우기). 중복 버킷은 서버가 `duplicate` 응답 → 스킵 처리.
  - `--offline <device_code>`: 특정 장비만 전송 중단 → 오프라인 감지 확인용.
- 설정: `.env.simulator`(gitignore) — `SUPABASE_URL`, `SUPABASE_ANON_KEY`(Functions 게이트웨이 헤더용), 장비별 `SIM_KEY_<code>`. `.env.simulator.example` 커밋.
- API 키는 관리자 화면 "새 API 키 발급"으로 받은 값 사용 — 즉, **장비 등록·키 발급 절차까지 실제와 동일하게 검증**.
- 결과 요약 출력: 장비별 성공/실패/duplicate 건수, 실패 응답 바디.

### 7.2 업무 데이터 (LOT·인력 지표)
- 실제 운영처럼 **관리자 화면에서 입력**해 입력 화면 자체도 검증한다. 시나리오 체크리스트를 `docs/OPERATIONS.md`에 추가(LOT 3건: 투입인원·수주일·출하일·시작/종료 입력, 인력 지표 1건).
- 로컬 개발용으로만 `supabase/mock-seed.sql`에 동일 시나리오 LOT·인력 지표 샘플 추가.

### 7.3 정리(purge)
- 실데이터 수신 전 시뮬레이션 데이터 삭제 SQL을 `docs/OPERATIONS.md`에 문서화(시뮬레이션 시작~종료 시각 범위로 `equipment_metrics`, `vision_inspector_metrics`, 관련 `alarms`, `ingest_logs` 삭제 + 테스트 LOT/인력 지표 삭제). 실행 전 대상 건수 select로 확인하는 절차 포함. Cloud 실행은 사용자가 직접.

## 8. 테스트

- pgTAP: `lots` 신규 컬럼 check 제약, `hr_kpi_records` RLS 4종(select 인증자/쓰기 admin만), `v_lot_manhour`·`v_kpi_manhour`·`v_lot_leadtime`·`v_kpi_leadtime` 계산값, targets 키 존재.
- Vitest: KPI 카드 달성 판정(방향성 포함)·데이터 없음 표시, 개선률 계산 순수 함수, 시뮬레이터 페이로드 생성 함수(합계 제약 `total = good + defect + unknown` 등) 단위 테스트.
- Playwright: `kpi-render.spec.ts` 셀렉터 갱신(카드 라벨 변경) + 원가·납기 탭 렌더 + LOT 모달 신규 필드 + 인력 지표 입력 후 KPI 반영. **UI 변경 PR이므로 e2e 필수**.
- 머지 전 lint + typecheck + build + test(unit/pgTAP/integration/e2e) 통과.

## 9. 빌더 재량

- 카드·차트의 구체적 시각 배치, 색, 문구 다듬기(기존 디자인 토큰·컴포넌트 범위 내).
- 최근 30일 기준 기간은 상수 하나로 둬서 바꾸기 쉽게.
- 시뮬레이터 값 분포의 세부 난수 방식.

## 10. 설계자 판단(사용자 미확인) 목록

1. KPI 실적 기간 = **최근 30일 완료/출하 LOT 평균** (원가·납기).
2. 하드코딩 목표값 → DB `targets` 연동 (기존 결함 수정 겸).
3. LOT 시작·종료 시각 수동 정정 필드 추가.
4. 탭 이름 "제조원가" → "원가·납기".
5. 재공재고 뷰는 DB에 남기고 UI·알람에서만 제외.
6. 시뮬레이터는 실제 `/ingest` HTTPS 경로 사용, LOT·인력 지표는 관리자 화면 입력으로 검증.
7. `KpiPage` 섹션 컴포넌트 분리.
8. 수신 원본 화면은 관리자 전용, 로그 보관 90일, 페이지당 100건, CSV 다운로드 포함.
