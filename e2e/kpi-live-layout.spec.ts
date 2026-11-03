import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/kpi/);
}

test('왼쪽 메뉴로 이동하고 관리자 메뉴가 함께 보인다', async ({ page }) => {
  await login(page);
  const link = page.getByRole('link', { name: 'AI 성능지표' });
  await expect(link).toBeVisible();
  const box = await link.boundingBox();
  expect(box!.x).toBeLessThan(200);
  await expect(page.getByRole('link', { name: '수신 원본' })).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/ai/);
});

test('설비 상태는 포장기·비전검사기만 보이고 성과지표가 목표 달성률 위에 있다', async ({ page }) => {
  await login(page);
  const status = page.getByRole('region', { name: '설비별 가동 상태' });
  await expect(status.getByRole('article')).toHaveCount(2);
  await expect(status.getByText('삼면포장기')).toBeVisible();
  await expect(status.getByText('AI 비전검사기')).toBeVisible();
  for (const hidden of ['자동제함기', '자동테이핑기', '자동랩핑기', '컨베이어']) {
    await expect(status.getByText(hidden)).toHaveCount(0);
  }
  await expect(page.getByText(/산출식:/)).toHaveCount(8);
  const kpiBox = await page.getByRole('region', { name: '성과지표' }).boundingBox();
  const goal = page.getByRole('region', { name: '오늘 목표 달성률' });
  await goal.scrollIntoViewIfNeeded();
  const goalBox = await goal.boundingBox();
  const kpiAfterScroll = await page.getByRole('region', { name: '성과지표' }).boundingBox();
  expect(kpiBox).not.toBeNull();
  expect(goalBox!.y).toBeGreaterThan(kpiAfterScroll!.y);
});

test('테마를 전환하면 색이 바뀌고 새로고침 후에도 유지된다', async ({ page }) => {
  await login(page);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const dark = await bg();

  await page.getByRole('button', { name: '밝은 테마' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(bg).not.toBe(dark);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: '어두운 테마' })).toBeVisible();

  await page.getByRole('button', { name: '어두운 테마' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('수신 패킷이 새로고침 없이 화면에 나타나고, 생산 0이면 대기로 바뀐다', async ({ page }) => {
  test.skip(!SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY가 없어 건너뜀');
  // 테스트 데이터를 넣으므로 로컬 Supabase에서만 실행
  expect(new URL(SUPABASE_URL).hostname).toBe('127.0.0.1');
  const admin = createClient(SUPABASE_URL, SERVICE_KEY!);
  const { data: device } = await admin.from('devices').select('id').eq('code', 'packaging_01').single();
  const minute = Math.floor(Date.now() / 60_000) * 60_000;
  const buckets = [new Date(minute - 120_000).toISOString(), new Date(minute - 60_000).toISOString()];
  await admin.from('equipment_metrics').delete().eq('device_id', device!.id).in('bucket_at', buckets);

  try {
    await login(page);
    const panel = page.getByRole('article', { name: '삼면포장기 가동 상태' });
    const feed = page.getByRole('complementary', { name: '실시간 수신 패킷' });

    await admin.from('equipment_metrics').insert({ device_id: device!.id, bucket_at: buckets[0], runtime_seconds: 59, output_count: 37 });
    await expect(feed.getByText('생산 37 ea · 가동 59초')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText('가동중')).toBeVisible();
    await expect(panel.getByText('37 ea')).toBeVisible();
    await expect(feed.getByText('실시간 수신', { exact: true })).toBeVisible();

    await admin.from('equipment_metrics').insert({ device_id: device!.id, bucket_at: buckets[1], runtime_seconds: 0, output_count: 0 });
    await expect(panel.getByText('대기')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText('가동중')).toHaveCount(0);
  } finally {
    await admin.from('equipment_metrics').delete().eq('device_id', device!.id).in('bucket_at', buckets);
  }
});

test('모니터링 제외 장비의 지난 알람은 최근 알람에 보이지 않는다', async ({ page }) => {
  test.skip(!SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY가 없어 건너뜀');
  expect(new URL(SUPABASE_URL).hostname).toBe('127.0.0.1');
  const admin = createClient(SUPABASE_URL, SERVICE_KEY!);
  const { data: hidden } = await admin.from('devices').select('id').eq('code', 'caser_01').single();
  const { data: rows } = await admin
    .from('alarms')
    .insert([
      { severity: 'warning', source: 'system', device_id: hidden!.id, message: 'E2E 숨김 장비 알람', metadata: {} },
      { severity: 'warning', source: 'manual', message: 'E2E 장비 무관 알람', metadata: {} },
    ])
    .select('id');
  try {
    await login(page);
    await expect(page.getByText('E2E 장비 무관 알람').first()).toBeVisible();
    await expect(page.getByText('E2E 숨김 장비 알람')).toHaveCount(0);
  } finally {
    await admin.from('alarms').delete().in('id', (rows ?? []).map((r) => r.id));
  }
});
