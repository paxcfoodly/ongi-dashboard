# 운영 가이드

Ongi Dashboard를 일상적으로 운영·관리하기 위한 체크리스트와 가이드입니다.

## 1. 일일 체크리스트 (admin)

매일 아침 업무 시작 시 다음을 확인합니다.

- [ ] `/kpi` KPI 카드 6개 모두 정상 수치 (N/A가 없어야 함)
- [ ] `/admin` → 장비 상태에 `offline`이 24시간 이상 방치된 장비 없음
- [ ] `/alarms` 미확인 알람 5건 이하
- [ ] `/lot` 최근 24시간 LOT 10건 이상 생성됨
- [ ] `/cost` 제조원가 비율이 목표 범위 내
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

- `ingest_logs`: 1000건 rolling (트리거로 초과 시 삭제). 감사용이 필요하면 월 1회 `ingest_logs_archive` 테이블로 export.
- `alarm_events`: 90일 보관 후 pg_cron이 삭제.
- Edge Function 로그 (Supabase): 7일 (Pro), 유료 플랜 업그레이드 시 연장 가능.
- Auth audit log: Supabase 기본 보관 (90일).

장기 보관이 필요한 감사 이벤트는 별도 archive 테이블로 옮긴 뒤 S3로 내보내는 월간 job을 구성합니다.
