type Variant = 'primary' | 'warn' | 'danger';

const fills: Record<Variant, string> = {
  primary: 'bg-primary-gradient',
  warn:    'bg-warn',
  danger:  'bg-danger',
};

export function ProgressBar({
  value,
  max = 100,
  variant = 'primary',
}: {
  value: number;
  max?: number;
  variant?: Variant;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-2 rounded-full bg-surface2 border border-border overflow-hidden">
      <div
        className={`h-full ${fills[variant]} transition-[width]`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
