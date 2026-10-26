import { FormulaBox, Hi, FormulaLabel } from '../common/FormulaBox';
import { Pill } from '../common/Pill';
import { improvementPct, evaluateKpi, KPI_PERIOD_DAYS } from '../../utils/kpi';
import type { LotManhourRow, ManhourKpi } from '../../hooks/useManhourKpi';

const NO_LOT = `완료된 LOT 없음 (최근 ${KPI_PERIOD_DAYS}일)`;

const fmtN = (v: number | null | undefined, d = 1) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

interface Props {
  kpi: ManhourKpi | null | undefined;
  lots: LotManhourRow[];
  baseline: number;
  target: number;
  lotWeightKg: number;
}

// LOT당 작업공수 히어로 + LOT별 표
export function ManhourSection({ kpi, lots, baseline, target, lotWeightKg }: Props) {
  const avg = kpi?.avg_man_hour ?? null;
  const hasValue = typeof avg === 'number' && Number.isFinite(avg);
  const impr = improvementPct(baseline, hasValue ? Number(avg.toFixed(1)) : null, 'lower');
  const goalPct = baseline > 0 ? ((baseline - target) / baseline) * 100 : null;

  return (
    <>
      <section className="bg-surface border border-border rounded-lg p-5">
        <div className="text-xs text-text-dim mb-1.5">LOT당 작업공수 (최근 {KPI_PERIOD_DAYS}일 평균)</div>
        <div className="text-[44px] leading-none font-bold text-text">
          {hasValue ? fmtN(avg, 1) : '—'}
          {hasValue && <span className="text-base font-normal ml-1">man-hour</span>}
        </div>
        <div className="text-[11px] text-text-muted mt-1">기존 {fmtN(baseline, 0)} → 목표 {fmtN(target, 0)} man-hour</div>
        {hasValue ? (
          <div className="text-[11px] text-text-muted mt-0.5">
            개선률 {fmtN(impr, 1)}% / 목표 {fmtN(goalPct, 1)}%
          </div>
        ) : (
          <div className="text-[11px] text-text-muted mt-0.5">{NO_LOT}</div>
        )}
        <FormulaBox>
          <FormulaLabel>산출식:</FormulaLabel>{' '}
          <Hi>작업공수(man-hour) = 투입인원 × 작업시간(LOT 시작~종료)</Hi>
          <br />
          <Hi>1 LOT = {lotWeightKg}kg</Hi>
        </FormulaBox>
      </section>

      <section className="bg-surface border border-border rounded-lg p-4">
        <h2 className="text-sm font-medium text-text mb-3">LOT별 작업공수</h2>
        {lots.length === 0 ? (
          <div className="text-xs text-text-muted">{NO_LOT}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-dim border-b border-border">
                  <th className="py-1.5 pr-3 font-medium">LOT번호</th>
                  <th className="pr-3 font-medium">시작</th>
                  <th className="pr-3 font-medium">종료</th>
                  <th className="pr-3 font-medium text-right">작업시간(h)</th>
                  <th className="pr-3 font-medium text-right">투입인원</th>
                  <th className="pr-3 font-medium text-right">man-hour</th>
                  <th className="font-medium">목표 대비</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const shown = l.man_hour == null ? null : Number(l.man_hour.toFixed(1));
                  const st = evaluateKpi(shown, target, 'lower');
                  return (
                    <tr key={l.id} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3 font-mono">{l.lot_no}</td>
                      <td className="pr-3">{fmtTime(l.started_at)}</td>
                      <td className="pr-3">{fmtTime(l.ended_at)}</td>
                      <td className="pr-3 text-right">{fmtN(l.work_hours, 1)}</td>
                      <td className="pr-3 text-right">{l.worker_count ?? '—'}</td>
                      <td className="pr-3 text-right font-mono">{fmtN(l.man_hour, 1)}</td>
                      <td>
                        {st === 'achieved' && <Pill variant="ok">목표 달성</Pill>}
                        {st === 'missed' && <Pill variant="warn">미달</Pill>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
