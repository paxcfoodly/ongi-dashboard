import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { VisionMetricsSchema, EquipmentMetricsSchema } from './schemas.ts';

export interface DeviceRow {
  id: string;
  code: string;
  type: 'vision_inspector' | 'equipment';
  api_key_hash: string;
  active: boolean;
}

export async function findDevice(
  admin: SupabaseClient,
  code: string
): Promise<DeviceRow | null> {
  const { data } = await admin
    .from('devices')
    .select('id, code, type, api_key_hash, active')
    .eq('code', code)
    .maybeSingle();
  return (data as DeviceRow | null) ?? null;
}

export async function verifyApiKey(hash: string, provided: string): Promise<boolean> {
  // Phase 1: 간단 문자열 비교. 후속 Phase에서 bcrypt 해시 도입 예정.
  return hash === provided;
}

export async function insertVision(
  admin: SupabaseClient,
  deviceId: string,
  payload: unknown
) {
  const parsed = VisionMetricsSchema.parse(payload);
  const { error } = await admin.from('vision_inspector_metrics').insert({
    device_id: deviceId,
    bucket_at: parsed.bucket_at,
    ...parsed.metrics,
  });
  if (error) throw error;
}

export async function insertEquipment(
  admin: SupabaseClient,
  deviceId: string,
  payload: unknown
) {
  const parsed = EquipmentMetricsSchema.parse(payload);
  const { extras, ...m } = parsed.metrics;
  const { error } = await admin.from('equipment_metrics').insert({
    device_id: deviceId,
    bucket_at: parsed.bucket_at,
    ...m,
    extras: extras ?? {},
  });
  if (error) throw error;
}

export async function logIngest(
  admin: SupabaseClient,
  deviceCode: string | null,
  status: string,
  errorMessage: string | null,
  rawPayload: unknown
) {
  await admin.from('ingest_logs').insert({
    device_code: deviceCode,
    status,
    error_message: errorMessage,
    raw_payload: rawPayload,
  });
}
