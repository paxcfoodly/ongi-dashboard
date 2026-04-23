# 온기코퍼레이션 생산 모니터링 대시보드

온열팩 제조사 온기코퍼레이션의 생산 라인을 실시간 모니터링하는 내부 대시보드.

**Phase 1 범위:** 기반 구축 — 로그인 / 장비 데이터 수신(`/ingest`) / 빈 대시보드 껍데기.

**Phase 2 범위:** 모니터링 탭 — 4개 탭(실시간 KPI / AI 성능지표 / 제조원가 / LOT 이력)이 실데이터로 동작, 차트 + 산출식 박스 포함.

**Phase 3 범위:** 관리 기능 — admin CRUD 6개 페이지 + 알람 엔진(임계값 초과 시 자동 토스트) + 사용자 초대 Edge Function.

**Phase 4 범위:** PDF 리포트(LOT 성적서), LLM 분석(제조원가·클레임 대응), 장비 오프라인 자동 감지, bcrypt API 키, E2E 테스트, GitHub Actions CI, 배포·운영 문서.

## 기술 스택

- 프론트엔드: Vite + React 18 + TypeScript + Tailwind CSS 3
- 백엔드: Supabase (Postgres + Auth + Edge Functions + Realtime + Storage)
- 테스트: Vitest (프론트·통합), pgTAP (DB)

## 목업 데이터 로드 (실장비 없이 시각 확인)

```bash
supabase db reset              # 마이그레이션 + 시드 재적용
pnpm db:mock                   # 오늘 6시간 분량 mock 메트릭 + 3 LOT
```

이후 `pnpm dev` → 로그인 → 각 탭에서 데이터가 채워진 모습 확인 가능.

## 로컬 개발 시작

### 요구사항
- Node 20+, pnpm 9+
- Docker Desktop
- Supabase CLI 1.200+
- Deno 1.40+ (선택 — Edge Function 로컬 개발 시)

### 실행 절차

```bash
pnpm install
cp .env.example .env.local
# .env.local의 VITE_SUPABASE_ANON_KEY를 supabase status 출력값으로 교체

# 1. Supabase 로컬 기동
supabase start

# 2. 마이그레이션 + 시드 적용
supabase db reset

# 3. TypeScript 타입 재생성
pnpm types:gen

# 4. (선택) Edge Function 기동 — 장비 수신 테스트 시
supabase functions serve ingest --env-file ./supabase/.env.local --no-verify-jwt

# 5. 프론트엔드 dev 서버
pnpm dev
```

Supabase Studio: `http://127.0.0.1:54323` (유저 생성은 여기서)

### 테스트

```bash
pnpm lint
pnpm typecheck
pnpm test                    # 단위 테스트 (Vitest)
supabase test db             # DB 스키마·RLS 테스트 (pgTAP)
pnpm test:integration        # /ingest 통합 테스트 (Supabase + Functions 기동 필요)
```

## 문서

- 설계 스펙: `docs/superpowers/specs/2026-04-23-ongi-dashboard-design.md`
- Phase 1 계획: `docs/superpowers/plans/2026-04-23-phase-1-foundation.md`
- UI 참조: `Ongi_Sample_Dashboard.html`

## 배포

상세 절차는 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) 참고.

## 운영

일일/주간 체크리스트와 알람 튜닝 가이드는 [docs/OPERATIONS.md](docs/OPERATIONS.md) 참고.

## E2E 테스트

```bash
# Supabase + Edge Functions + dev 서버 기동 후
bash scripts/seed-admin.sh
bash scripts/upload-fonts.sh
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)
pnpm test:e2e
```
