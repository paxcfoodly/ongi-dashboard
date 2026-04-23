import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';

test('login → redirects to /kpi', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/kpi/);
  await expect(page.getByText('실시간 KPI', { exact: false })).toBeVisible();
});

test('wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill('wrongpass');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByText(/Invalid/i)).toBeVisible();
});
