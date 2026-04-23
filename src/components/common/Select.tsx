import type { SelectHTMLAttributes } from 'react';

interface Option {
  value: string;
  label: string;
}

export function Select({
  options,
  error,
  className = '',
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; error?: boolean }) {
  return (
    <select
      className={`w-full border rounded px-2.5 py-1.5 text-xs bg-surface focus:outline-none ${
        error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary'
      } ${className}`}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
