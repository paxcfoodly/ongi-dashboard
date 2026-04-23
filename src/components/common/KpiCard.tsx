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
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  badge?: ReactNode;
  accent?: Accent;
  formula?: ReactNode;
  extra?: ReactNode;
}) {
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
