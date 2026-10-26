import { useState } from 'react';
import { Button } from '../components/common/Button';
import { ResponseModal } from '../components/common/ResponseModal';
import { ManhourSection } from '../components/cost/ManhourSection';
import { LeadtimeSection } from '../components/cost/LeadtimeSection';
import { useCostImprovement } from '../hooks/useLlmAnalyze';
import { useKpiTargets } from '../hooks/useKpiTargets';
import {
  useManhourKpi,
  useLeadtimeKpi,
  useRecentLotManhours,
  useRecentLotLeadtimes,
} from '../hooks/useManhourKpi';

export function CostPage() {
  const { data: targets = {}, isError: targetsError } = useKpiTargets();
  const { data: manhour } = useManhourKpi();
  const { data: leadtime } = useLeadtimeKpi();
  const { data: manhourLots = [] } = useRecentLotManhours(10);
  const { data: leadLots = [] } = useRecentLotLeadtimes(10);

  const [llmOpen, setLlmOpen] = useState(false);
  const [llmText, setLlmText] = useState('');
  const llmMut = useCostImprovement();

  return (
    <div className="space-y-4">
      {/* 목표값 조회 실패 시 KpiPage와 같은 문구로 안내 */}
      {targetsError && (
        <div role="alert" className="bg-surface border border-danger rounded-lg p-3 text-sm text-danger">
          목표값을 불러오지 못했습니다 — 새로고침 해주세요
        </div>
      )}
      <ManhourSection
        kpi={manhour}
        lots={manhourLots}
        baseline={targets.manhour_baseline}
        target={targets.manhour_target}
        lotWeightKg={targets.lot_weight_kg}
      />
      <LeadtimeSection
        kpi={leadtime}
        lots={leadLots}
        baseline={targets.leadtime_baseline}
        target={targets.leadtime_target}
      />

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
          {llmMut.isPending ? '분석 중…' : '원가(작업공수) 개선 방안 분석 요청'}
        </Button>
      </div>

      <ResponseModal
        open={llmOpen}
        onClose={() => setLlmOpen(false)}
        title="원가(작업공수) 개선 방안 분석"
        text={llmText}
        loading={llmMut.isPending}
      />
    </div>
  );
}
