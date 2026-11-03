// 실시간 화면용 판정·가공 — 통신(패킷 수신)과 가동(실제 생산)을 분리한다
export type LiveStateKey = 'run' | 'idle' | 'delay' | 'off';

export interface LiveState {
  key: LiveStateKey;
  label: string;
}

export interface LiveDeviceRef {
  name: string;
}

export interface LiveEquipmentRow {
  id: number;
  device_id: string;
  bucket_at: string;
  created_at: string;
  runtime_seconds: number;
  output_count: number;
  devices?: LiveDeviceRef | null;
}

export interface LiveVisionRow {
  id: number;
  device_id: string;
  bucket_at: string;
  created_at: string;
  total_inspected: number;
  good_count: number;
  defect_count: number;
  unknown_count: number;
  devices?: LiveDeviceRef | null;
}

const DELAY_AFTER_MS = 2 * 60_000;
const OFF_AFTER_MS = 5 * 60_000;

// lastReceivedAt: 서버가 실제로 받은 시각(created_at), hasActivity: 최근 패킷에 생산·검사 실적이 있는지
export function computeLiveState(lastReceivedAt: string | null, hasActivity: boolean | null, now: number): LiveState {
  const received = lastReceivedAt ? Date.parse(lastReceivedAt) : NaN;
  if (Number.isNaN(received)) return { key: 'off', label: '통신 끊김' };
  const elapsed = now - received;
  if (elapsed > OFF_AFTER_MS) return { key: 'off', label: '통신 끊김' };
  if (elapsed > DELAY_AFTER_MS) return { key: 'delay', label: '수신 지연' };
  return hasActivity ? { key: 'run', label: '가동중' } : { key: 'idle', label: '대기' };
}

// 데이터 시각이 가장 최근인 행 (재전송으로 늦게 도착한 과거 데이터가 현재 상태를 덮지 않게 함)
export function latestByBucket<T extends { bucket_at: string }>(rows: T[]): T | null {
  return rows.reduce<T | null>(
    (best, r) => (best == null || Date.parse(r.bucket_at) > Date.parse(best.bucket_at) ? r : best),
    null,
  );
}

export function lastReceivedAt(rows: { created_at: string }[]): string | null {
  return rows.reduce<string | null>(
    (best, r) => (best == null || Date.parse(r.created_at) > Date.parse(best) ? r.created_at : best),
    null,
  );
}

interface PacketBase {
  key: string;
  deviceName: string;
  receivedAt: string;
  bucketAt: string;
}
export interface EquipmentPacket extends PacketBase {
  kind: 'equipment';
  output: number;
  runtime: number;
}
export interface VisionPacket extends PacketBase {
  kind: 'vision';
  total: number;
  good: number;
  defect: number;
  unknown: number;
}
export type LivePacket = EquipmentPacket | VisionPacket;

// 패킷 원문 대신 운영자에게 필요한 값만 추려 수신 시각 최신순으로 합친다
export function buildPacketFeed(equipment: LiveEquipmentRow[], vision: LiveVisionRow[], limit: number): LivePacket[] {
  const packets: LivePacket[] = [
    ...equipment.map((r): EquipmentPacket => ({
      kind: 'equipment', key: `e-${r.id}`, deviceName: r.devices?.name ?? '설비',
      receivedAt: r.created_at, bucketAt: r.bucket_at, output: r.output_count, runtime: r.runtime_seconds,
    })),
    ...vision.map((r): VisionPacket => ({
      kind: 'vision', key: `v-${r.id}`, deviceName: r.devices?.name ?? 'AI 비전검사기',
      receivedAt: r.created_at, bucketAt: r.bucket_at, total: r.total_inspected, good: r.good_count,
      defect: r.defect_count, unknown: r.unknown_count,
    })),
  ];
  return packets.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)).slice(0, limit);
}

const kst = (ms: number) => new Date(ms).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });

export const toKstTime = (iso: string): string => kst(Date.parse(iso)).slice(11, 19);
export const toKstHourMinute = (iso: string): string => kst(Date.parse(iso)).slice(11, 16);

// 현재 분을 제외한 최근 N분 — 수신이 없는 분은 null로 남겨 0(생산 없음)과 구분한다
export function minuteSeries(rows: LiveEquipmentRow[], now: number, minutes: number): { label: string; output: number | null }[] {
  const byMinute = new Map(rows.map((r) => [toKstHourMinute(r.bucket_at), r.output_count]));
  const currentMinute = Math.floor(now / 60_000) * 60_000;
  return Array.from({ length: minutes }, (_, i) => {
    const label = kst(currentMinute - (minutes - i) * 60_000).slice(11, 16);
    return { label, output: byMinute.get(label) ?? null };
  });
}

export function agoLabel(iso: string | null, now: number): string {
  if (!iso) return '수신 기록 없음';
  const sec = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (sec < 60) return `${sec}초 전`;
  return `${Math.floor(sec / 60)}분 ${String(sec % 60).padStart(2, '0')}초 전`;
}
