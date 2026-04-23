import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZodError } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import {
  findDevice,
  verifyApiKey,
  insertVision,
  insertEquipment,
  logIngest,
} from './handlers.ts';
import { csvToVisionPayload, csvToEquipmentPayload } from './csv.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const deviceCode = req.headers.get('X-Device-Code');
  const apiKey = req.headers.get('X-Api-Key');
  const contentType = req.headers.get('Content-Type') ?? '';

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  if (!deviceCode || !apiKey) {
    await logIngest(admin, deviceCode, 'invalid_headers', 'missing X-Device-Code or X-Api-Key', rawBody);
    return json({ error: 'missing_headers' }, 400);
  }

  const device = await findDevice(admin, deviceCode);
  if (!device || !device.active) {
    await logIngest(admin, deviceCode, 'device_not_found', null, rawBody);
    return json({ error: 'device_not_found' }, 404);
  }

  if (!(await verifyApiKey(device.api_key_hash, apiKey))) {
    await logIngest(admin, deviceCode, 'invalid_key', null, rawBody);
    return json({ error: 'invalid_api_key' }, 401);
  }

  let payload: unknown;
  try {
    if (contentType.includes('text/csv')) {
      payload =
        device.type === 'vision_inspector'
          ? csvToVisionPayload(rawBody)
          : csvToEquipmentPayload(rawBody);
    } else {
      payload = JSON.parse(rawBody);
    }
  } catch (e) {
    await logIngest(admin, deviceCode, 'parse_error', (e as Error).message, rawBody);
    return json({ error: 'parse_error', details: (e as Error).message }, 400);
  }

  try {
    if (device.type === 'vision_inspector') {
      await insertVision(admin, device.id, payload);
    } else {
      await insertEquipment(admin, device.id, payload);
    }
  } catch (e) {
    if (e instanceof ZodError) {
      await logIngest(admin, deviceCode, 'schema_invalid', JSON.stringify(e.flatten()), payload);
      return json({ error: 'schema_invalid', details: e.flatten() }, 400);
    }
    const msg = (e as { code?: string; message?: string }).code === '23505'
      ? 'duplicate'
      : 'db_error';
    if (msg === 'duplicate') {
      await logIngest(admin, deviceCode, 'duplicate', null, payload);
      return json({ ok: true, duplicate: true });
    }
    await logIngest(admin, deviceCode, 'db_error', (e as Error).message, payload);
    return json({ error: 'internal' }, 500);
  }

  await logIngest(admin, deviceCode, 'success', null, null);
  return json({ ok: true, ingested_at: new Date().toISOString() });
});
