import { useKpiData } from '../hooks/useKpiData';
import { useCostRatio } from '../hooks/useCostRatio';
import { KpiCard } from '../components/common/KpiCard';
import { Pill } from '../components/common/Pill';
import { FormulaBox, Hi, FormulaLabel } from '../components/common/FormulaBox';
import { fmt } from '../utils/formatting';

const TARGETS = {
  daily:       15000,
  hourly:      1800,
  workTime:    2.0,
  defect:      1.0,
  cost:        10.0,
  claim:       1,
};

export function KpiPage() {
  const { data: kpi, isLoading } = useKpiData();
  const { data: cost } = useCostRatio();

  if (isLoading || !kpi) {
    return <div className="text-text-dim">KPI 로딩 중...</div>;
  }

  const achievement = (kpi.today_production / TARGETS.daily) * 100;

  return (
    <div className="space-y-4">
      <section
        aria-label="실시간 KPI"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5"
      >
        <KpiCard
          label="오늘 생산량"
          value={fmt.int(kpi.today_production)}
          unit="ea"
          sub={`목표 ${fmt.int(TARGETS.daily)} ea`}
          badge={
            achievement >= 100 ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="warn">{achievement.toFixed(1)}%</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              Σ(삼면포장기 일 생산량)
              <br />= <Hi>{fmt.int(kpi.today_production)} ea</Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              equipment_metrics (1분 집계)
            </FormulaBox>
          }
        />

        <KpiCard
          label="시간당 생산량"
          value={fmt.int(kpi.hourly_production)}
          unit="ea/hr"
          sub={`목표 ${fmt.int(TARGETS.hourly)} ea/hr`}
          badge={
            kpi.hourly_production >= TARGETS.hourly ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="warn">
                {((kpi.hourly_production / TARGETS.hourly) * 100).toFixed(1)}%
              </Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              총 생산수량 ÷ 가동시간(hr)
              <br />=
              <Hi>
                {' '}{fmt.int(kpi.today_production)} ÷{' '}
                {(kpi.runtime_sec_today / 3600).toFixed(2)} ={' '}
                {fmt.int(kpi.hourly_production)} ea/hr
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              삼면포장기
            </FormulaBox>
          }
        />

        <KpiCard
          label="작업시간 / ea"
          value={fmt.sec(kpi.work_time_per_ea)}
          sub={`목표 ${TARGETS.workTime.toFixed(1)}s 이하`}
          badge={
            kpi.work_time_per_ea <= TARGETS.workTime ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="warn">초과</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              총 생산시간 ÷ 총 생산수량
              <br />=
              <Hi>
                {' '}{kpi.runtime_sec_today.toFixed(0)} ÷ {fmt.int(kpi.today_production)} ={' '}
                {fmt.sec(kpi.work_time_per_ea)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              삼면포장기
            </FormulaBox>
          }
        />

        <KpiCard
          label="불량률"
          value={fmt.pct(kpi.defect_rate_pct, 1)}
          sub={`목표 ${TARGETS.defect.toFixed(1)}% 이하 / 불량 ${fmt.int(kpi.defects)}ea`}
          badge={
            kpi.defect_rate_pct <= TARGETS.defect ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="danger">초과</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              불량수 ÷ 전체 검사수 × 100
              <br />=
              <Hi>
                {' '}({fmt.int(kpi.defects)} ÷ {fmt.int(kpi.inspected)}) × 100 ={' '}
                {fmt.pct(kpi.defect_rate_pct, 2)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              AI 비전검사기
            </FormulaBox>
          }
        />

        <KpiCard
          accent="warn"
          label="제조원가 비율"
          value={fmt.pct(cost?.cost_ratio_pct ?? 0, 1)}
          sub={`목표 ${TARGETS.cost}% / 도입 전 15.0%`}
          badge={
            (cost?.cost_ratio_pct ?? 0) <= TARGETS.cost ? (
              <Pill variant="ok">달성</Pill>
            ) : (
              <Pill variant="warn">개선 진행 중</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              (재공재고 ÷ 총 생산수량) × 100
              <br />=
              <Hi>
                {' '}({fmt.int(cost?.wip_total ?? 0)} ÷ {fmt.int(cost?.total_production ?? 0)}) × 100 ={' '}
                {fmt.pct(cost?.cost_ratio_pct ?? 0, 2)}
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              v_cost_ratio
            </FormulaBox>
          }
        />

        <KpiCard
          label="고객 클레임"
          value={fmt.int(kpi.claims_count)}
          unit="건"
          sub={`이번 분기 / 목표 ${TARGETS.claim}건 이하`}
          badge={
            kpi.claims_count <= TARGETS.claim ? (
              <Pill variant="ok">목표 달성</Pill>
            ) : (
              <Pill variant="danger">초과</Pill>
            )
          }
          formula={
            <FormulaBox>
              <FormulaLabel>산출식:</FormulaLabel>
              분기 내 COUNT(claims)
              <br />=
              <Hi>
                {' '}{fmt.int(kpi.claims_count)} 건
              </Hi>
              <br />
              <FormulaLabel>출처:</FormulaLabel>
              claims 테이블 (수기 입력)
            </FormulaBox>
          }
        />
      </section>
    </div>
  );
}
