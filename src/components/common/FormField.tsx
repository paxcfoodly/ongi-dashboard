import type { InputHTMLAttributes, ReactNode } from 'react';

export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-text-dim block mb-1">{label}</span>
      {children}
      {hint && !error && <span className="text-[10px] text-text-muted block mt-1">{hint}</span>}
      {error && <span className="text-[10px] text-danger block mt-1">{error}</span>}
    </label>
  );
}

export function TextInput({
  error,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none ${
        error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary'
      } ${className}`}
      {...rest}
    />
  );
}

export function TextArea({
  error,
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none min-h-[60px] ${
        error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary'
      } ${className}`}
      {...rest}
    />
  );
}
