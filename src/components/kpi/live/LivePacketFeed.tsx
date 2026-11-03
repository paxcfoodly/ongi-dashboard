import { useNow } from '../../../hooks/useNow';
import {
  agoLabel,
  buildPacketFeed,
  lastReceivedAt,
  toKstHourMinute,
  toKstTime,
  type LiveEquipmentRow,
  type LivePacket,
  type LiveVisionRow,
} from '../../../lib/services/liveStatus';
import type { DeviceStatus } from '../../../hooks/useDeviceStatus';

const FEED_SIZE = 30;
const FRESH_MS = 15_000;
const STOPPED_AFTER_MS = 2 * 60_000;

function PacketValues({ packet }: { packet: LivePacket }) {
  if (packet.kind === 'equipment') {
    if (packet.output === 0 && packet.runtime === 0) return <span className="text-text-muted">생산 0 ea · 가동 0초</span>;
    return <>생산 <b className="tabular-nums">{packet.output}</b> ea · 가동 <b className="tabular-nums">{packet.runtime}</b>초</>;
  }
  if (packet.total === 0) return <span className="text-text-muted">검사 0건</span>;
  return (
    <>
      검사 <b className="tabular-nums">{packet.total}</b> · 양품 <b className="tabular-nums">{packet.good}</b> · 불량{' '}
      <b className={`tabular-nums ${packet.defect > 0 ? 'text-danger-dark' : ''}`}>{packet.defect}</b> · 재검{' '}
      <b className="tabular-nums">{packet.unknown}</b>
    </>
  );
}

// 수신 패킷에서 운영자에게 필요한 값만 추려 보여준다 (DB에 저장된 패킷 기준)
export function LivePacketFeed({
  devices,
  equipment,
  vision,
  isError,
}: {
  devices: DeviceStatus[];
  equipment: LiveEquipmentRow[];
  vision: LiveVisionRow[];
  isError: boolean;
}) {
  const now = useNow();
  const packets = buildPacketFeed(equipment, vision, FEED_SIZE);
  const newest = packets[0]?.receivedAt;
  const receiving = newest != null && now - Date.parse(newest) <= STOPPED_AFTER_MS;
  const rowsOf = (d: DeviceStatus) => (d.type === 'vision_inspector' ? vision : equipment).filter((r) => r.device_id === d.id);

  return (
    <aside
      aria-label="실시간 수신 패킷"
      className="bg-surface border border-border rounded-lg px-3.5 py-3 flex flex-col xl:sticky xl:top-3 max-h-[480px] xl:max-h-[calc(100vh-24px)]"
    >
      <div className="flex justify-between items-center gap-2 mb-1.5">
        <h2 className="text-[13.5px] font-bold text-text">실시간 수신 패킷</h2>
        <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${receiving ? 'text-good-dark' : 'text-danger-dark'}`}>
          <span className={`w-2 h-2 rounded-full ${receiving ? 'bg-good animate-pulse' : 'bg-danger'}`} />
          {receiving ? '실시간 수신' : '수신 중단'}
        </span>
      </div>
      <div className="grid gap-1 pb-2 text-[12.5px]">
        {devices.map((d) => (
          <div key={d.id} className="flex justify-between gap-2">
            <span className="text-[12px] text-text-dim">{d.name} 최근 패킷</span>
            <span className="tabular-nums text-text">{agoLabel(lastReceivedAt(rowsOf(d)), now)}</span>
          </div>
        ))}
      </div>
      <div className="overflow-y-auto flex-1 min-h-[300px]">
        {isError && <div role="alert" className="py-3 text-[12.5px] text-danger-dark">패킷을 불러오지 못했습니다 — 잠시 후 자동으로 다시 시도합니다</div>}
        {!isError && packets.length === 0 && <div className="py-3 text-[12.5px] text-text-muted">아직 수신된 패킷이 없습니다</div>}
        {packets.map((p) => (
          <div
            key={p.key}
            data-testid="live-packet"
            className={`py-1.5 border-t border-border text-[12.5px] text-text ${now - Date.parse(p.receivedAt) < FRESH_MS ? 'packet-fresh' : ''}`}
          >
            <div className="flex gap-1.5 items-center flex-wrap mb-0.5">
              <span className="font-bold tabular-nums">{toKstTime(p.receivedAt)}</span>
              <span className="text-[11px] font-bold px-1.5 rounded bg-primary-light text-text">{p.deviceName}</span>
              <span className="text-[11.5px] text-text-muted tabular-nums">{toKstHourMinute(p.bucketAt)} 데이터</span>
              <span className="ml-auto text-[11px] font-bold px-1.5 rounded bg-good-light text-good-dark">저장</span>
            </div>
            <div><PacketValues packet={p} /></div>
          </div>
        ))}
      </div>
    </aside>
  );
}
