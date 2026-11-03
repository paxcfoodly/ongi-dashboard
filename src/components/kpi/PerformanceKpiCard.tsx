import { useId, type ReactNode } from 'react';
import { KpiCard } from '../common/KpiCard';
import { useKpiFoldItem } from '../../hooks/useKpiFoldItem';
import { evaluateKpi, type KpiDirection } from '../../utils/kpi';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

// 숫자 포맷 — 값이 없거나 유한하지 않으면 '-'
function fmtNum(v: number | null | undefined, digits = 1): string {
  if (!isNum(v)) return '-';
  return v.toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

export interface PerformanceKpiCardProps {
  label: string;
  value: number | null;
  unit: string;
  digits?: number;
  baseline: number | null;
  target: number | null;
  direction: KpiDirection;
  noDataReason: string;
  formula: ReactNode;
  note?: string;
}

function StatusMark({ achieved }: { achieved: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11.5px] font-bold whitespace-nowrap ${achieved ? 'text-good-dark' : 'text-warn-dark'}`}>
      <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full bg-current" />
      {achieved ? '달성' : '미달'}
    </span>
  );
}

// 성과지표 카드: 현재값 + 달성 여부 + "기존 → 목표". 안내 문구와 산출식은 눌렀을 때만 표시
export function PerformanceKpiCard({
  label,
  value,
  unit,
  digits = 1,
  baseline,
  target,
  direction,
  noDataReason,
  formula,
  note,
}: PerformanceKpiCardProps) {
  const hasValue = isNum(value);
  // 화면에 표시되는 자릿수로 반올림한 값으로 판정한다 (표시값 = 판정값)
  const shown = hasValue ? Number(value.toFixed(digits)) : null;
  const status = evaluateKpi(shown, isNum(target) ? target : null, direction);
  const { open, toggle } = useKpiFoldItem(label);
  const detailId = useId();

  return (
    <KpiCard
      dense
      label={label}
      value={hasValue ? value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—'}
      unit={hasValue ? unit : undefined}
      sub={`기존 ${fmtNum(baseline, digits)} → 목표 ${fmtNum(target, digits)}`}
      badge={status === 'achieved' || status === 'missed' ? <StatusMark achieved={status === 'achieved'} /> : undefined}
      extra={!hasValue && <div className="text-[11px] text-text-dim mt-1">{noDataReason}</div>}
      formula={
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={toggle}
            className="flex items-center gap-1 w-full pt-1.5 pb-1 text-[11.5px] text-text-muted hover:text-text"
          >
            산출식
            <svg aria-hidden="true" viewBox="0 0 10 10" className={`w-[9px] h-[9px] transition-transform ${open ? 'rotate-180' : ''}`}>
              <path d="M1.5 3.2 5 6.8l3.5-3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <div id={detailId} hidden={!open}>
            {open && (
              <div className="pb-1.5">
                {note && <div className="text-[11px] text-text-dim">{note}</div>}
                {formula}
              </div>
            )}
          </div>
        </>
      }
    />
  );
}
