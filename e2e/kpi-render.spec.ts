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

test('KPI page renders 6 cards with formulas', async ({ page }) => {
  await expect(page.getByText('오늘 생산량')).toBeVisible();
  await expect(page.getByText('시간당 생산량')).toBeVisible();
  await expect(page.getByText('불량률')).toBeVisible();
  await expect(page.getByText('제조원가 비율')).toBeVisible();
  await expect(page.getByText('고객 클레임')).toBeVisible();
  const formulas = page.getByText(/산출식:/);
  await expect(formulas.first()).toBeVisible();
});

test('tab navigation works', async ({ page }) => {
  await page.getByRole('link', { name: 'AI 성능지표' }).click();
  await expect(page).toHaveURL(/\/ai/);
  await page.getByRole('link', { name: '제조원가' }).click();
  await expect(page).toHaveURL(/\/cost/);
  await page.getByRole('link', { name: 'LOT 이력' }).click();
  await expect(page).toHaveURL(/\/lot/);
});
