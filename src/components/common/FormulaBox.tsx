import type { ReactNode } from 'react';

export function FormulaBox({ children }: { children: ReactNode }) {
  return <div className="formula-box">{children}</div>;
}

export function Hi({ children }: { children: ReactNode }) {
  return <span className="hi">{children}</span>;
}

export function FormulaLabel({ children }: { children: ReactNode }) {
  return <span className="label">{children}</span>;
}
