import { useMemo } from 'react';
import { useAiMetrics, type AiMetrics } from '../hooks/useAiMetrics';
import { usePeriod } from '../hooks/usePeriod';
import { usePeriodDaily } from '../hooks/usePeriodKpi';
import { PeriodPicker } from '../components/period/PeriodPicker';
import { DailyTable, type DailyColumn } from '../components/period/DailyTable';
import { summarizeDaily, computeRatios, type DailyRow, type Totals } from '../lib/services/periodKpi';
import { KpiCard } from '../components/common/KpiCard';
import { Pill } from '../components/common/Pill';
import { FormulaBox, Hi, FormulaLabel } from '../components/common/FormulaBox';
import { ChartCard, LegendItem } from '../components/common/ChartCard';
import { AiTrendChart } from '../components/charts/AiTrendChart';
import { PrfBarChart } from '../components/charts/PrfBarChart';
import { fmt } from '../utils/formatting';
import { chartColors } from '../lib/chartDefaults';

const DASH = '—';

// 값이 없으면 em dash, 있으면 포맷터 적용
const show = (v: number | null, f: (n: number) => string): string => (v == null ? DASH : f(v));
const pct2 = (n: number) => `${n.toFixed(2)}%`;

// 기간 총합을 오늘 모드 카드가 쓰는 AiMetrics 형태로 매핑 (비율 null → 0)
function toAiMetrics(t: Totals): AiMetrics {
  return {
    total_inspected: t.inspected,
    defect_count: t.defects,
    unknown_count: t.unknown,
    total_inspection_time_sec: t.inspection_time_sec,
    defect_detection_pct: t.defect_rate_pct ?? 0,
    throughput_ea_per_hr: t.throughput_ea_per_hr ?? 0,
    recheck_rate_pct: t.recheck_rate_pct ?? 0,
  };
}

export function AiPage() {
  const { period } = usePeriod();
  const { data: today, isLoading } = useAiMetrics();
  const { data: daily, isLoading: dailyLoading, isError: dailyError } = usePeriodDaily(period);
  const rows = useMemo<DailyRow[]>(() => daily ?? [], [daily]);
  const totals = useMemo(() => summarizeDaily(rows), [rows]);

  // 기간 모드 일별 RPC 실패 시 무한 로딩 대신 오류 안내
  if (period && dailyError) {
    return (
      <div role="alert" className="bg-surface border border-danger rounded-lg p-3 text-sm text-danger">
        기간 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }
  // 로딩 조기 반환: 오늘 모드는 오늘 지표, 기간 모드는 일별 데이터 기준
  if (period ? dailyLoading || !daily : isLoading || !today) {
    return <div className="text-text-dim">AI 성능지표 로딩 중...</div>;
  }
  const ai = period ? toAiMetrics(totals) : today!;

  const columns: DailyColumn<DailyRow>[] = [
    { header: '검사수', agg: 'sum', cell: (r) => fmt.int(r.inspected), total: fmt.int(totals.inspected) },
    { header: '불량수', agg: 'sum', cell: (r) => fmt.int(r.defects), total: fmt.int(totals.defects) },
    { header: '재검수', agg: 'sum', cell: (r) => fmt.int(r.unknown), total: fmt.int(totals.unknown) },
    {
      header: '검사시간(h)', agg: 'sum',
      cell: (r) => (r.inspection_time_sec / 3600).toFixed(1),
      total: (totals.inspection_time_sec / 3600).toFixed(1),
    },
    {
      header: '불량 검출율', agg: 'avg',
      cell: (r) => show(computeRatios(r).defect_rate_pct, pct2), total: show(totals.defect_rate_pct, pct2),
    },
    {
      header: '처리량', agg: 'avg',
      cell: (r) => show(computeRatios(r).throughput_ea_per_hr, (n) => fmt.int(n)),
      total: show(totals.throughput_ea_per_hr, (n) => fmt.int(n)),
    },
    {
      header: '재검율', agg: 'avg',
      cell: (r) => show(computeRatios(r).recheck_rate_pct, pct2), total: show(totals.recheck_rate_pct, pct2),
    },
  ];

  return (
    <div className="space-y-4">
      <PeriodPicker />
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
          title={period ? 'AI 성능 추이 (선택 기간)' : 'AI 성능 추이 (최근 7일)'}
          legend={
            <>
              <LegendItem color={chartColors.good} label="불량검출율 (좌축)" />
              <LegendItem color={chartColors.danger} label="재검율 (우축)" />
            </>
          }
        >
          {period ? (
            <AiTrendChart
              labels={rows.map((r) => r.day.slice(5))}
              detection={rows.map((r) => computeRatios(r).defect_rate_pct)}
              recheck={rows.map((r) => computeRatios(r).recheck_rate_pct)}
            />
          ) : (
            <AiTrendChart
              labels={['오늘']}
              detection={[ai.defect_detection_pct]}
              recheck={[ai.recheck_rate_pct]}
            />
          )}
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

      {period && (
        <DailyTable title="날짜별 AI 성능" rows={rows} columns={columns} csvFileName={`AI성능_날짜별_${period.from}_${period.to}.csv`} />
      )}

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
