import { FormulaBox, Hi, FormulaLabel } from '../common/FormulaBox';
import type { LeadtimeKpi, LotLeadtimeRow } from '../../hooks/useManhourKpi';
import { KPI_PERIOD_DAYS } from '../../utils/kpi';

const NO_SHIP = `출하 완료된 LOT 없음 (최근 ${KPI_PERIOD_DAYS}일)`;

const fmtN = (v: number | null | undefined, d = 1) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

interface Props {
  kpi: LeadtimeKpi | null | undefined;
  lots: LotLeadtimeRow[];
  // 목표값 로딩 전·조회 실패 시 undefined — 화면에는 '—'로 표시
  baseline: number | undefined;
  target: number | undefined;
}

// 납기(수주→출하) 히어로 + LOT별 리드타임 표
export function LeadtimeSection({ kpi, lots, baseline, target }: Props) {
  const avg = kpi?.avg_lead_days ?? null;
  const hasValue = typeof avg === 'number' && Number.isFinite(avg);

  return (
    <section className="bg-surface border border-border rounded-lg p-5">
      <h2 className="text-xs text-text-dim mb-1.5">납기 (수주→출하)</h2>
      <div className="text-[32px] leading-none font-bold text-text">
        {hasValue ? fmtN(avg, 1) : '—'}
        {hasValue && <span className="text-base font-normal ml-1">일</span>}
      </div>
      <div className="text-[11px] text-text-muted mt-1">기존 {fmtN(baseline, 0)} → 목표 {fmtN(target, 0)}일</div>
      {!hasValue && <div className="text-[11px] text-text-muted mt-0.5">{NO_SHIP}</div>}
      <FormulaBox>
        <FormulaLabel>산출식:</FormulaLabel> <Hi>리드타임(일) = 출하일 − 수주일</Hi>
      </FormulaBox>
      {lots.length === 0 ? (
        <div className="text-xs text-text-muted mt-3">{NO_SHIP}</div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <h3 className="text-xs font-medium text-text-dim mb-1.5">LOT별 리드타임 (최근 {KPI_PERIOD_DAYS}일 · 최근 10건)</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-dim border-b border-border">
                <th className="py-1.5 pr-3 font-medium">LOT번호</th>
                <th className="pr-3 font-medium">수주일</th>
                <th className="pr-3 font-medium">출하일</th>
                <th className="font-medium text-right">리드타임</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-3 font-mono">{l.lot_no}</td>
                  <td className="pr-3">{l.ordered_at ?? '—'}</td>
                  <td className="pr-3">{l.shipped_at ?? '—'}</td>
                  <td className="text-right font-mono">{l.lead_days == null ? '—' : `${l.lead_days}일`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
