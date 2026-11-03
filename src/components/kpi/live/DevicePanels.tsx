import { useNow } from '../../../hooks/useNow';
import { fmt } from '../../../utils/formatting';
import { StatusBadge } from './StatusBadge';
import {
  agoLabel,
  computeLiveState,
  lastReceivedAt,
  latestByBucket,
  type LiveEquipmentRow,
  type LiveStateKey,
  type LiveVisionRow,
} from '../../../lib/services/liveStatus';
import type { DeviceStatus } from '../../../hooks/useDeviceStatus';
import type { TodayTotals } from '../../../hooks/useLiveMetrics';

const borders: Record<LiveStateKey, string> = {
  run: 'border-good',
  idle: 'border-border-strong',
  delay: 'border-warn',
  off: 'border-danger',
};

// 합계를 못 불러온 경우 0으로 오해하지 않도록 값 없음으로 표시
const count = (v: number | undefined, unit = '') => (v == null ? '—' : `${fmt.int(v)}${unit}`);

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-text-dim whitespace-nowrap">{label}</div>
      <div className={`text-[14px] font-bold tabular-nums leading-snug ${tone}`}>{value}</div>
    </div>
  );
}

function Panel({
  name, stateKey, badge, totalLabel, total, unit, stats,
}: {
  name: string;
  stateKey: LiveStateKey;
  badge: React.ReactNode;
  totalLabel: string;
  total: string;
  unit: string;
  stats: React.ReactNode;
}) {
  return (
    <article aria-label={`${name} 가동 상태`} className={`bg-surface border-[1.5px] rounded-lg px-4 py-3 min-w-0 ${borders[stateKey]}`}>
      <div className="flex justify-between items-center gap-2 flex-wrap mb-2">
        <h3 className="text-[14px] font-bold text-text">{name}</h3>
        {badge}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2.5 items-end">
        <div>
          <div className="text-[12px] text-text-dim">{totalLabel}</div>
          <div className="text-[30px] font-bold leading-tight tabular-nums text-text">
            {total}
            <span className="text-[13px] font-medium text-text-dim ml-1">{unit}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">{stats}</div>
      </div>
    </article>
  );
}

// 설비별 가동 상태: 실제 수신 시각(created_at)과 최근 실적으로 판정
export function DevicePanels({
  devices,
  equipment,
  vision,
  totals,
}: {
  devices: DeviceStatus[];
  equipment: LiveEquipmentRow[];
  vision: LiveVisionRow[];
  totals: TodayTotals | null | undefined;
}) {
  const now = useNow();
  return (
    <section aria-label="설비별 가동 상태">
      <h2 className="text-[13.5px] font-bold text-text mb-2">설비별 가동 상태</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {devices.map((d) => {
        if (d.type === 'vision_inspector') {
          const rows = vision.filter((r) => r.device_id === d.id);
          const received = lastReceivedAt(rows);
          const latest = latestByBucket(rows);
          const state = computeLiveState(received, latest ? latest.total_inspected > 0 : null, now);
          return (
            <Panel
              key={d.id}
              name={d.name}
              stateKey={state.key}
              badge={<StatusBadge state={state} />}
              totalLabel="오늘 검사수량"
              total={count(totals?.inspected)}
              unit="건"
              stats={
                <>
                  <Stat label="오늘 불량" value={count(totals?.defects, '건')} tone={(totals?.defects ?? 0) > 0 ? 'text-danger-dark' : 'text-text'} />
                  <Stat label="오늘 재검" value={count(totals?.unknown, '건')} tone="text-text" />
                  <Stat label="마지막 수신" value={agoLabel(received, now)} tone="text-text" />
                </>
              }
            />
          );
        }
        const rows = equipment.filter((r) => r.device_id === d.id);
        const received = lastReceivedAt(rows);
        const latest = latestByBucket(rows);
        const state = computeLiveState(received, latest ? latest.output_count > 0 : null, now);
        return (
          <Panel
            key={d.id}
            name={d.name}
            stateKey={state.key}
            badge={<StatusBadge state={state} />}
            totalLabel="오늘 생산수량"
            total={count(totals?.production)}
            unit="ea"
            stats={
              <>
                <Stat label="최근 1분 생산" value={latest ? `${fmt.int(latest.output_count)} ea` : '—'} tone="text-text" />
                <Stat label="최근 1분 가동" value={latest ? `${latest.runtime_seconds}초` : '—'} tone="text-text" />
                <Stat label="마지막 수신" value={agoLabel(received, now)} tone="text-text" />
              </>
            }
          />
        );
      })}
      </div>
    </section>
  );
}
