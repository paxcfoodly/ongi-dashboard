import { useKpiData, useHourlyProduction } from '../hooks/useKpiData';
import { useKpiTargets } from '../hooks/useKpiTargets';
import { useRecentLotManhours } from '../hooks/useManhourKpi';
import { fmt } from '../utils/formatting';
import { ProgressBar } from '../components/common/ProgressBar';
import { StatusDot } from '../components/common/StatusDot';
import { ChartCard, LegendItem } from '../components/common/ChartCard';
import { HourlyProductionChart } from '../components/charts/HourlyProductionChart';
import { LotManhourChart } from '../components/charts/LotManhourChart';
import { CommonKpiSection } from '../components/kpi/CommonKpiSection';
import { AutonomousKpiSection } from '../components/kpi/AutonomousKpiSection';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useAlarms } from '../hooks/useAlarms';
import { chartColors } from '../lib/chartDefaults';

export function KpiPage() {
  const { data: kpi, isLoading } = useKpiData();
  const { data: targetsData } = useKpiTargets();
  const { data: hourly } = useHourlyProduction();
  const { data: lotManhours } = useRecentLotManhours(10);
  const { data: devices } = useDeviceStatus();
  const { data: alarms } = useAlarms(4);

  // 목표값은 DB에서 로드 — 로딩 중에는 빈 객체로 두어 '-' 표시
  const targets = targetsData ?? {};
  const dailyTarget = targets.daily_production;
  const hourlyTarget = targets.hourly_production;
  const manhourTarget = targets.manhour_target;

  if (isLoading || !kpi) {
    return <div className="text-text-dim">KPI 로딩 중...</div>;
  }

  const achievement = dailyTarget ? (kpi.today_production / dailyTarget) * 100 : null;

  return (
    <div className="space-y-4">
      <CommonKpiSection kpi={kpi} targets={targets} />
      <AutonomousKpiSection claimsCount={kpi.claims_count} targets={targets} />

      {achievement != null && (
        <section className="grid grid-cols-1 gap-2.5">
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-dim">오늘 목표 달성률</span>
              <strong className="text-sm text-text">
                {achievement.toFixed(1)}% ({fmt.int(kpi.today_production)} / {fmt.int(dailyTarget)} ea)
              </strong>
            </div>
            <ProgressBar value={kpi.today_production} max={dailyTarget} variant={achievement >= 100 ? 'primary' : 'warn'} />
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-medium text-text-dim mb-2">설비별 가동 상태</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {devices?.map((d) => (
            <div
              key={d.id}
              className={`bg-surface border rounded-lg p-3 flex items-center gap-2 ${
                d.health === 'warn' ? 'border-warn' : d.health === 'offline' ? 'border-danger' : 'border-border'
              }`}
            >
              <StatusDot health={d.health} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text truncate">{d.name}</div>
                <div className={`text-[10px] ${
                  d.health === 'warn' ? 'text-warn' : d.health === 'offline' ? 'text-danger' : 'text-text-muted'
                }`}>
                  {d.health === 'running' ? '가동중' : d.health === 'warn' ? '점검 필요' : '오프라인'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <ChartCard
          title="시간대별 생산량 (오늘)"
          legend={
            <>
              <LegendItem color={chartColors.good} label="실적" />
              <LegendItem color={chartColors.gray} label={`목표 ${fmt.int(hourlyTarget)}`} />
            </>
          }
        >
          <HourlyProductionChart buckets={hourly ?? []} target={hourlyTarget ?? 0} />
        </ChartCard>
        <ChartCard
          title="LOT별 작업공수 (최근 완료 10건)"
          legend={
            <>
              <LegendItem color={chartColors.primary} label="실적" />
              <LegendItem color={chartColors.danger} label={`목표 ${manhourTarget ?? '-'}`} />
            </>
          }
        >
          <LotManhourChart rows={lotManhours ?? []} target={manhourTarget ?? 0} />
        </ChartCard>
      </section>

      <section>
        <h2 className="text-xs font-medium text-text-dim mb-2">최근 알람</h2>
        <div className="space-y-1.5">
          {alarms && alarms.length > 0 ? (
            alarms.map((a) => (
              <div
                key={a.id}
                className={`bg-surface border rounded-lg p-3 flex items-center gap-3 text-xs ${
                  a.severity === 'danger' ? 'border-danger' :
                  a.severity === 'warning' ? 'border-warn' : 'border-border'
                }`}
              >
                <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-[10px] font-bold ${
                  a.severity === 'danger' ? 'bg-danger text-white' :
                  a.severity === 'warning' ? 'bg-warn text-white' : 'bg-primary text-white'
                }`}>
                  {a.severity === 'info' ? 'i' : '!'}
                </span>
                <span className="flex-1">{a.message}</span>
                <span className="text-text-muted font-mono">
                  {new Date(a.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          ) : (
            <div className="text-text-muted text-xs">최근 알람이 없습니다.</div>
          )}
        </div>
      </section>
    </div>
  );
}
