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

export async function verifyApiKey(
  admin: SupabaseClient,
  deviceId: string,
  provided: string
): Promise<boolean> {
  const { data, error } = await admin.rpc('fn_verify_device_api_key', {
    p_device_id: deviceId,
    p_plain_key: provided,
  });
  if (error) return false;
  return data === true;
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
  rawPayload: unknown,
  // 요청 원문과 Content-Type (X-Api-Key는 절대 저장하지 않음)
  meta: { rawBody: string | null; contentType: string | null }
) {
  // Postgres text/jsonb 는 NUL(\u0000) 을 거부해 로그 행 자체가 사라지므로 문자 그대로 이스케이프해 저장
  const escapeNul = (v: string) => v.replaceAll('\0', '\\u0000');
  const { error } = await admin.from('ingest_logs').insert({
    device_code: deviceCode,
    status,
    error_message: errorMessage,
    raw_payload: typeof rawPayload === 'string' ? escapeNul(rawPayload) : rawPayload,
    raw_body: meta.rawBody == null ? null : escapeNul(meta.rawBody),
    content_type: meta.contentType,
  });
  // 로그 저장 실패는 응답을 막지 않되 반드시 남긴다 (API 키·헤더는 출력 금지)
  if (error) console.error('ingest_logs insert failed', error.message);
}
