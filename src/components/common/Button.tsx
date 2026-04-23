import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary:   'bg-primary text-white hover:bg-primary-dark disabled:opacity-50',
  secondary: 'bg-surface border border-border text-text hover:border-primary hover:text-primary disabled:opacity-50',
  danger:    'bg-danger text-white hover:bg-danger-dark disabled:opacity-50',
  ghost:     'text-text-dim hover:text-text',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
