import { PeriodPicker } from '../components/period/PeriodPicker';
import { KpiPeriodView } from '../components/kpi/KpiPeriodView';
import { usePeriod } from '../hooks/usePeriod';
import { useKpiData, useHourlyProduction } from '../hooks/useKpiData';
import { useKpiTargets } from '../hooks/useKpiTargets';
import { fmt } from '../utils/formatting';
import { ProgressBar } from '../components/common/ProgressBar';
import { ChartCard, LegendItem } from '../components/common/ChartCard';
import { HourlyProductionChart } from '../components/charts/HourlyProductionChart';
import { MinuteProductionChart } from '../components/charts/MinuteProductionChart';
import { CommonKpiSection } from '../components/kpi/CommonKpiSection';
import { AutonomousKpiSection } from '../components/kpi/AutonomousKpiSection';
import { KpiFoldAllButton, KpiFoldProvider } from '../components/kpi/KpiFoldContext';
import { DevicePanels } from '../components/kpi/live/DevicePanels';
import { LivePacketFeed } from '../components/kpi/live/LivePacketFeed';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useAlarms } from '../hooks/useAlarms';
import { LIVE_REFRESH_MS, useLiveEquipment, useLiveVision, useTodayTotals } from '../hooks/useLiveMetrics';
import { useNow } from '../hooks/useNow';
import { minuteSeries } from '../lib/services/liveStatus';
import { chartColors } from '../lib/chartDefaults';
import { useTheme } from '../lib/theme';

const MINUTE_CHART_SPAN = 30;

