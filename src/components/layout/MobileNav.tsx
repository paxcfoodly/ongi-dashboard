import { NavLink } from 'react-router-dom';
import { useState } from 'react';

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

export function MobileNav({ showAdmin }: { showAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="메뉴 열기"
        className="px-3 py-2 border border-border rounded text-xs text-text-dim"
      >
        ☰ 메뉴
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full bg-surface border-b border-border shadow z-50">
          {[...MAIN_TABS, ...(showAdmin ? ADMIN_TABS : [])].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-6 py-3 text-sm border-b border-border ${
                  isActive ? 'text-primary font-medium bg-surface2' : 'text-text'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
