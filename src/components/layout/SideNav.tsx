import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navSearch } from '../../lib/services/period';
import { ADMIN_TABS, MAIN_TABS } from './navItems';

export function SideNav({ showAdmin }: { showAdmin: boolean }) {
  const navRef = useRef<HTMLElement>(null);
  const { pathname, search } = useLocation();

  // 메뉴가 길어 세로 스크롤될 때 현재 메뉴가 보이도록 (마운트·경로 변경 시)
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [pathname, showAdmin]);

  const link = (t: { to: string; label: string }) => (
    <NavLink
      key={t.to}
      to={{ pathname: t.to, search: navSearch(t.to, search) }}
      className={({ isActive }) =>
        `block px-2.5 py-1.5 rounded text-[13px] whitespace-nowrap transition-colors ${
          isActive ? 'bg-primary-light text-text font-bold' : 'text-text-dim hover:text-text hover:bg-surface2'
        }`
      }
    >
      {t.label}
    </NavLink>
  );

  return (
    <nav ref={navRef} aria-label="메뉴" className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
      {MAIN_TABS.map(link)}
      {showAdmin && (
        <>
          <div className="px-2.5 pt-3 pb-1 text-[11px] text-text-muted">관리자</div>
          {ADMIN_TABS.map(link)}
        </>
      )}
    </nav>
  );
}
