import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Clock } from './Clock';
import { LiveDot } from './LiveDot';
import { MobileNav } from './MobileNav';

export function Header() {
  const { session, role } = useAuth();
  return (
    <header className="relative bg-surface border-b border-border h-14 px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <MobileNav showAdmin={role === 'admin'} />
        <span className="font-mono text-xs text-primary tracking-wider hidden sm:inline">
          PAXC · Foodly
        </span>
        <span className="w-px h-5 bg-border hidden sm:inline-block" />
        <span className="text-sm font-medium text-text">온기코퍼레이션 생산 모니터링</span>
      </div>
      <div className="flex items-center gap-4">
        <LiveDot />
        <Clock />
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-text-dim hover:text-danger"
        >
          {session?.user.email} · 로그아웃
        </button>
      </div>
    </header>
  );
}
