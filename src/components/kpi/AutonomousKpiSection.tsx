import { PerformanceKpiCard } from './PerformanceKpiCard';
import { FormulaBox, Hi, FormulaLabel } from '../common/FormulaBox';
import { fmt } from '../../utils/formatting';
import { useLatestHrKpi } from '../../hooks/useHrKpi';

const t = (targets: Record<string, number>, key: string): number | null => {
  const v = targets[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export function AutonomousKpiSection({
  claimsCount,
  targets,
}: {
  claimsCount: number;
  targets: Record<string, number>;
}) {
  const { data: hr } = useLatestHrKpi();
  const conversion = hr?.job_conversion_rate_pct ?? null;
  const satisfaction = hr?.satisfaction_score ?? null;
  const asOf = hr ? `기준일 ${hr.measured_on}` : undefined;

  return (
    <section aria-label="자율 성과지표">
      <h2 className="text-xs font-medium text-text-dim mb-2">자율 성과지표</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <PerformanceKpiCard
          label="인력 직무 전환율"
          value={conversion}
          unit="%"
          baseline={t(targets, 'job_conversion_baseline')}
          target={t(targets, 'job_conversion_target')}
          direction="higher"
          noDataReason="입력된 기록 없음"
          note={asOf}
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              직무 전환 인원 ÷ 대상 인원 × 100
              <br />=
              <Hi> 관리자 입력 최신값 {conversion == null ? '-' : `${conversion.toFixed(1)}%`}</Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              hr_kpi_records (수기 입력)
            </FormulaBox>
          }
        />

        <PerformanceKpiCard
          label="직무 전환 후 만족도"
          value={satisfaction}
          unit="/ 5.0"
          digits={2}
          baseline={t(targets, 'satisfaction_baseline')}
          target={t(targets, 'satisfaction_target')}
          direction="higher"
          noDataReason="입력된 기록 없음"
          note={asOf}
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              전환 인원 만족도 설문 평균 (5점 만점)
              <br />=
              <Hi> 관리자 입력 최신값 {satisfaction == null ? '-' : `${satisfaction.toFixed(2)}점`}</Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              hr_kpi_records (수기 입력)
            </FormulaBox>
          }
        />

        <PerformanceKpiCard
          label="고객 클레임"
          value={claimsCount}
          unit="건"
          digits={0}
          baseline={t(targets, 'claim_quarterly_baseline')}
          target={t(targets, 'claim_quarterly_max')}
          direction="lower"
          noDataReason="클레임 집계 없음"
          note="이번 분기 기준"
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              분기 내 COUNT(claims)
              <br />=
              <Hi> {fmt.int(claimsCount)} 건</Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              claims 테이블 (수기 입력)
            </FormulaBox>
          }
        />
      </div>
    </section>
  );
}
