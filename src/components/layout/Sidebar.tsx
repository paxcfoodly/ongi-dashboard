import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Clock } from './Clock';
import { LiveDot } from './LiveDot';
import { SideNav } from './SideNav';
import { ThemeToggle } from './ThemeToggle';

// PC 화면의 왼쪽 메뉴 (모바일은 Header의 MobileNav 사용)
export function Sidebar() {
  const { session, role } = useAuth();
  return (
    <aside className="hidden md:flex flex-col gap-3 w-[196px] flex-none h-screen sticky top-0 bg-surface border-r border-border px-3 py-4">
      <div className="px-2.5">
        <div className="text-[14px] font-bold text-text leading-snug">온기 생산 모니터링</div>
        <div className="font-mono text-[11px] text-primary tracking-wider mt-0.5">PAXC · Foodly</div>
      </div>
      <SideNav showAdmin={role === 'admin'} />
      <div className="grid gap-2 border-t border-border pt-3">
        <div className="px-1"><LiveDot /></div>
        <div className="px-1 leading-tight [&>span]:text-[11.5px]"><Clock /></div>
        <ThemeToggle />
        <button
          onClick={() => supabase.auth.signOut()}
          title={session?.user.email}
          className="text-[12px] text-text-dim hover:text-danger-dark text-left px-1 truncate"
        >
          {session?.user.email} · 로그아웃
        </button>
      </div>
    </aside>
  );
}
