# 운영 가이드

Ongi Dashboard를 일상적으로 운영·관리하기 위한 체크리스트와 가이드입니다.

## 1. 일일 체크리스트 (admin)

매일 아침 업무 시작 시 다음을 확인합니다.

- [ ] `/kpi` 성과지표 카드 8개 모두 정상 수치 (입력 대기 카드는 사유 문구 표시)
- [ ] `/admin` → 장비 상태에 `offline`이 24시간 이상 방치된 장비 없음
- [ ] `/alarms` 미확인 알람 5건 이하
- [ ] `/lot` 최근 24시간 LOT 10건 이상 생성됨
- [ ] `/cost` (원가·납기) 작업공수·납기 리드타임이 목표 범위 내
- [ ] `/claims` open 상태 클레임 2일 이상 방치 없음

이상 항목은 즉시 [대응 프로세스](#2-장비-오프라인-대응)로 이행.

## 2. 장비 오프라인 대응

pg_cron이 1분마다 `detect_offline_devices()`를 실행하여 5분 이상 ingest가 없는 장비를 자동으로 `offline`으로 표시하고 알람을 생성합니다.

대응 절차:

1. `/admin` → 장비 리스트에서 `offline` 필터.
2. 현장 담당자에게 연락 (전원/네트워크/센서 물리 점검).
3. 장비 재시작 후 `ingest_logs`에 새 row 확인.
4. 상태가 `online`으로 자동 복구되지 않으면 API 키 만료 여부 확인 (아래 섹션 3).

## 3. API 키 로테이션

권장 주기: **분기 1회** 또는 키 유출 의심 시 즉시.

1. `/admin` → 대상 장비 선택 → "새 API 키 발급".
2. 장비 측에 새 키 적용 후 ingest 성공 확인.
3. `/admin` → 기존 키 "Revoke" 버튼.
4. 구 키로 호출 시 401이 나오면 정상.

DB에는 bcrypt 해시만 저장되므로 **발급 시점에만** 평문을 볼 수 있습니다.

## 4. 클레임 처리 플로우

1. `/claims`에서 open 클레임 열기.
2. "LOT 추적" 탭에서 원인 LOT ID 확인.
3. "LLM 분석" 탭에서 원인 가설 + 응답 초안 생성 (llm-analyze Edge Function 호출).
4. 응답 초안을 고객 채널(이메일/전화)로 송부.
5. 상태를 `acknowledged` → `resolved`로 단계 이동.
6. 동일 패턴이 반복되면 알람 임계값 튜닝 검토 (섹션 6).

## 5. 백업

### 자동 백업

Supabase Pro 이상은 매일 자동 백업 + 7일 보관. Settings → Database → Backups에서 확인 가능.

### 월 1회 수동 pg_dump

재해복구용 cold-storage 스냅샷:

```bash
# 환경변수 설정
export PGPASSWORD='<DB_PASSWORD>'

pg_dump \
  -h db.<PROJECT_REF>.supabase.co \
  -U postgres \
  -p 5432 \
  --no-owner --no-privileges \
  --format=custom \
  --file="ongi_$(date +%Y%m).dump" \
  postgres
```

생성된 파일은 암호화된 외부 스토리지 (예: S3 + KMS)에 보관.

복원 테스트는 분기 1회 staging에 수행 권장.

## 6. 알람 규칙 튜닝 가이드

`alarm_rules` 테이블은 지표별 임계값을 보관합니다. 기본값은 현장 데이터에 맞춰 주기적으로 재튜닝.

| 지표 | 초기 임계값 | 튜닝 힌트 |
| --- | --- | --- |
| 불량률 (%) | 5 | 30일 p95의 1.2배로 재설정 |
| 시간당 생산량 하한 | 목표의 70% | 교대 평균이 떨어지면 상향 |
| 제조원가 비율 (%) | 85 | 원자재 변동 시 재계산 |
| 장비 오프라인 (분) | 5 | 현장 통신 품질 따라 5~10 |
| AI 신뢰도 하한 (%) | 85 | 모델 업데이트 후 재설정 |

튜닝 방법:

1. `/alarms` → "최근 30일 알람 리포트" 내보내기.
2. 오탐/누락 비율 확인 (오탐 > 30%면 완화, 누락 > 10%면 강화).
3. Studio SQL Editor에서 `update alarm_rules set threshold = ... where metric = ...`.
4. 변경 이력은 `alarm_rule_audit` 테이블에 자동 기록.

## 7. LLM 비용 관리

- Anthropic Console: <https://console.anthropic.com/settings/usage>에서 일/월별 사용량 확인.
- `supabase secrets set LLM_DAILY_BUDGET_USD=5`로 일일 한도 설정 (초과 시 llm-analyze가 fallback mock 응답).
- 평균 요청당 토큰: 입력 2k + 출력 1k ≈ Claude 4.7 Sonnet 기준 $0.02.
- `max_tokens`를 낮추고 싶으면 `supabase/functions/llm-analyze/index.ts`에서 상수 조정 후 재배포.
- Monthly budget alert는 Anthropic Console → Billing → Usage alerts에서 50% / 80% / 100% 임계값 설정.

## 8. 성능 모니터링

Supabase Logs → Edge Functions 대시보드에서 다음을 주기 관찰:

- `ingest` p95 latency: 200ms 이하
- `generate-pdf` p95 latency: 3s 이하 (폰트 캐시 포함)
- `llm-analyze` p95 latency: 8s 이하
- 5xx rate: 1% 미만

임계값 초과가 지속되면:

1. `pg_stat_statements`로 느린 쿼리 식별.
2. 인덱스 추가/수정 마이그레이션 작성.
3. Edge Function 로그에서 콜드 스타트 빈도 확인.

## 9. 로그 보존 기간

- `ingest_logs`: 90일 보관. pg_cron 잡 `ingest-logs-purge`가 매일 KST 03:00(UTC 18:00)에 `fn_purge_ingest_logs()`로 90일 초과 로그를 삭제. 감사용이 필요하면 월 1회 `ingest_logs_archive` 테이블로 export.
- `alarm_events`: 90일 보관 후 pg_cron이 삭제.
- Edge Function 로그 (Supabase): 7일 (Pro), 유료 플랜 업그레이드 시 연장 가능.
- Auth audit log: Supabase 기본 보관 (90일).

장기 보관이 필요한 감사 이벤트는 별도 archive 테이블로 옮긴 뒤 S3로 내보내는 월간 job을 구성합니다.

## 10. 가상 실데이터 점검 (시뮬레이터)

실장비 연결 전·후에 화면과 수신 경로를 점검하는 절차입니다. 시뮬레이터는 실제 장비와 같은 경로(`POST /functions/v1/ingest`)로 6대 장비의 분 단위 데이터를 보냅니다.

> API 키는 **절대 문서·채팅·커밋에 붙여넣지 않습니다.** `.env.simulator`(gitignore 대상)에만 둡니다.

1. **키 발급**: `/admin/devices`에서 시뮬레이션 대상 장비 6대(packaging_01, vision_01, caser_01, taper_01, wrapper_01, conveyor_01) 각각 "새 API 키 발급". 평문은 발급 시점에만 보입니다.
2. **환경 파일**: `cp .env.simulator.example .env.simulator` 후 대상 URL, 공개(anon) 키, 장비별 키를 채웁니다.
   - 시뮬레이터는 `SUPABASE_URL`이 로컬(`localhost`/`127.0.0.1`)이 아니면 **실행을 거부**합니다. 가짜 데이터가 실제 KPI(생산량·불량률 등)에 섞이기 때문입니다. 원격 시연용 DB처럼 의도한 경우에만 `--allow-remote`를 붙입니다 (예: `pnpm sim --live --allow-remote`).
3. **과거 데이터 채우기**: `pnpm sim --backfill 8` (최근 8시간 분 단위 버킷 전송).
4. **실시간 전송**: `pnpm sim --live` (매 분 전송, Ctrl+C로 종료). 특정 장비 중단 시험은 `--offline <장비코드>`를 덧붙입니다.
5. **화면 체크리스트**
   - [ ] `/kpi` 생산성·품질·작업시간/ea 카드에 값 표시, 산출식 박스 확인
   - [ ] `/ai` 차트에 시간대별 데이터 표시
   - [ ] `/cost` (원가·납기) 탭 정상 표시
   - [ ] 관리자 `수신 원본`: 장비별 `success` 행, 행 클릭 시 원본 바디(JSON) 확인, 상단 `전송 규격 안내` 표시
   - [ ] 중복 전송(duplicate)·키 오류(401) 시 시뮬레이터가 중단되지 않고 다음 버킷 진행
   - [ ] `--offline` 장비는 일정 시간 후 offline 알람 발생
6. **업무 데이터 입력 시나리오** (관리자 화면)
   - LOT 3건 입력: 투입인원 3 / 4 / 3명, 수주일·출하일, 시작·종료 시각 → `/kpi` 원가(LOT당 작업공수)·납기 카드 값 확인
   - `/admin/hr-kpi`에서 인력 지표 1건 등록 → `/kpi`의 직무 전환율·만족도 카드 확인
   - 종료 시각을 시작보다 앞으로, 출하일을 수주일보다 앞으로 입력 → 저장 실패 토스트 확인

## 11. 시뮬레이션 데이터 정리

점검이 끝나면 시뮬레이션이 만든 데이터를 지웁니다. **Cloud(운영) DB에서는 운영 담당자가 직접 실행**하며, 이 문서의 SQL은 참고용입니다. 로컬 DB 외에는 자동 실행하지 않습니다.

> **주의**: 아래 삭제는 **시간 범위 기준**이라, 그 기간에 들어온 **실장비 데이터·실제 알람도 함께 삭제**됩니다. 실장비가 이미 연결된 환경이면 기간을 최소로 잡거나 `device_code`/`device_id` 조건을 추가하세요.

1. 시뮬레이션 기간을 정합니다 (KST, 아래는 예시).
   - **시작 = 시뮬레이터 실행 시각 − backfill 시간.** 예: 10:00에 `--backfill 8`로 실행했다면 시작은 02:00 입니다 (backfill 버킷은 과거 시각으로 저장됨).
   - **끝 = 마지막 전송(`--live` 종료) 이후 시각.**

```sql
-- psql 변수로 기간 지정 (예시 값은 실제 시뮬레이션 기간으로 교체)
\set start '2026-10-26 02:00:00+09'
\set end   '2026-10-27 00:00:00+09'
```

   Supabase SQL Editor는 psql 메타 명령(`\set`)과 `:'start'` 치환을 지원하지 않습니다. SQL Editor에서는 아래 2·3단계의 `:'start'`/`:'end'`를 **리터럴 시각으로 바꿔** 실행합니다. 예:

```sql
-- SQL Editor용 (리터럴 시각)
select count(*) from equipment_metrics
 where bucket_at between '2026-10-26 02:00:00+09' and '2026-10-27 00:00:00+09';
```

2. **먼저 건수만 확인**합니다. 예상 범위와 다르면 중단합니다.

```sql
select 'equipment_metrics' t, count(*) from equipment_metrics where bucket_at between :'start' and :'end'
union all select 'vision_inspector_metrics', count(*) from vision_inspector_metrics where bucket_at between :'start' and :'end'
union all select 'alarms', count(*) from alarms where created_at between :'start' and :'end'
union all select 'ingest_logs', count(*) from ingest_logs where received_at between :'start' and :'end';
```

3. 건수가 맞으면 삭제합니다 (트랜잭션 권장).

```sql
begin;
delete from equipment_metrics         where bucket_at  between :'start' and :'end';
delete from vision_inspector_metrics  where bucket_at  between :'start' and :'end';
delete from alarms                    where created_at between :'start' and :'end';
delete from ingest_logs               where received_at between :'start' and :'end';
commit;
```

4. 삭제 후 장비 상태가 시뮬레이션 시각 기준으로 남아 있으면 `devices.last_seen_at`을 되돌립니다 (오프라인 감지·장비 상태 표시가 이 값을 사용). 남은 실데이터의 최신 버킷으로 맞추거나, 실데이터가 없으면 `null`로 둡니다.

```sql
update devices d set last_seen_at = (
  select max(t.bucket_at) from (
    select bucket_at from equipment_metrics        where device_id = d.id
    union all
    select bucket_at from vision_inspector_metrics where device_id = d.id
  ) t
);
```

5. 테스트로 입력한 LOT·인력 지표 기록은 `/admin/lots`, `/admin/hr-kpi`에서 직접 삭제합니다 (실데이터와 구분되는 LOT 번호·측정일로 입력할 것).
6. 시뮬레이터용으로 발급한 장비 API 키는 폐기(Revoke)하거나 실장비 연결 시 재발급합니다.
