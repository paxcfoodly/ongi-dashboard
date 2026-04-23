import { useAiMetrics } from '../hooks/useAiMetrics';
import { KpiCard } from '../components/common/KpiCard';
import { Pill } from '../components/common/Pill';
import { FormulaBox, Hi, FormulaLabel } from '../components/common/FormulaBox';
import { ChartCard, LegendItem } from '../components/common/ChartCard';
import { AiTrendChart } from '../components/charts/AiTrendChart';
import { PrfBarChart } from '../components/charts/PrfBarChart';
import { fmt } from '../utils/formatting';
import { chartColors } from '../lib/chartDefaults';

export function AiPage() {
  const { data: ai, isLoading } = useAiMetrics();
  if (isLoading || !ai) return <div className="text-text-dim">AI 성능지표 로딩 중...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-medium text-text-dim">
        AI 비전검사 성능지표 — 사업계획서 산출식 기준
      </h2>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="① 불량 검출율 (내부지표)"
          value={fmt.pct(ai.defect_detection_pct, 1)}
          badge={<Pill variant="ok">목표 99% — 현장 검증 중</Pill>}
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              (판정 불량수 ÷ 전체 검사수) × 100
              <br />=
              <Hi>
                {' '}({fmt.int(ai.defect_count)} ÷ {fmt.int(ai.total_inspected)}) × 100 ={' '}
                {fmt.pct(ai.defect_detection_pct, 2)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              AI 비전 검사 로그 자동 집계
            </FormulaBox>
          }
        />
        <KpiCard
          label="② 검사 처리량"
          value={fmt.int(ai.throughput_ea_per_hr)}
          unit="ea/hr"
          badge={
            ai.throughput_ea_per_hr >= 1800 ? (
              <Pill variant="ok">목표 1,800 ea/hr 달성</Pill>
            ) : (
              <Pill variant="warn">목표 미달</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              총 검사수량 ÷ 총 검사시간(hr)
              <br />=
              <Hi>
                {' '}{fmt.int(ai.total_inspected)} ÷{' '}
                {(ai.total_inspection_time_sec / 3600).toFixed(2)} ={' '}
                {fmt.int(ai.throughput_ea_per_hr)} ea/hr
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              AI 장비 운영 로그 기반 실측
            </FormulaBox>
          }
        />
        <KpiCard
          label="③ 재검율 (Re-check rate)"
          value={fmt.pct(ai.recheck_rate_pct, 1)}
          badge={
            ai.recheck_rate_pct <= 1.0 ? (
              <Pill variant="ok">정상 범위</Pill>
            ) : (
              <Pill variant="warn">정상범위 이탈</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              (재검 요청 수 ÷ 전체 검사 수) × 100
              <br />=
              <Hi>
                {' '}({fmt.int(ai.unknown_count)} ÷ {fmt.int(ai.total_inspected)}) × 100 ={' '}
                {fmt.pct(ai.recheck_rate_pct, 2)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              판정불가·경계값 분류 데이터
            </FormulaBox>
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <ChartCard
          title="AI 성능 추이 (최근 7일)"
          legend={
            <>
              <LegendItem color={chartColors.good} label="불량검출율 (좌축)" />
              <LegendItem color={chartColors.danger} label="재검율 (우축)" />
            </>
          }
        >
          <AiTrendChart
            labels={['오늘']}
            detection={[ai.defect_detection_pct]}
            recheck={[ai.recheck_rate_pct]}
          />
        </ChartCard>
        <ChartCard
          title="Precision / Recall / F1 목표 대비 현황"
          legend={
            <>
              <LegendItem color={chartColors.primary + '55'} label="목표" />
              <LegendItem color={chartColors.good} label="현재 (mock)" />
            </>
          }
        >
          <PrfBarChart />
        </ChartCard>
      </section>

      <div className="bg-surface border border-border rounded-lg p-4 text-[11px] text-text-dim leading-relaxed">
        <strong className="text-text">모델 성능 기준 (사업계획서 명시)</strong>
        <br />
        Recall 99% 이내 — 불량 1,000개 중 10개 미만 미검출 (현장 적용 가능한 최소 기준) &nbsp;|&nbsp;
        Precision 97% 이내 — 재검사·보조 검사 공정 고려 시 생산성 저하 없이 운용 가능한 범위
        <br />
        F1-Score 0.98 이상 — 검출 정확도와 오검출 억제의 균형 &nbsp;|&nbsp; Accuracy 참고 지표
      </div>
    </div>
  );
}
