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
4. 프로젝트가 Provisioning 완료되면 아래 4개 값을 확보합니다. **실제 값은 문서/레포에 커밋하지 말고 1Password 등 시크릿 저장소에 보관하세요.**

### 4개 값 위치 (2026-04 UI 기준)

| 값 | 위치 | 형태 |
|---|---|---|
| **Project Ref** | 브라우저 URL 바 `/dashboard/project/<ref>`의 `<ref>` 부분<br>또는 **Settings → General → Reference ID** | 영숫자 20자 (`abcdxyz123...`) |
| **Project URL** | **Settings → Data API** → "Project URL" 필드<br>또는 `https://<ref>.supabase.co` 로 조합 | `https://<ref>.supabase.co` |
| **Publishable key** (anon 역할) | **Settings → API Keys → "Publishable and secret API keys" 탭** → Publishable key 표의 `default` 행 → Copy 버튼 | `sb_publishable_...` (약 70자) |
| **Secret key** (service_role 역할) | 같은 화면 Secret keys 표 → `default` 행 → 👁️ 아이콘으로 공개 → Copy | `sb_secret_...` (약 40자) |

### ⚠️ 새 형식 vs 레거시 JWT

2026년부터 Supabase가 기본 키 형식을 바꿨습니다.

- **신규 프로젝트 기본값**: `sb_publishable_...` / `sb_secret_...`
- 기존 JWT 형식은 같은 화면 **"Legacy anon, service_role API keys" 탭**에 남아 있음 (필요 시 기존 시스템 호환용).

이 프로젝트의 프론트엔드(`@supabase/supabase-js` v2)와 Edge Function은 **두 형식 모두 받아들입니다.** 기본 publishable/secret 그대로 써도 되고, 레거시 JWT를 써도 됩니다.

### 🔐 키 용도 정리

- **Publishable key** → 프론트엔드(`VITE_SUPABASE_ANON_KEY`). 브라우저에 노출되지만 RLS가 보호.
- **Secret key** → **Edge Function에서만.** RLS를 전부 우회하므로 프론트엔드/브라우저/GitHub Actions public 변수 등 어디에도 넣지 말 것. Supabase Cloud가 Edge Function에 `SUPABASE_SERVICE_ROLE_KEY` 환경변수로 자동 주입하므로 별도 secrets 설정도 불필요.

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

배포 확인 (GET이라 400 또는 405 나오면 함수가 살아 있음):

```bash
curl -i "https://<PROJECT_REF>.supabase.co/functions/v1/ingest" \
  -H "Authorization: Bearer <PUBLISHABLE_KEY>"
```

> 클라우드 Edge Function URL은 `https://<ref>.supabase.co/functions/v1/<name>` 입니다 (로컬 `127.0.0.1:54321/functions/v1/<name>`과 같은 구조). 일부 옛날 문서에 나오는 `<ref>.functions.supabase.co` 형태는 레거시로, 우리 프로젝트는 위 경로를 기본으로 씁니다.

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

**Supabase Studio**에서:

1. 좌측 **Authentication → Users → Add user → "Create new user"**
2. Email + Password 입력, **"Auto Confirm User"** 체크 (이메일 확인 링크 없이 즉시 활성화)
3. 생성 완료.

이어서 같은 Studio의 **SQL Editor**에서 role을 admin으로 승격:

```sql
update profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'admin@example.com');
```

**주의**: `auth.users`에 직접 `INSERT` 하면 GoTrue가 NULL 컬럼 때문에 로그인 실패합니다. 반드시 위 UI 또는 GoTrue Admin API (`POST /auth/v1/admin/users`) 경유로 계정을 만드세요. 자세한 배경은 [DEV_NOTES.md §9.1](DEV_NOTES.md) 참조.

배포된 프론트엔드(Vercel URL)로 접속해 로그인 → 상단 탭바에 **LOT 관리 / 클레임 / 장비 / 알람 규칙 / 목표값 / 사용자** 6개가 보이면 admin 권한 정상.

## 9. 장비 등록·API 키 발급

배포된 프론트엔드에서:

1. admin 계정으로 로그인 → **`/admin/devices`** 이동.
2. **+ 신규 장비** 버튼 → `code` / `name` / `type` / `role` / `process_order` 입력 → 생성.
3. 생성 직후 표시되는 **API 키 모달**(평문)을 즉시 복사해 장비 측에 전달. 닫으면 다시 볼 수 없습니다.
4. DB에는 `devices.api_key_hash` 컬럼에 bcrypt 해시만 남습니다 (pgcrypto `crypt(plain, gen_salt('bf', 10))`).
5. 키 유실 시 같은 페이지 **"키 재발급"** 버튼 → 새 키 발급 + 기존 키 즉시 무효화 → 장비 재설정 필요.

장비 통합 계약(헤더·스키마·재시도)은 [docs/DEV_NOTES.md §12](DEV_NOTES.md) 참조.

## 10. 프론트엔드 배포 (Vercel)

1. <https://vercel.com>에서 New Project → GitHub 리포 연결.
2. Framework Preset은 Vite 자동 감지.
3. Environment Variables 섹션에 다음 두 개 추가 (**Secret key는 절대 여기 넣지 말 것**):
   - `VITE_SUPABASE_URL` = `https://<PROJECT_REF>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = **Publishable key** (`sb_publishable_...`) 값을 그대로 붙여넣기
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

- [ ] 장비 API 키는 안전 채널(1Password, 암호화 USB 등)로 전달
- [ ] 장비 펌웨어가 아래 3개 헤더를 반드시 포함
  - `Authorization: Bearer <PUBLISHABLE_KEY>` — Supabase 게이트웨이 통과용 (프론트와 동일한 키)
  - `X-Device-Code: <장비 code>` — `/admin/devices`에서 부여한 식별자
  - `X-Api-Key: <발급받은 평문 API 키>` — 장비별 bcrypt 검증용
- [ ] ingest 엔드포인트 (로컬·클라우드 동일 경로 구조):
  - 로컬: `POST http://127.0.0.1:54321/functions/v1/ingest`
  - 클라우드: `POST https://<PROJECT_REF>.supabase.co/functions/v1/ingest`
- [ ] payload 스키마: `supabase/functions/ingest/schemas.ts` (Zod) — 비전검사기 / 일반 장비 두 가지
- [ ] 재시도 정책: 5xx → 지수 백오프, 4xx → 즉시 로그 후 중단 (409/200+duplicate 는 정상 처리로 간주)
- [ ] 시간 동기화: 장비 RTC를 NTP로 동기화 (bucket_at 기준)
- [ ] 테스트 장비와 프로덕션 장비는 별도 key 발급 (공유 금지)
