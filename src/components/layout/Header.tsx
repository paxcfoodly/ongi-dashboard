import { useAuth } from '../../hooks/useAuth';
import { BRAND } from '../../lib/brand';
import { supabase } from '../../lib/supabase';
import { BrandLogo } from './BrandLogo';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';

// 화면 위쪽 제목 막대. 메뉴·테마 전환·로그아웃은 PC에서 Sidebar에 있고, 모바일에서만 여기에 표시한다
export function Header() {
  const { role } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-border h-14 md:h-16 px-3 md:px-5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <MobileNav showAdmin={role === 'admin'} />
        <BrandLogo />
        <div className="min-w-0">
          <h1 className="text-[13px] md:text-[17px] font-bold text-text leading-snug truncate">{BRAND.title}</h1>
          <div className="hidden md:block font-mono text-[11px] text-primary tracking-wider">{BRAND.subtitle}</div>
        </div>
      </div>
      <div className="md:hidden flex items-center gap-2 flex-none">
        <ThemeToggle />
        <button onClick={() => supabase.auth.signOut()} className="text-[12px] text-text-dim hover:text-danger-dark whitespace-nowrap">
          로그아웃
        </button>
      </div>
    </header>
  );
}
