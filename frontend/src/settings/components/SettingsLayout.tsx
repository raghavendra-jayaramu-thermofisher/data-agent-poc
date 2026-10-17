import { NavLink, Outlet } from 'react-router';
import { SlidersHorizontal } from 'lucide-react';
const settingsSections = [
  { label: 'Organization Profile', to: '/settings/organization' },
  { label: 'Audit Logs', to: '/settings/audit' },
  { label: 'Operations Diagnostics', to: '/settings/operations' },
] as const;

export function SettingsLayout() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="pb-4 mb-6 border-b border-[var(--db-border-default)]">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal size={20} className="text-[var(--db-primary)]" />
          <h1 className="text-xl font-semibold text-[var(--db-text-primary)]">
            Workspace Settings
          </h1>
        </div>
        <p className="text-xs text-[var(--db-text-secondary)]">
          Workspace governance, membership roles, security audits, and operational diagnostics.
        </p>
      </header>

      <nav className="settings-section-navigation" aria-label="Settings navigation">
        {settingsSections.map(({ label, to }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg p-6 shadow-xs">
        <Outlet />
      </div>
    </div>
  );
}
