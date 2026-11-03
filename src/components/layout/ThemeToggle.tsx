import { toggleTheme, useTheme } from '../../lib/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`bg-surface2 border border-border rounded px-2.5 py-1 text-[12.5px] text-text whitespace-nowrap hover:border-border-strong ${className}`}
    >
      {theme === 'dark' ? '밝은 테마' : '어두운 테마'}
    </button>
  );
}
