import { useState } from 'react';
import { useCostRatio, useCostRatio7Days } from '../hooks/useCostRatio';
import { useWipFlow } from '../hooks/useWipFlow';
import { FormulaBox, Hi, FormulaLabel } from '../components/common/FormulaBox';
import { Pill } from '../components/common/Pill';
import { ChartCard, LegendItem } from '../components/common/ChartCard';
import { Button } from '../components/common/Button';
import { ResponseModal } from '../components/common/ResponseModal';
import { CostTrendChart } from '../components/charts/CostTrendChart';
import { fmt } from '../utils/formatting';
import { chartColors } from '../lib/chartDefaults';
import { useCostImprovement } from '../hooks/useLlmAnalyze';

export function CostPage() {
  const { data: cost } = useCostRatio();
  const { data: flow = [] } = useWipFlow();
  const { data: trend = [] } = useCostRatio7Days();

  const [llmOpen, setLlmOpen] = useState(false);
  const [llmText, setLlmText] = useState('');
  const llmMut = useCostImprovement();

  const wipTotal   = cost?.wip_total ?? 0;
  const totalProd  = cost?.total_production ?? 0;
  const ratio      = cost?.cost_ratio_pct ?? 0;
  const targetMax  = Math.floor(totalProd * 0.10);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-text-dim mb-1.5">제조원가 비율 (오늘 기준)</div>
            <div className="text-[44px] leading-none font-bold text-warn">
              {fmt.pct(ratio, 1)}
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              목표 10.0% &nbsp;|&nbsp; 도입 전 15.0% &nbsp;|&nbsp; 개선 목표 33%
            </div>
          </div>
          <div>
            <Pill variant="warn">개선 진행 중 — {((15.0 - ratio) / 5.0 * 33).toFixed(1)}% 달성</Pill>
          </div>
        </div>
        <FormulaBox>
          <FormulaLabel>산출식:</FormulaLabel>{' '}
          <Hi>(재공재고 수량 ÷ 총 생산수량) × 100</Hi>
          <br />
          재공재고 = <Hi>AI 전수검사 공정 재공</Hi> + <Hi>내포장 공정 재공</Hi>
          <br />
          총 생산수량 = <Hi>외포장 완료 수량</Hi> 기준 (사업계획서 성과지표 산출식)
        </FormulaBox>
      </section>

      {/* 공정 흐름 */}
      <section>
        <h2 className="text-xs font-medium text-text-dim mb-2">공정별 수량 현황 (실시간)</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {flow.length === 0 ? (
            <div className="text-text-muted text-xs">공정 데이터가 아직 없습니다.</div>
          ) : (
            flow.map((step, i) => (
              <div key={step.from_code} className="flex items-center gap-2">
                <div
                  className={`bg-surface border rounded-lg px-3 py-2 min-w-[120px] text-center ${
                    step.wip_quantity > 0 ? 'border-warn bg-warn-light' : 'border-border'
                  }`}
                >
                  <div className="text-[10px] text-text-dim">{step.from_name}</div>
                  <div className={`text-lg font-bold ${step.wip_quantity > 0 ? 'text-warn' : 'text-text'}`}>
                    {fmt.int(step.input)}
                  </div>
                  {step.wip_quantity > 0 && (
                    <div className="text-[10px] text-warn mt-0.5">
                      재공 {fmt.int(step.wip_quantity)}
                    </div>
                  )}
                </div>
                <span className="text-text-muted text-sm">→</span>
                {i === flow.length - 1 && (
                  <div className="bg-good-light border border-good rounded-lg px-3 py-2 min-w-[120px] text-center">
                    <div className="text-[10px] text-text-dim">{step.to_name}</div>
                    <div className="text-lg font-bold text-good">{fmt.int(step.output)}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* 스탯 카드 4개 */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[11px] text-text-dim">재공재고 합계</div>
          <div className="text-xl font-bold text-warn">{fmt.int(wipTotal)} ea</div>
          <div className="text-[10px] text-text-muted mt-0.5">AI 검사 재공 + 내포장 재공</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[11px] text-text-dim">총 생산수량 (출하완료)</div>
          <div className="text-xl font-bold text-text">{fmt.int(totalProd)} ea</div>
          <div className="text-[10px] text-text-muted mt-0.5">외포장 완료 기준</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[11px] text-text-dim">제조원가 비율</div>
          <div className="text-xl font-bold text-warn">{fmt.pct(ratio, 1)}</div>
          <div className="text-[10px] text-text-muted mt-0.5">
            = {fmt.int(wipTotal)} ÷ {fmt.int(totalProd)} × 100
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[11px] text-text-dim">목표 달성 재공재고 상한</div>
          <div className="text-xl font-bold text-good">≤ {fmt.int(targetMax)} ea</div>
          <div className="text-[10px] text-text-muted mt-0.5">10% 목표 기준</div>
        </div>
      </section>

      {/* 차트 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <ChartCard
          title="제조원가 비율 추이 (최근 7일)"
          legend={
            <>
              <LegendItem color={chartColors.amber} label="실적" />
              <LegendItem color={chartColors.danger} label="목표 10%" />
            </>
          }
        >
          <CostTrendChart points={trend} target={10} />
        </ChartCard>
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text mb-3">공정별 재공재고 비율</h3>
          <div className="space-y-2">
            {flow.filter((s) => s.wip_quantity > 0).map((s) => (
              <div key={s.from_code} className="flex items-center gap-3">
                <div className="text-xs text-text-dim w-24 truncate">{s.from_name}</div>
                <div className="flex-1 bg-surface2 border border-border rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-warn"
                    style={{ width: `${Math.min(100, (s.wip_quantity / wipTotal) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-text-muted font-mono w-16 text-right">
                  {fmt.int(s.wip_quantity)} ea
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="text-center">
        <Button
          variant="secondary"
          onClick={async () => {
            setLlmOpen(true);
            setLlmText('');
            try {
              const r = await llmMut.mutateAsync();
              setLlmText(r.text);
            } catch (e) {
              setLlmText(`실패: ${(e as Error).message}`);
            }
          }}
          disabled={llmMut.isPending}
          className="px-5 py-2"
        >
          {llmMut.isPending ? '분석 중…' : '제조원가 개선 방안 분석 요청'}
        </Button>
      </div>

      <ResponseModal
        open={llmOpen}
        onClose={() => setLlmOpen(false)}
        title="제조원가 개선 방안 분석"
        text={llmText}
        loading={llmMut.isPending}
      />
    </div>
  );
}
