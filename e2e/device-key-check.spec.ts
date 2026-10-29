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

test('재발급한 키를 [키 확인]으로 대조하면 일치·불일치·정리 후 일치를 알려 준다', async ({ page }) => {
  await page.goto('/admin/devices');
  const row = page.getByRole('row', { name: /taper_01/ });

  await row.getByRole('button', { name: '키 재발급' }).click();
  await page.getByRole('button', { name: '재발급', exact: true }).click();
  const keyText = (await page.locator('code').filter({ hasText: /^[0-9a-f]{48}$/ }).textContent())!.trim();
  expect(keyText).toHaveLength(48);
  await expect(page.getByRole('button', { name: '키 복사' })).toBeVisible();
  await page.getByRole('button', { name: '확인', exact: true }).click();

  // 목록에 키 앞 4자리가 보인다
  await expect(row).toContainText(`${keyText.slice(0, 4)}…`);

  await row.getByRole('button', { name: '키 확인' }).click();
  const input = page.getByLabel('확인할 API 키');
  const check = page.getByRole('button', { name: '확인', exact: true });

  await input.fill(keyText);
  await check.click();
  await expect(page.getByRole('status')).toContainText('등록된 키와 일치합니다.');

  await input.fill(`Bearer ${keyText}\n`);
  await check.click();
  await expect(page.getByRole('status')).toContainText('불필요한 문자가 섞여 있습니다');

  await input.fill('0000' + keyText.slice(4));
  await check.click();
  await expect(page.getByRole('status')).toContainText('등록된 키와 다릅니다.');
  await expect(page.getByRole('status')).toContainText(`'${keyText.slice(0, 4)}'`);
});
