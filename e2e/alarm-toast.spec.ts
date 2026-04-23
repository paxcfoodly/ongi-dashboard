import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@ongi.kr';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ongi1234';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const URL = 'http://127.0.0.1:54321';

test('threshold-crossing metric triggers toast', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(EMAIL);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/kpi/);

  const admin = createClient(URL, SERVICE);
  await admin.from('alarms').delete().eq('source', 'auto');

  const { data: device } = await admin.from('devices').select('id').eq('code', 'vision_01').single();
  await admin.from('vision_inspector_metrics').insert({
    device_id: device!.id,
    bucket_at: new Date().toISOString(),
    total_inspected: 100, good_count: 50,
    defect_count: 45, unknown_count: 5, inspection_time_seconds: 60,
  });

  await expect(page.getByText(/불량률.*목표.*초과/)).toBeVisible({ timeout: 10_000 });
});
