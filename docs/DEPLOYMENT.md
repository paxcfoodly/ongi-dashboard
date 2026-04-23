# 배포 가이드

Ongi Dashboard를 로컬 개발 환경에서 Supabase Cloud + Vercel 프로덕션으로 배포하기 위한 상세 절차입니다.

## 1. 개요

로컬 → 클라우드 파이프라인은 다음 순서로 구성됩니다.

1. Supabase Cloud 프로젝트 생성 (데이터베이스 + Auth + Storage + Edge Functions)
2. 로컬 레포와 클라우드 프로젝트 연결
3. 마이그레이션 적용 (`supabase db push`)
4. Edge Function 배포 (`supabase functions deploy ...`)
5. 시크릿 설정 (`supabase secrets set ...`)
6. Storage 버킷 생성 + 폰트 업로드 (PDF 생성용)
7. 초기 admin 계정 생성
8. 장비 등록·API 키 발급
9. 프론트엔드 배포 (Vercel)
10. 도메인/DNS 연결 (선택)

소요 시간: 약 30~45분 (클라우드 프로젝트가 이미 생성되어 있는 경우 15분 내외).

## 2. Supabase Cloud 프로젝트 생성

1. <https://supabase.com/dashboard>에서 새 프로젝트를 생성합니다.
2. 리전은 `ap-northeast-2` (Seoul) 권장.
3. Database password는 안전한 곳에 보관합니다 (롤백/수동 백업 시 필요).
4. 프로젝트가 Provisioning 완료되면 Settings → API에서 다음 값을 확보합니다.
   - Project Ref (예: `abcdxyz123`)
   - Project URL (예: `https://abcdxyz123.supabase.co`)
   - anon public key
   - service_role key (노출 금지)

## 3. 로컬 레포 → 클라우드 연결

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```

`supabase link` 실행 시 DB password를 묻습니다 (2단계에서 저장한 값).

연결 확인:

```bash
supabase projects list
supabase db remote commit --help    # 접근 확인용
```

## 4. 마이그레이션 적용

```bash
supabase db push
```

28개 마이그레이션이 순차 적용됩니다. 실패 시 메시지를 확인하고, 로컬에서 `supabase db reset`으로 재검증한 뒤 재시도합니다.

수동 검증 쿼리:

```bash
supabase db remote psql <<'SQL'
select count(*) from pg_tables where schemaname='public';
select count(*) from pg_proc where proname like 'api_%';
SQL
```

## 5. Edge Function 배포

```bash
supabase functions deploy ingest
supabase functions deploy invite-user
supabase functions deploy generate-pdf
supabase functions deploy llm-analyze
```

각 함수는 `supabase/functions/<name>/index.ts`를 번들링하여 배포합니다.

배포 확인:

```bash
curl -i "https://<PROJECT_REF>.functions.supabase.co/ingest" \
  -H "Authorization: Bearer <ANON_KEY>"
# 401/400 응답이면 정상 연결 (POST payload 없음이라 실패)
```

## 6. 비밀(Secrets) 설정

LLM 분석에 쓰이는 Anthropic API 키를 Edge Function 환경 변수로 주입합니다.

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets list
```

다른 선택적 비밀:

```bash
supabase secrets set LLM_DAILY_BUDGET_USD=5        # 일일 한도
supabase secrets set PDF_FONT_BUCKET=system-assets # 기본값과 동일
```

## 7. Storage 버킷 + 폰트 업로드

PDF 리포트는 Noto Sans KR 폰트를 Storage에서 로드합니다. 클라우드에서 한 번만 업로드하면 됩니다.

### 버킷 생성

Studio → Storage → New bucket → `system-assets` (private) 생성.

### 폰트 업로드

로컬에서 Noto Sans KR 폰트 파일을 `supabase/assets/fonts/`에 두고 아래 스크립트 변형본을 실행합니다 (로컬 스크립트는 `http://127.0.0.1:54321` 하드코딩 — 클라우드용은 환경변수 버전 사용).

