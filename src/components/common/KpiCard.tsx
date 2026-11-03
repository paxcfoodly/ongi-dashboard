import type { ReactNode } from 'react';

type Accent = 'neutral' | 'warn' | 'ok';

const accents: Record<Accent, string> = {
  neutral: '',
  warn:    'bg-warn-light border-warn',
  ok:      'bg-good-light border-good',
};

export function KpiCard({
  label,
  value,
  unit,
  sub,
  badge,
  accent = 'neutral',
  formula,
  extra,
  dense = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  badge?: ReactNode;
  accent?: Accent;
  formula?: ReactNode;
  extra?: ReactNode;
  // 한 줄에 4개를 놓는 성과지표용 촘촘한 표시
  dense?: boolean;
}) {
  if (dense) {
    return (
      <div className={`kpi-dense bg-surface2 rounded px-3 pt-2.5 pb-1.5 flex flex-col min-w-0 ${accents[accent]}`}>
        <div className="text-[12px] text-text-dim mb-1">{label}</div>
        <div className="flex justify-between items-baseline gap-1.5">
          <div className="text-[21px] font-bold text-text leading-tight tabular-nums whitespace-nowrap">
            {value}
            {unit && <span className="text-[11.5px] font-normal text-text-dim ml-0.5">{unit}</span>}
          </div>
          {badge}
        </div>
        {sub && <div className="text-[11.5px] text-text-muted mt-0.5 tabular-nums">{sub}</div>}
        {extra}
        {formula}
      </div>
    );
  }
  return (
    <div
      className={`bg-surface border border-border rounded-lg p-4 flex flex-col ${accents[accent]}`}
    >
      <div className="text-[11px] text-text-dim mb-1.5">{label}</div>
      <div className="text-2xl font-bold text-text leading-none">
        {value}
        {unit && <span className="text-sm font-normal ml-0.5">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-text-muted mt-1">{sub}</div>}
      {badge && <div className="mt-1.5">{badge}</div>}
      {extra}
      {formula && <div className="mt-auto">{formula}</div>}
    </div>
  );
}
