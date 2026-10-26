import type { ReactNode } from 'react';

type Variant = 'ok' | 'warn' | 'danger' | 'info';

const classes: Record<Variant, string> = {
  ok:     'bg-good-light text-good-dark',
  warn:   'bg-warn-light text-warn-dark',
  danger: 'bg-danger-light text-danger-dark',
  info:   'bg-primary-light text-primary-dark',
};

// size='md'는 가독성이 중요한 배지(성과지표 달성 여부 등)용 11px
export function Pill({
  variant,
  children,
  size = 'sm',
}: {
  variant: Variant;
  children: ReactNode;
  size?: 'sm' | 'md';
}) {
  const text = size === 'md' ? 'text-[11px]' : 'text-[10px]';
  return (
    <span className={`inline-block ${text} px-2 py-0.5 rounded-full ${classes[variant]}`}>
      {children}
    </span>
  );
}
