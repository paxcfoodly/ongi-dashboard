import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/kpi/);
});

test('KPI page renders 8 performance cards with formulas', async ({ page }) => {
  for (const label of [
    '생산성 (시간당 생산량)',
    '품질 (불량률)',
    '작업시간 / ea',
    '원가 (LOT당 작업공수)',
    '납기 (수주→출하)',
    '인력 직무 전환율',
    '직무 전환 후 만족도',
    '고객 클레임',
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  const formulas = page.getByText(/산출식:/);
  await expect(formulas.first()).toBeVisible();
});

test('tab navigation works', async ({ page }) => {
  await page.getByRole('link', { name: 'AI 성능지표' }).click();
  await expect(page).toHaveURL(/\/ai/);
  await page.getByRole('link', { name: '원가·납기' }).click();
  await expect(page).toHaveURL(/\/cost/);
  await page.getByRole('link', { name: 'LOT 이력' }).click();
  await expect(page).toHaveURL(/\/lot/);
});
