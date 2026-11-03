import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';

// 모바일 전용 상단 막대 (PC는 Sidebar 사용)
export function Header() {
  const { role } = useAuth();
  return (
    <header className="md:hidden relative bg-surface border-b border-border h-14 px-3 flex items-center justify-between gap-2 sticky top-0 z-40">
      <div className="flex items-center gap-2 min-w-0">
        <MobileNav showAdmin={role === 'admin'} />
        <span className="text-[13px] font-bold text-text truncate">온기 생산 모니터링</span>
      </div>
      <div className="flex items-center gap-2 flex-none">
        <ThemeToggle />
        <button onClick={() => supabase.auth.signOut()} className="text-[12px] text-text-dim hover:text-danger-dark">
          로그아웃
        </button>
      </div>
    </header>
  );
}
