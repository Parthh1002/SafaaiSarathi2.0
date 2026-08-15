import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, X, ChevronLeft } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { LanguageSwitcher, ThemeToggle } from './ui';
import { useT } from '../lib/i18n';
import { initials } from '../lib/format';
import { User, Settings, Shield } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number;
}

/**
 * MobileShell — citizen and driver.
 * Bottom tab bar, large touch targets, one primary action per screen. This is
 * deliberately app-shaped, not a shrunk-down dashboard (plan §9).
 */
export function MobileShell({
  nav,
  title,
  children,
  headerRight,
  accent = 'brand',
}: {
  nav: NavItem[];
  title: string;
  children: ReactNode;
  headerRight?: ReactNode;
  accent?: 'brand' | 'info';
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="min-h-dvh bg-surface pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
          <img src="/icon.svg" alt="" className="h-7 w-7 md:hidden" />
          <span className="truncate text-fluid-base font-semibold tracking-tight">{title}</span>

          {/* Desktop gets an inline nav; the phone relies on the tab bar. */}
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-fluid-sm font-medium transition ${
                    isActive
                      ? accent === 'info'
                        ? 'bg-info/10 text-info'
                        : 'bg-brand/10 text-brand'
                      : 'text-muted hover:bg-sunken hover:text-ink'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {headerRight}
            <LanguageSwitcher compact />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid h-touch w-touch place-items-center rounded-xl border border-line"
              aria-label="Account menu"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full text-fluid-xs font-bold text-white" style={{ background: user?.avatarColor || '#15803d' }}>
                {initials(user?.name)}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>

      {/* Bottom tabs — phones only. */}
      <nav className="tabbar" aria-label="Primary">
        {nav.slice(0, 5).map((item) => {
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to} className="tabbar-item" data-active={active}>
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge ? (
                  <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <AccountModal
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        signOut={signOut}
        navigate={navigate}
        t={t}
        portalPath="/app"
      />
    </div>
  );
}

/**
 * ConsoleShell — officer and admin.
 * Sidebar navigation, multi-column layouts, hover states: a desktop console,
 * not a stretched phone screen. It still collapses to a drawer on tablets and
 * phones so an officer can check the queue on the move.
 */
export function ConsoleShell({
  nav,
  title,
  subtitle,
  children,
  headerRight,
  alertCount = 0,
}: {
  nav: NavItem[];
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerRight?: ReactNode;
  alertCount?: number;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-2.5 border-b border-line px-4 py-4">
        <img src="/icon.svg" alt="" className="h-8 w-8" />
        <div className="min-w-0">
          <p className="truncate text-fluid-sm font-bold leading-tight">Safaai Sarathi</p>
          <p className="truncate text-fluid-xs text-muted">{title}</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-fluid-sm font-medium transition ${
                isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-sunken hover:text-ink'
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[0.65rem] font-bold text-white">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-brand/10 group"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fluid-xs font-bold text-white ring-2 ring-transparent transition group-hover:ring-brand/30" style={{ background: user?.avatarColor || '#15803d' }}>
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-fluid-sm font-semibold text-ink group-hover:text-brand">{user?.name}</p>
            <p className="truncate text-fluid-xs text-muted">{user?.ward?.name ?? user?.role}</p>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-elevated lg:block">{sidebar}</aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 animate-slide-in border-r border-line bg-elevated">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              className="grid h-touch w-touch place-items-center rounded-xl border border-line lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-fluid-lg font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="truncate text-fluid-xs text-muted">{subtitle}</p>}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {headerRight}
              <LanguageSwitcher compact />
              {alertCount > 0 && (
                <span className="chip border-danger/30 bg-danger/10 text-danger">
                  <Bell className="h-3.5 w-3.5" />
                  {alertCount}
                </span>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>

      <AccountModal
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        user={user}
        signOut={signOut}
        navigate={navigate}
        t={t}
        portalPath={`/${user?.role?.toLowerCase()}`}
      />
    </div>
  );
}

/** Back link for detail screens on mobile. */
export function BackLink({ to, label = 'Back' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="mb-3 inline-flex items-center gap-1 text-fluid-sm font-medium text-muted hover:text-ink">
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}

/** Reusable Premium Account Modal for all shells */
export function AccountModal({ isOpen, onClose, user, signOut, navigate, t, portalPath = '/app' }: any) {
  if (!isOpen) return null;

  // We check if the user is CITIZEN to show Profile management (other roles might not have a profile page implemented yet).
  const isCitizen = user?.role === 'CITIZEN';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-sm animate-scale-up overflow-hidden rounded-3xl border border-line/60 bg-surface/95 shadow-2xl backdrop-blur-xl">
        {/* Banner */}
        <div className="h-24 w-full bg-gradient-to-br from-brand/80 to-brand-dark/90" />
        
        {/* Avatar */}
        <div className="relative -mt-12 flex justify-center">
          <div className="rounded-full border-4 border-surface bg-surface p-1">
            <span
              className="grid h-20 w-20 place-items-center rounded-full text-3xl font-extrabold text-white shadow-inner"
              style={{ background: user?.avatarColor || '#15803d' }}
            >
              {initials(user?.name)}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="px-6 pb-6 pt-3 text-center">
          <h2 className="text-xl font-bold text-ink">{user?.name}</h2>
          <p className="text-sm text-muted">{user?.email || user?.phone}</p>
          <div className="mx-auto mt-2 flex max-w-fit items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-3 py-1 text-xs font-semibold text-brand">
            <Shield className="h-3.5 w-3.5" />
            {user?.ward?.name ?? user?.role ?? 'Citizen'}
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-2">
            {isCitizen && (
              <button
                type="button"
                onClick={() => { onClose(); navigate(`${portalPath}/profile`); }}
                className="flex w-full items-center justify-between rounded-xl bg-sunken px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-brand/10 hover:text-brand"
              >
                <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Manage Profile</span>
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              className="flex w-full items-center justify-between rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
            >
              <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> {t('common.signOut')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
