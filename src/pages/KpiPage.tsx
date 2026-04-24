import { useKpiData } from '../hooks/useKpiData';
import { useCostRatio } from '../hooks/useCostRatio';
import { KpiCard } from '../components/common/KpiCard';
import { Pill } from '../components/common/Pill';
import { FormulaBox, Hi, FormulaLabel } from '../components/common/FormulaBox';
import { fmt } from '../utils/formatting';
import { ProgressBar } from '../components/common/ProgressBar';
import { StatusDot } from '../components/common/StatusDot';
import { ChartCard, LegendItem } from '../components/common/ChartCard';
import { HourlyProductionChart } from '../components/charts/HourlyProductionChart';
import { CostTrendChart } from '../components/charts/CostTrendChart';
import { useHourlyProduction } from '../hooks/useKpiData';
import { useCostRatio7Days } from '../hooks/useCostRatio';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useAlarms } from '../hooks/useAlarms';
import { chartColors } from '../lib/chartDefaults';

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
  const { data: hourly } = useHourlyProduction();
  const { data: costTrend } = useCostRatio7Days();
  const { data: devices } = useDeviceStatus();
  const { data: alarms } = useAlarms(4);

  if (isLoading || !kpi) {
    return <div className="text-text-dim">KPI 로딩 중...</div>;
  }

  const achievement = (kpi.today_production / TARGETS.daily) * 100;

  return (
    <div className="space-y-4">
      <section
        aria-label="실시간 KPI"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
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

      <section className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-dim">오늘 목표 달성률</span>
            <strong className="text-sm text-text">
              {achievement.toFixed(1)}% ({fmt.int(kpi.today_production)} / {fmt.int(TARGETS.daily)} ea)
            </strong>
          </div>
          <ProgressBar value={kpi.today_production} max={TARGETS.daily} variant={achievement >= 100 ? 'primary' : 'warn'} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-dim">제조원가 개선률</span>
            <strong className="text-sm text-text">
              {(cost ? ((15.0 - cost.cost_ratio_pct) / (15.0 - TARGETS.cost)) * 100 : 0).toFixed(1)}% / 목표 33.0%
            </strong>
          </div>
          <ProgressBar
            value={cost ? ((15.0 - cost.cost_ratio_pct) / (15.0 - TARGETS.cost)) * 100 : 0}
            max={100}
            variant="warn"
          />
        </div>
      </section>

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
              <LegendItem color={chartColors.gray} label="목표 1,800" />
            </>
          }
        >
          <HourlyProductionChart buckets={hourly ?? []} target={TARGETS.hourly} />
        </ChartCard>
        <ChartCard
          title="제조원가 비율 추이 (최근 7일)"
          legend={
            <>
              <LegendItem color={chartColors.amber} label="실적" />
              <LegendItem color={chartColors.danger} label="목표 10%" />
            </>
          }
        >
          <CostTrendChart points={costTrend ?? []} target={TARGETS.cost} />
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
