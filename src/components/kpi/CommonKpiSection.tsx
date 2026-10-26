import { PerformanceKpiCard } from './PerformanceKpiCard';
import { FormulaBox, Hi, FormulaLabel } from '../common/FormulaBox';
import { fmt } from '../../utils/formatting';
import { useManhourKpi, useLeadtimeKpi } from '../../hooks/useManhourKpi';
import { KPI_PERIOD_DAYS } from '../../utils/kpi';
import type { DailyKpi } from '../../hooks/useKpiData';

// 값이 유한한 경우에만 사용 (NaN/Infinity 방지)
const finite = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const t = (targets: Record<string, number>, key: string): number | null => finite(targets[key]);

export function CommonKpiSection({
  kpi,
  targets,
}: {
  kpi: DailyKpi;
  targets: Record<string, number>;
}) {
  const { data: manhour } = useManhourKpi();
  const { data: leadtime } = useLeadtimeKpi();

  // 생산/검사 실적이 없으면 파생 지표는 값 없음 처리
  const hasProduction = kpi.today_production > 0;
  const hasInspection = kpi.inspected > 0;
  const avgManhour = finite(manhour?.avg_man_hour);
  const avgLead = finite(leadtime?.avg_lead_days);
  const lotKg = t(targets, 'lot_weight_kg');

  return (
    <section aria-label="공통 성과지표">
      <h2 className="text-xs font-medium text-text-dim mb-2">공통 성과지표</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <PerformanceKpiCard
          label="생산성 (시간당 생산량)"
          value={hasProduction ? finite(kpi.hourly_production) : null}
          unit="ea/hr"
          digits={0}
          baseline={t(targets, 'hourly_production_baseline')}
          target={t(targets, 'hourly_production')}
          direction="higher"
          noDataReason="오늘 생산 실적 없음"
          note="자율지표 '시간당 생산량' 동일"
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              총 생산수량 ÷ 가동시간(hr)
              <br />=
              <Hi>
                {hasProduction
                  ? ` ${fmt.int(kpi.today_production)} ÷ ${(kpi.runtime_sec_today / 3600).toFixed(2)} = ${fmt.int(kpi.hourly_production)} ea/hr`
                  : ' —'}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              삼면포장기
            </FormulaBox>
          }
        />

        <PerformanceKpiCard
          label="품질 (불량률)"
          value={hasInspection ? finite(kpi.defect_rate_pct) : null}
          unit="%"
          baseline={t(targets, 'defect_rate_baseline')}
          target={t(targets, 'defect_rate_max')}
          direction="lower"
          noDataReason="오늘 검사 실적 없음"
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              불량수 ÷ 전체 검사수 × 100
              <br />=
              <Hi>
                {hasInspection
                  ? ` (${fmt.int(kpi.defects)} ÷ ${fmt.int(kpi.inspected)}) × 100 = ${fmt.pct(kpi.defect_rate_pct, 2)}`
                  : ' —'}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              AI 비전검사기
            </FormulaBox>
          }
        />

        <PerformanceKpiCard
          label="작업시간 / ea"
          value={hasProduction ? finite(kpi.work_time_per_ea) : null}
          unit="sec/ea"
          digits={2}
          baseline={t(targets, 'work_time_baseline')}
          target={t(targets, 'work_time_per_ea')}
          direction="lower"
          noDataReason="오늘 생산 실적 없음"
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              총 생산시간 ÷ 총 생산수량
              <br />=
              <Hi>
                {hasProduction
                  ? ` ${kpi.runtime_sec_today.toFixed(0)} ÷ ${fmt.int(kpi.today_production)} = ${fmt.sec(kpi.work_time_per_ea)}`
                  : ' —'}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              삼면포장기
            </FormulaBox>
          }
        />

        <PerformanceKpiCard
          label="원가 (LOT당 작업공수)"
          value={avgManhour}
          unit="man-hour"
          baseline={t(targets, 'manhour_baseline')}
          target={t(targets, 'manhour_target')}
          direction="lower"
          noDataReason={`완료된 LOT 없음 (최근 ${KPI_PERIOD_DAYS}일)`}
          note={`1 LOT = ${lotKg ?? '-'}kg`}
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              투입인원 × 작업시간(LOT 시작~종료)
              <br />=
              <Hi>
                {' '}평균 {avgManhour == null ? '-' : avgManhour.toFixed(1)} man-hour (완료 LOT{' '}
                {manhour?.lot_count ?? 0}건)
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              lots (최근 {KPI_PERIOD_DAYS}일)
            </FormulaBox>
          }
        />

        <PerformanceKpiCard
          label="납기 (수주→출하)"
          value={avgLead}
          unit="일"
          baseline={t(targets, 'leadtime_baseline')}
          target={t(targets, 'leadtime_target')}
          direction="lower"
          noDataReason={`출하된 LOT 없음 (최근 ${KPI_PERIOD_DAYS}일)`}
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              출하일 − 수주일
              <br />=
              <Hi>
                {' '}평균 {avgLead == null ? '-' : avgLead.toFixed(1)}일 (출하 LOT{' '}
                {leadtime?.lot_count ?? 0}건)
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              lots (최근 {KPI_PERIOD_DAYS}일)
            </FormulaBox>
          }
        />
      </div>
    </section>
  );
}
