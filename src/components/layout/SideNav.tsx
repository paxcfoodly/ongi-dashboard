import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navSearch } from '../../lib/services/period';

const MAIN_TABS = [
  { to: '/kpi',  label: '실시간 KPI' },
  { to: '/ai',   label: 'AI 성능지표' },
  { to: '/cost', label: '원가·납기' },
  { to: '/lot',  label: 'LOT 이력' },
];

const ADMIN_TABS = [
  { to: '/admin/lots',        label: 'LOT 관리' },
  { to: '/admin/claims',      label: '클레임' },
  { to: '/admin/devices',     label: '장비' },
  { to: '/admin/alarm-rules', label: '알람 규칙' },
  { to: '/admin/hr-kpi',      label: '인력 지표' },
  { to: '/admin/targets',     label: '목표값' },
  { to: '/admin/users',       label: '사용자' },
  { to: '/admin/ingest-logs', label: '수신 원본' },
];

export function TabBar({ showAdmin }: { showAdmin: boolean }) {
  const navRef = useRef<HTMLElement>(null);
  const { pathname, search } = useLocation();

  // 탭이 많아 가로 스크롤될 때 현재 탭이 보이도록 (마운트·경로 변경 시)
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [pathname, showAdmin]);

  return (
    <nav ref={navRef} className="hidden md:flex bg-surface border-b border-border px-6 gap-0.5 overflow-x-auto">
      {[...MAIN_TABS, ...(showAdmin ? ADMIN_TABS : [])].map((t) => (
        <NavLink
          key={t.to}
          to={{ pathname: t.to, search: navSearch(t.to, search) }}
          className={({ isActive }) =>
            `px-3 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? 'text-primary border-primary font-medium'
                : 'text-text-dim border-transparent hover:text-text'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
