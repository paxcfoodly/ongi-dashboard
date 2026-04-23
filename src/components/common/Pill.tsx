import type { ReactNode } from 'react';

type Variant = 'ok' | 'warn' | 'danger' | 'info';

const classes: Record<Variant, string> = {
  ok:     'bg-good-light text-good-dark',
  warn:   'bg-warn-light text-warn-dark',
  danger: 'bg-danger-light text-danger-dark',
  info:   'bg-primary-light text-primary-dark',
};

export function Pill({ variant, children }: { variant: Variant; children: ReactNode }) {
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${classes[variant]}`}>
      {children}
    </span>
  );
}
