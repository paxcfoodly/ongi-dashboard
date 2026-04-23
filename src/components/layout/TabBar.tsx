import { NavLink } from 'react-router-dom';

const MAIN_TABS = [
  { to: '/kpi',  label: '실시간 KPI' },
  { to: '/ai',   label: 'AI 성능지표' },
  { to: '/cost', label: '제조원가' },
  { to: '/lot',  label: 'LOT 이력' },
];

const ADMIN_TABS = [
  { to: '/admin/lots',        label: 'LOT 관리' },
  { to: '/admin/claims',      label: '클레임' },
  { to: '/admin/devices',     label: '장비' },
  { to: '/admin/alarm-rules', label: '알람 규칙' },
  { to: '/admin/targets',     label: '목표값' },
  { to: '/admin/users',       label: '사용자' },
];

export function TabBar({ showAdmin }: { showAdmin: boolean }) {
  return (
    <nav className="hidden md:flex bg-surface border-b border-border px-6 gap-0.5 overflow-x-auto">
      {[...MAIN_TABS, ...(showAdmin ? ADMIN_TABS : [])].map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `px-5 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
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
