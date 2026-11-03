import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test('납품처를 직접 입력해 LOT을 만들면 등록되고 띄어쓰기가 달라도 중복되지 않는다', async ({ page }) => {
  test.skip(!SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY가 없어 건너뜀');
  // 테스트 데이터를 넣으므로 로컬 Supabase에서만 실행
  expect(new URL(SUPABASE_URL).hostname).toBe('127.0.0.1');
  const admin = createClient(SUPABASE_URL, SERVICE_KEY!);
  const tag = Date.now();
  const clientName = `E2E납품처${tag}`;
  const lots = [`E2E-${tag}-1`, `E2E-${tag}-2`];

  const createLot = async (lotNo: string, client: string) => {
    await page.getByRole('button', { name: '+ 신규 LOT' }).click();
    await page.getByLabel('LOT번호 *').fill(lotNo);
    await page.getByLabel('납품처 *').fill(client);
    await page.getByRole('button', { name: '생성' }).click();
    await expect(page.getByText(lotNo)).toBeVisible();
  };

  try {
    await page.goto('/login');
    await page.getByLabel('이메일').fill(EMAIL);
    await page.getByLabel('비밀번호').fill(PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(/\/kpi/);
    await page.getByRole('link', { name: 'LOT 관리' }).click();

    await createLot(lots[0], clientName);
    await createLot(lots[1], `E2E 납품처${tag}`);

    const { data: saved } = await admin.from('clients').select('id').ilike('name', `E2E%${tag}`);
    expect(saved).toHaveLength(1);

    await page.getByRole('link', { name: 'LOT 이력' }).click();
    const filter = page.getByLabel('납품처 필터');
    await expect(filter.getByRole('option', { name: clientName })).toHaveCount(1);
    await filter.selectOption(clientName);
    await expect(page.getByText(lots[0])).toBeVisible();
    await expect(page.getByText(lots[1])).toBeVisible();
  } finally {
    await admin.from('lots').delete().in('lot_no', lots);
    await admin.from('clients').delete().ilike('name', `E2E%${tag}`);
  }
});