// 최근 알람은 오늘·기간 모드 공통
function RecentAlarms() {
  const { data: alarms, isError } = useAlarms(4);
  return (
    <section className="bg-surface border border-border rounded-lg px-4 py-3">
      <h2 className="text-[13.5px] font-bold text-text mb-2">최근 알람</h2>
      <div className="space-y-1.5">
        {isError ? (
          <div role="alert" className="text-danger-dark text-[13px]">최근 알람을 불러오지 못했습니다 — 잠시 후 다시 확인해 주세요</div>
        ) : alarms && alarms.length > 0 ? (
          alarms.map((a) => (
            <div
              key={a.id}
              className={`bg-surface border rounded p-2 flex items-center gap-2.5 text-[13px] ${
                a.severity === 'danger' ? 'border-danger' :
                a.severity === 'warning' ? 'border-warn' : 'border-border'
              }`}
            >
              <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold flex-none ${
                a.severity === 'danger' ? 'bg-danger text-on-fill' :
                a.severity === 'warning' ? 'bg-warn text-on-fill' : 'bg-primary text-on-fill'
              }`}>
                {a.severity === 'info' ? 'i' : '!'}
              </span>
              <span className="flex-1 text-text">{a.message}</span>
              <span className="text-text-muted tabular-nums">
                {new Date(a.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        ) : (
          <div className="text-text-muted text-[13px]">최근 알람이 없습니다.</div>
        )}
      </div>
    </section>
  );
}

function LiveMinuteChart({ rows }: { rows: Parameters<typeof minuteSeries>[0] }) {
  const now = useNow(30_000);
  return <MinuteProductionChart points={minuteSeries(rows, now, MINUTE_CHART_SPAN)} />;
}

// 오늘 모드: 장비 상태 → 성과지표 → 목표 달성률 → 차트 → 알람 + 오른쪽 실시간 패킷
function KpiTodayView() {
  useTheme(); // 범례 색이 테마를 따라가도록
  const { data: kpi, isLoading } = useKpiData(LIVE_REFRESH_MS);
  const { data: targetsData, isError: targetsError } = useKpiTargets();
  const { data: hourly } = useHourlyProduction(LIVE_REFRESH_MS);
  const { data: devices } = useDeviceStatus(LIVE_REFRESH_MS);
  const { data: equipment, isError: equipmentError } = useLiveEquipment();
  const { data: vision, isError: visionError } = useLiveVision();
  const { data: totals } = useTodayTotals();

  // 목표값은 DB에서 로드 — 로딩 중에는 빈 객체로 두어 '-' 표시
  const targets = targetsData ?? {};
  const dailyTarget = targets.daily_production;
  const hourlyTarget = targets.hourly_production;

  if (isLoading || !kpi) {
    return (
      <div className="space-y-3">
        <PeriodPicker />
        <div className="text-text-dim">KPI 로딩 중...</div>
      </div>
    );
  }

  const achievement = dailyTarget ? (kpi.today_production / dailyTarget) * 100 : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
      <div className="space-y-3 min-w-0">
        <PeriodPicker />
        {/* 목표값 조회 실패 시 '-'만 보이지 않도록 명시적으로 안내 */}
        {targetsError && (
          <div role="alert" className="bg-surface border border-danger rounded-lg p-3 text-sm text-danger-dark">
            목표값을 불러오지 못했습니다 — 새로고침 해주세요
          </div>
        )}
        <DevicePanels devices={devices ?? []} equipment={equipment ?? []} vision={vision ?? []} totals={totals} />

        <KpiFoldProvider>
          <section aria-label="성과지표" className="bg-surface border border-border rounded-lg px-4 py-3">
            <div className="flex justify-between items-center gap-2 flex-wrap mb-2">
              <h2 className="text-[13.5px] font-bold text-text">성과지표</h2>
              <KpiFoldAllButton />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 min-[1400px]:grid-cols-4 gap-2">
              <CommonKpiSection kpi={kpi} targets={targets} embedded />
              <AutonomousKpiSection claimsCount={kpi.claims_count} targets={targets} embedded />
            </div>
          </section>
        </KpiFoldProvider>

        {achievement != null && (
          <section aria-label="오늘 목표 달성률" className="bg-surface border border-border rounded-lg px-4 py-3">
            <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1.5">
              <h2 className="text-[13.5px] font-bold text-text">오늘 목표 달성률</h2>
              <span className="text-[12px] text-text-muted tabular-nums">
                {fmt.int(kpi.today_production)} / {fmt.int(dailyTarget)} ea · 남은 수량 {fmt.int(Math.max(0, dailyTarget - kpi.today_production))} ea
              </span>
            </div>
            <div className="flex items-center gap-3">
              <strong className="text-[21px] font-bold text-text tabular-nums min-w-[70px]">{achievement.toFixed(1)}%</strong>
              <div className="flex-1">
                <ProgressBar value={kpi.today_production} max={dailyTarget} variant={achievement >= 100 ? 'primary' : 'warn'} />
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3">
          <ChartCard
            title="시간대별 생산량 (오늘)"
            legend={
              <>
                <LegendItem color={chartColors.primary} label="실적" />
                <LegendItem color={chartColors.danger} label={`목표 ${fmt.int(hourlyTarget)}`} />
              </>
            }
          >
            <HourlyProductionChart buckets={hourly ?? []} target={hourlyTarget} />
          </ChartCard>
          <ChartCard title={`최근 ${MINUTE_CHART_SPAN}분 분당 생산량`}>
            <LiveMinuteChart rows={equipment ?? []} />
          </ChartCard>
        </section>

        <RecentAlarms />
      </div>
      <LivePacketFeed
        devices={devices ?? []}
        equipment={equipment ?? []}
        vision={vision ?? []}
        isError={equipmentError || visionError}
      />
    </div>
  );
}

export function KpiPage() {
  const { period } = usePeriod();

  // 기간 모드: 설비 상태·오늘 목표 달성률·실시간 패킷은 렌더하지 않는다
  if (period) {
    return (
      <div className="space-y-4">
        <PeriodPicker />
        <KpiPeriodView period={period} />
        <RecentAlarms />
      </div>
    );
  }
  return <KpiTodayView />;
}