```bash
export SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"

for f in NotoSansKR-Regular.ttf NotoSansKR-Bold.ttf; do
  curl -X POST \
    "$SUPABASE_URL/storage/v1/object/system-assets/fonts/$f" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@supabase/assets/fonts/$f"
done
```

업로드 확인은 Studio → Storage → system-assets → `fonts/`에 두 파일이 보이면 OK.

## 8. 초기 admin 계정 생성

Studio → Authentication → Users → Add user (Email + Password, "Auto-confirm" 체크).

이어서 SQL Editor에서 role을 admin으로 승격:

```sql
update profiles
  set role = 'admin'
  where id = (select id from auth.users where email = 'admin@example.com');
```

Logout/login 이후 `/admin` 화면이 노출되면 정상.

## 9. 장비 등록·API 키 발급

1. Studio → Authentication → `/admin` 접속 (웹 앱).
2. "장비 등록" → 코드/이름/유형 입력 → 저장.
3. "API 키 발급" 버튼 → 발급된 평문 키는 단 한 번 표시되므로 즉시 복사해 장비 측에 전달.
4. DB에는 bcrypt 해시만 저장됩니다 (`api_keys.key_hash`).

장비 쪽 통합은 [docs/OPERATIONS.md](OPERATIONS.md)와 `supabase/functions/ingest/README.md`의 계약 스키마 참고.

## 10. 프론트엔드 배포 (Vercel)

1. <https://vercel.com>에서 New Project → GitHub 리포 연결.
2. Framework Preset은 Vite 자동 감지.
3. Environment Variables 섹션에 다음 두 개 추가:
   - `VITE_SUPABASE_URL` = `https://<PROJECT_REF>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<anon key>`
4. Build settings (자동 감지되지만 확인):
   - Build command: `pnpm build`
   - Output directory: `dist`
   - Install command: `pnpm install --frozen-lockfile`
5. Deploy 버튼 → 2~3분 후 프리뷰 URL 제공.

로그인 후 `/kpi`가 정상 렌더되면 배포 완료.

## 11. DNS/도메인 (선택)

Vercel Settings → Domains → 커스텀 도메인 추가.

Supabase Auth redirect URL도 업데이트 필요:

- Studio → Authentication → URL Configuration → Site URL / Redirect URLs에 프로덕션 도메인 추가.

## 12. 롤백 전략

주의: **절대** `supabase db reset --linked`를 쓰지 않습니다. 클라우드 DB를 전부 초기화합니다.

롤백 절차:

1. 문제 커밋 식별 (`git log`).
2. `git revert <sha>` → 새 커밋 생성 → 푸시.
3. Vercel은 자동 재배포.
4. 스키마 변경이 포함된 경우, **다운 마이그레이션**을 새 마이그레이션으로 작성하여 `supabase db push`.
5. 데이터 손상 시에는 자동 백업에서 point-in-time 복원 (Supabase Pro 이상).

Hotfix가 필요한 경우:

```bash
git checkout -b hotfix/<issue>
# 수정
git commit -m "fix: <issue>"
git push
# PR merge 후 Vercel 자동 배포
```

## 13. 장비 쪽 통합 체크리스트

- [ ] API 키는 안전 채널(예: 1Password, 암호화 USB)로 전달
- [ ] 장비 펌웨어에 `Authorization: Bearer <API_KEY>` 헤더 주입
- [ ] ingest 엔드포인트: `POST https://<PROJECT_REF>.functions.supabase.co/ingest`
- [ ] payload 스키마: `supabase/functions/ingest/schema.ts` (Zod)
- [ ] 재시도 정책: 5xx → 지수 백오프, 4xx → 즉시 로그 후 중단
- [ ] 시간 동기화: 장비 RTC는 NTP 동기화 (bucket_at 기준)
- [ ] 테스트 키와 프로덕션 키 분리 발급
