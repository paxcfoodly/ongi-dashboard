import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/kpi/);
});

test('기간 선택이 KPI·AI·원가 탭 사이에서 유지되고 오늘로 복귀한다', async ({ page }) => {
  await page.getByRole('button', { name: '최근 7일' }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=/);
  const from = new URL(page.url()).searchParams.get('from') as string;

  await expect(page.getByText('날짜별 KPI')).toBeVisible();
  await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(7);
  await expect(page.getByText('기간 합계·평균')).toBeVisible();
  await expect(page.getByText('설비별 가동 상태')).toHaveCount(0);

  await page.getByRole('link', { name: 'AI 성능지표' }).click();
  await expect(page).toHaveURL(new RegExp(`from=${from}`));
  await expect(page.getByText('날짜별 AI 성능')).toBeVisible();

  await page.getByRole('link', { name: '원가·납기' }).click();
  await expect(page).toHaveURL(new RegExp(`from=${from}`));
  await expect(page.getByText('LOT당 작업공수 (선택 기간 평균)')).toBeVisible();

  await page.getByRole('link', { name: '실시간 KPI' }).click();
  await page.getByRole('button', { name: '오늘' }).click();
  await expect(page).not.toHaveURL(/from=/);
  await expect(page.getByText('설비별 가동 상태')).toBeVisible();
});

test('과거 하루 조회 시 시드 데이터의 합계와 생산성이 표시된다', async ({ page }) => {
  test.skip(!SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 없어 데이터 시드를 건너뜀');
  // 안전장치: 로컬 Supabase 외에는 절대 쓰지 않음
  expect(SUPABASE_URL).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):/);

  const headers = {
    apikey: SERVICE_KEY as string,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  const devRes = await fetch(
    `${SUPABASE_URL}/rest/v1/devices?role=eq.primary_output&active=eq.true&select=id&limit=1`,
    { headers },
  );
  const devices = (await devRes.json()) as { id: string }[];
  expect(devices.length).toBeGreaterThan(0);
  const deviceId = devices[0].id;

  try {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/equipment_metrics`, {
      method: 'POST',
      headers,
      body: JSON.stringify([
        { device_id: deviceId, bucket_at: '2026-01-05T10:00:00+09:00', runtime_seconds: 58, output_count: 28 },
        { device_id: deviceId, bucket_at: '2026-01-05T10:01:00+09:00', runtime_seconds: 54, output_count: 30 },
      ]),
    });
    expect(ins.ok, await ins.clone().text()).toBeTruthy();

    await page.goto('/kpi?from=2026-01-05&to=2026-01-05');
    await expect(page.getByText('1,864').first()).toBeVisible();
    await expect(page.getByText('합계 58')).toBeVisible();
  } finally {
    await fetch(
      `${SUPABASE_URL}/rest/v1/equipment_metrics?bucket_at=gte.2026-01-05T00:00:00%2B09:00&bucket_at=lt.2026-01-06T00:00:00%2B09:00&device_id=eq.${deviceId}`,
      { method: 'DELETE', headers },
    );
  }
});
