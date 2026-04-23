import type { ReactNode } from 'react';

export function ChartCard({
  title,
  legend,
  children,
  className = '',
}: {
  title: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text">{title}</h3>
        {legend && <div className="flex gap-3 text-xs text-text-dim">{legend}</div>}
      </div>
      <div className="relative h-[200px]">{children}</div>
    </div>
  );
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
