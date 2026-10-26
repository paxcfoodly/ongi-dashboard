import type { ReactNode } from 'react';
import { KpiCard } from '../common/KpiCard';
import { Pill } from '../common/Pill';
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

// 성과지표 카드: 현재값 + "기존 → 목표" + 달성 배지 + 산출식
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
  const status = evaluateKpi(hasValue ? value : null, isNum(target) ? target : null, direction);

  return (
    <KpiCard
      label={label}
      value={hasValue ? value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—'}
      unit={hasValue ? unit : undefined}
      sub={`기존 ${fmtNum(baseline, digits)} → 목표 ${fmtNum(target, digits)} ${unit}`}
      badge={
        status === 'achieved' ? (
          <Pill variant="ok">목표 달성</Pill>
        ) : status === 'missed' ? (
          <Pill variant="warn">미달</Pill>
        ) : undefined
      }
      extra={
        <>
          {!hasValue && <div className="text-[10px] text-text-muted mt-1">{noDataReason}</div>}
          {note && <div className="text-[10px] text-text-muted mt-1">{note}</div>}
        </>
      }
      formula={formula}
    />
  );
}
