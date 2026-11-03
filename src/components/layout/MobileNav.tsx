import { NavLink, useLocation } from 'react-router-dom';
import { navSearch } from '../../lib/services/period';
import { useState } from 'react';
import { ADMIN_TABS, MAIN_TABS } from './navItems';

export function MobileNav({ showAdmin }: { showAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const { search } = useLocation();
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
              to={{ pathname: t.to, search: navSearch(t.to, search) }}
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
