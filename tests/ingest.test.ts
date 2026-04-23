import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const INGEST_URL = 'http://127.0.0.1:54321/functions/v1/ingest';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function headers(deviceCode: string, apiKey: string, ct = 'application/json') {
  return {
    Authorization: `Bearer ${ANON}`,
    'X-Device-Code': deviceCode,
    'X-Api-Key': apiKey,
    'Content-Type': ct,
  };
}

const TEST_KEY = 'test-plain-key-123';

describe('ingest edge function', () => {
  const admin = createClient(SUPABASE_URL, SERVICE);

  beforeAll(async () => {
    // 테스트 전 이전 metrics 청소
    await admin.from('equipment_metrics').delete().neq('id', 0);
    await admin.from('vision_inspector_metrics').delete().neq('id', 0);
    await admin.from('ingest_logs').delete().neq('id', 0);

    // Set test API keys via RPC (service_role allowed)
    const { data: vdev } = await admin
      .from('devices')
      .select('id')
      .eq('code', 'vision_01')
      .single();
    const { data: pdev } = await admin
      .from('devices')
      .select('id')
      .eq('code', 'packaging_01')
      .single();
    await admin.rpc('fn_set_device_api_key', {
      p_device_id: vdev!.id,
      p_plain_key: TEST_KEY,
    });
    await admin.rpc('fn_set_device_api_key', {
      p_device_id: pdev!.id,
      p_plain_key: TEST_KEY,
    });
  });

  it('rejects unknown device with 404', async () => {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('unknown_xxx', 'x'),
      body: '{}',
    });
    expect(res.status).toBe(404);
  });

  it('rejects wrong API key with 401', async () => {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', 'wrong_key'),
      body: JSON.stringify({
        bucket_at: '2026-04-23T10:00:00+09:00',
        metrics: { runtime_seconds: 30, output_count: 500 },
      }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects invalid schema with 400', async () => {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', TEST_KEY),
      body: JSON.stringify({ bucket_at: 'bad', metrics: {} }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts valid equipment payload and stores row', async () => {
    const bucket = '2026-04-23T11:00:00+09:00';
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', TEST_KEY),
      body: JSON.stringify({
        bucket_at: bucket,
        metrics: { runtime_seconds: 55, output_count: 1650 },
      }),
    });
    expect(res.status).toBe(200);
    const { data } = await admin
      .from('equipment_metrics')
      .select('output_count, runtime_seconds')
      .eq('bucket_at', bucket)
      .maybeSingle();
    expect(data?.output_count).toBe(1650);
    expect(data?.runtime_seconds).toBe(55);
  });

  it('accepts valid vision payload', async () => {
    const bucket = '2026-04-23T11:00:00+09:00';
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('vision_01', TEST_KEY),
      body: JSON.stringify({
        bucket_at: bucket,
        metrics: {
          total_inspected: 1800,
          good_count: 1785,
          defect_count: 10,
          unknown_count: 5,
          inspection_time_seconds: 58,
        },
      }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 with duplicate=true on re-send', async () => {
    const bucket = '2026-04-23T12:00:00+09:00';
    const body = JSON.stringify({
      bucket_at: bucket,
      metrics: { runtime_seconds: 55, output_count: 1700 },
    });
    const first = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', TEST_KEY),
      body,
    });
    expect(first.status).toBe(200);
    const second = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', TEST_KEY),
      body,
    });
    expect(second.status).toBe(200);
    const json = await second.json();
    expect(json.duplicate).toBe(true);
  });

  it('accepts CSV payload', async () => {
    const bucket = '2026-04-23T13:00:00+09:00';
    const csv =
      `bucket_at,runtime_seconds,output_count\n${bucket},50,1500`;
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: headers('packaging_01', TEST_KEY, 'text/csv'),
      body: csv,
    });
    expect(res.status).toBe(200);
  });
});
