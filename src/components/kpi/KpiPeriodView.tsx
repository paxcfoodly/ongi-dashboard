import { useMemo } from 'react';
import { useKpiTargets } from '../../hooks/useKpiTargets';
import { usePeriodDaily, usePeriodLotManhours, usePeriodLotLeadtimes, usePeriodHrKpi } from '../../hooks/usePeriodKpi';
import type { DailyKpi } from '../../hooks/useKpiData';
import type { Period } from '../../lib/services/period';
import {
  summarizeDaily, computeRatios, dailyAchievementPct, summarizeManhour, summarizeLeadtime,
  type DailyRow, type Totals,
} from '../../lib/services/periodKpi';
import { fmt } from '../../utils/formatting';
import { chartColors } from '../../lib/chartDefaults';
import { ChartCard, LegendItem } from '../common/ChartCard';
import { HourlyProductionChart } from '../charts/HourlyProductionChart';
import { LotManhourChart } from '../charts/LotManhourChart';
import { DailyTable, type DailyColumn } from '../period/DailyTable';
import { CommonKpiSection } from './CommonKpiSection';
import { AutonomousKpiSection } from './AutonomousKpiSection';

const DASH = '—';

// 값이 없으면 em dash, 있으면 포맷터 적용
const show = (v: number | null, f: (n: number) => string): string => (v == null ? DASH : f(v));
const int = (n: number) => fmt.int(n);

// 기간 총합을 오늘 모드 카드가 쓰는 DailyKpi 형태로 매핑 (비율 null → 0, 0 실적은 카드 쪽 가드가 걸러냄)
function toDailyKpi(t: Totals): DailyKpi {
  return {
    today_production: t.production,
    runtime_sec_today: t.runtime_sec,
    hourly_production: t.hourly_production ?? 0,
    work_time_per_ea: t.work_time_per_ea ?? 0,
    inspected: t.inspected,
    defects: t.defects,
    defect_rate_pct: t.defect_rate_pct ?? 0,
    claims_count: t.claims,
  };
}

export function KpiPeriodView({ period }: { period: Period }) {
  const { data: targetsData, isError: targetsError } = useKpiTargets();
  const { data: daily, isLoading, isError: dailyError } = usePeriodDaily(period);
  const { data: lotManhours } = usePeriodLotManhours(period);
  const { data: lotLeadtimes } = usePeriodLotLeadtimes(period);
  const { data: periodHr } = usePeriodHrKpi(period);

  const targets = targetsData ?? {};
  const dailyTarget = targets.daily_production;
  const manhourTarget = targets.manhour_target;

  const rows = useMemo<DailyRow[]>(() => daily ?? [], [daily]);
  const totals = useMemo(() => summarizeDaily(rows), [rows]);
  const manhour = useMemo(() => summarizeManhour(lotManhours ?? []), [lotManhours]);
  const leadtime = useMemo(() => summarizeLeadtime(lotLeadtimes ?? []), [lotLeadtimes]);

  // 일별 RPC 실패 시 무한 로딩 대신 오류 안내
  if (dailyError) {
    return (
      <div role="alert" className="bg-surface border border-danger rounded-lg p-3 text-sm text-danger">
        기간 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }
  if (isLoading || !daily) {
    return <div className="text-text-dim">KPI 로딩 중...</div>;
  }

  const pct = (p: number | null) => show(p, (n) => `${n.toFixed(1)}%`);
  const columns: DailyColumn<DailyRow>[] = [
    { header: '생산수량', agg: 'sum', cell: (r) => int(r.production), total: int(totals.production) },
    {
      header: '가동시간(h)', agg: 'sum',
      cell: (r) => (r.runtime_sec / 3600).toFixed(1), total: (totals.runtime_sec / 3600).toFixed(1),
    },
    {
      header: '시간당 생산량', agg: 'avg',
      cell: (r) => show(computeRatios(r).hourly_production, int), total: show(totals.hourly_production, int),
    },
    {
      header: '작업시간/ea', agg: 'avg',
      cell: (r) => show(computeRatios(r).work_time_per_ea, (n) => n.toFixed(2)),
      total: show(totals.work_time_per_ea, (n) => n.toFixed(2)),
    },
    {
      header: '일 목표 달성률', agg: 'none',
      cell: (r) => pct(dailyAchievementPct(r.production, dailyTarget)), total: '',
    },
    { header: '검사수', agg: 'sum', cell: (r) => int(r.inspected), total: int(totals.inspected) },
    { header: '불량수', agg: 'sum', cell: (r) => int(r.defects), total: int(totals.defects) },
    {
      header: '불량률', agg: 'avg',
      cell: (r) => show(computeRatios(r).defect_rate_pct, (n) => `${n.toFixed(2)}%`),
      total: show(totals.defect_rate_pct, (n) => `${n.toFixed(2)}%`),
    },
    { header: '클레임', agg: 'sum', cell: (r) => int(r.claims), total: int(totals.claims) },
  ];

  return (
    <div className="space-y-4">
      {/* 목표값 조회 실패 시 '-'만 보이지 않도록 명시적으로 안내 */}
      {targetsError && (
        <div role="alert" className="bg-surface border border-danger rounded-lg p-3 text-sm text-danger">
          목표값을 불러오지 못했습니다 — 새로고침 해주세요
        </div>
      )}
      <CommonKpiSection
        kpi={toDailyKpi(totals)}
        targets={targets}
        scope="period"
        manhour={manhour}
        leadtime={leadtime}
      />
      <AutonomousKpiSection claimsCount={totals.claims} targets={targets} scope="period" periodHr={periodHr} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <ChartCard
          title="일자별 생산량 (선택 기간)"
          legend={
            <>
              <LegendItem color={chartColors.good} label="실적" />
              <LegendItem color={chartColors.gray} label={`일 목표 ${fmt.int(dailyTarget)}`} />
            </>
          }
        >
          <HourlyProductionChart
            buckets={rows.map((r) => ({ hour: r.day.slice(5), output: r.production }))}
            target={dailyTarget}
          />
        </ChartCard>
        <ChartCard
          title="LOT별 작업공수 (선택 기간 · 최근 10건)"
          legend={
            <>
              <LegendItem color={chartColors.primary} label="실적" />
              <LegendItem color={chartColors.danger} label={`목표 ${manhourTarget ?? '-'}`} />
            </>
          }
        >
          <LotManhourChart rows={(lotManhours ?? []).slice(0, 10)} target={manhourTarget} />
        </ChartCard>
      </section>

      <DailyTable title="날짜별 KPI" rows={rows} columns={columns} />
    </div>
  );
}
