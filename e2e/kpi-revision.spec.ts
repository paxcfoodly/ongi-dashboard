import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/kpi/);
});

test('관리자가 인력 지표를 등록하면 KPI 화면 카드에 값이 표시된다', async ({ page }) => {
  // 같은 측정일 기록이 남아 있으면 unique 위반이므로 사전 정리 (service role 있을 때만)
  const measuredOn = '2099-12-31'; // 최신값으로 선택되도록 미래 날짜 사용
  if (SERVICE_KEY) {
    await fetch(`${SUPABASE_URL}/rest/v1/hr_kpi_records?measured_on=eq.${measuredOn}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
  }

  await page.getByRole('link', { name: '인력 지표' }).click();
  await expect(page).toHaveURL(/\/admin\/hr-kpi/);
  await page.getByRole('button', { name: '+ 신규 기록' }).click();
  await page.getByLabel('측정일 *').fill(measuredOn);
  await page.getByLabel('직무 전환율 (%)').fill('37.5');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('저장됨')).toBeVisible();

  await page.getByRole('link', { name: '실시간 KPI' }).click();
  const card = page.locator('div', { hasText: '인력 직무 전환율' }).filter({ hasText: '37.5' }).first();
  await expect(card).toBeVisible();

  // 정리: 다른 테스트·수동 확인에 영향 없도록 삭제
  if (SERVICE_KEY) {
    await fetch(`${SUPABASE_URL}/rest/v1/hr_kpi_records?measured_on=eq.${measuredOn}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
  }
});

test('LOT 모달에 투입인원 (명) 필드가 있다', async ({ page }) => {
  await page.getByRole('link', { name: 'LOT 관리' }).click();
  await page.getByRole('button', { name: '+ 신규 LOT' }).click();
  await expect(page.getByLabel('투입인원 (명)')).toBeVisible();
  await expect(page.getByLabel('수주일')).toBeVisible();
  await expect(page.getByLabel('출하일')).toBeVisible();
});

test('수신 원본 탭: 전송 규격 안내 + 장비 1회 전송 후 success 행 표시', async ({ page }) => {
  // 환경변수가 없으면 건너뜀 (supabase status -o env 값을 export 해야 실행됨)
  if (!SERVICE_KEY || !ANON_KEY) {
    test.info().skip(true, 'SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY 환경변수가 없어 수신 전송 단계를 건너뜀');
    return;
  }
  const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
  const code = 'packaging_01';
  const plainKey = `e2e-${Math.random().toString(36).slice(2)}-${Date.now()}`; // 테스트용 임시 키 (저장·문서화 금지)

  const devRes = await fetch(`${SUPABASE_URL}/rest/v1/devices?code=eq.${code}&select=id`, { headers: svc });
  const [dev] = (await devRes.json()) as Array<{ id: string }>;
  expect(dev?.id).toBeTruthy();
  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_set_device_api_key`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ p_device_id: dev.id, p_plain_key: plainKey }),
  });
  expect(rpc.ok).toBe(true);

  // 중복 버킷을 피하려고 최근 60일 내 임의 분 단위 시각 사용
  const minuteMs = 60_000;
  const bucket = new Date(Math.floor(Date.now() / minuteMs) * minuteMs - Math.floor(Math.random() * 86_400) * minuteMs);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      'X-Device-Code': code,
      'X-Api-Key': plainKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucket_at: bucket.toISOString(),
      metrics: { runtime_seconds: 58, output_count: 30 },
    }),
  });
  expect(res.status).toBe(200);

  await page.getByRole('link', { name: '수신 원본' }).click();
  await expect(page).toHaveURL(/\/admin\/ingest-logs/);
  await expect(page.getByText('전송 규격 안내')).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: code }).filter({ hasText: 'success' }).first();
  await expect(row).toBeVisible();
});
