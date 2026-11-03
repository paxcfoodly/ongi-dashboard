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

const ROWS_PER_DEVICE = 15;
const FRESH_MS = 15_000;
const STOPPED_AFTER_MS = 2 * 60_000;

const EQUIPMENT_COLUMNS = ['생산(ea)', '가동(초)'];
const VISION_COLUMNS = ['검사', '양품', '불량', '재검'];
const EMPTY_TEXT = '아직 수신된 패킷이 없습니다';

function PacketCells({ packet }: { packet: LivePacket }) {
  const cell = 'py-[3px] pl-1.5 text-right tabular-nums';
  if (packet.kind === 'equipment') {
    return (
      <>
        <td className={cell}>{packet.output}</td>
        <td className={cell}>{packet.runtime}</td>
      </>
    );
  }
  return (
    <>
      <td className={cell}>{packet.total}</td>
      <td className={cell}>{packet.good}</td>
      <td className={`${cell} ${packet.defect > 0 ? 'text-danger-dark font-bold' : ''}`}>{packet.defect}</td>
      <td className={cell}>{packet.unknown}</td>
    </>
  );
}

const isZero = (p: LivePacket) => (p.kind === 'equipment' ? p.output === 0 && p.runtime === 0 : p.total === 0);

// 장비별 표: 항목 이름과 단위는 머리글에 한 번만 표시
function DevicePacketTable({
  name, columns, packets, lastSeen, now, showEmpty,
}: {
  name: string;
  columns: string[];
  packets: LivePacket[];
  lastSeen: string;
  now: number;
  showEmpty: boolean;
}) {
  const head = 'sticky top-0 bg-surface pb-1 pl-1.5 text-right text-[11px] font-normal text-text-muted whitespace-nowrap';
  return (
    <section aria-label={`${name} 수신 패킷`} className="flex flex-col h-[300px] xl:h-auto xl:flex-1 min-h-0 min-w-0 border-t border-border pt-2">
      <div className="flex justify-between items-baseline gap-2 mb-1">
        <h3 className="text-[12.5px] font-bold text-text">{name}</h3>
        <span className="text-[12px] text-text-muted tabular-nums">{lastSeen}</span>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        <table className="w-full border-collapse text-[12px] text-text whitespace-nowrap">
          <thead>
            <tr>
              <th scope="col" className={`${head} !pl-0 !text-left`}>수신</th>
              <th scope="col" className={head}>데이터</th>
              {columns.map((c) => <th key={c} scope="col" className={head}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {packets.map((p) => (
              <tr
                key={p.key}
                data-testid="live-packet"
                className={`${isZero(p) ? 'text-text-muted' : ''} ${now - Date.parse(p.receivedAt) < FRESH_MS ? 'packet-fresh' : ''}`}
              >
                <td className="py-[3px] tabular-nums">{toKstTime(p.receivedAt)}</td>
                <td className="py-[3px] pl-1.5 text-right tabular-nums text-text-muted">{toKstHourMinute(p.bucketAt)}</td>
                <PacketCells packet={p} />
              </tr>
            ))}
          </tbody>
        </table>
        {showEmpty && packets.length === 0 && <div className="py-2 text-[12px] text-text-muted">{EMPTY_TEXT}</div>}
      </div>
    </section>
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
  const newest = buildPacketFeed(equipment, vision, 1)[0]?.receivedAt;
  const receiving = newest != null && now - Date.parse(newest) <= STOPPED_AFTER_MS;

  return (
    <aside
      aria-label="실시간 수신 패킷"
      className="bg-surface border border-border rounded-lg px-3.5 py-3 flex flex-col xl:sticky xl:top-[76px] xl:h-[calc(100vh-88px)] xl:min-h-[480px]"
    >
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-[13.5px] font-bold text-text">실시간 수신 패킷</h2>
        <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${receiving ? 'text-good-dark' : 'text-danger-dark'}`}>
          <span className={`w-2 h-2 rounded-full ${receiving ? 'bg-good animate-pulse' : 'bg-danger'}`} />
          {receiving ? '실시간 수신' : '수신 중단'}
        </span>
      </div>
      <div className="text-[11.5px] text-text-muted mb-2">저장된 패킷만 표시</div>
      {isError && <div role="alert" className="pb-2 text-[12.5px] text-danger-dark">패킷을 불러오지 못했습니다 — 잠시 후 자동으로 다시 시도합니다</div>}
      {!isError && devices.length === 0 && <div className="py-2 text-[12px] text-text-muted">{EMPTY_TEXT}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:flex xl:flex-col xl:flex-1 xl:min-h-0">
        {devices.map((d) => {
          const isVision = d.type === 'vision_inspector';
          const equipmentRows = equipment.filter((r) => r.device_id === d.id);
          const visionRows = vision.filter((r) => r.device_id === d.id);
          return (
            <DevicePacketTable
              key={d.id}
              name={d.name}
              columns={isVision ? VISION_COLUMNS : EQUIPMENT_COLUMNS}
              packets={isVision ? buildPacketFeed([], visionRows, ROWS_PER_DEVICE) : buildPacketFeed(equipmentRows, [], ROWS_PER_DEVICE)}
              lastSeen={agoLabel(lastReceivedAt(isVision ? visionRows : equipmentRows), now)}
              now={now}
              showEmpty={!isError}
            />
          );
        })}
      </div>
    </aside>
  );
}
