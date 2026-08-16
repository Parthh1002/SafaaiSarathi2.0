import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, X, ChevronLeft, User, Settings, Shield, Sparkles, Navigation } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { LanguageSwitcher, ThemeToggle } from './ui';
import { useT } from '../lib/i18n';
import { initials } from '../lib/format';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number;
}

/**
 * MobileShell — Citizen and Driver.
 * Fully responsive: Rich desktop command web interface on laptop/desktop screens
 * with multi-column responsiveness, and thumb-friendly mobile app layout on phones.
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
  accent?: 'brand' | 'orange';
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="min-h-dvh bg-surface pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 pt-[env(safe-area-inset-top)] shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo & Portal Title */}
          <div className="flex items-center gap-3">
            <Link to={user?.role === 'DRIVER' ? '/driver' : '/app'} className="flex items-center gap-2.5 group">
              <img src="/icon.svg" alt="Safaai Sarathi" className="h-8 w-8 transition group-hover:scale-105" />
              <div>
                <span className="hidden sm:block text-fluid-sm font-extrabold tracking-tight text-ink">
                  Safaai Sarathi
                </span>
                <span
                  className={`block text-fluid-xs font-semibold ${
                    accent === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-brand'
                  }`}
                >
                  {title}
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 rounded-2xl border border-line bg-elevated/70 p-1 shadow-xs backdrop-blur">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-fluid-xs font-semibold transition ${
                    isActive
                      ? accent === 'orange'
                        ? 'bg-orange-600 text-white shadow-sm font-bold'
                        : 'bg-brand text-brand-ink shadow-sm font-bold'
                      : 'text-muted hover:bg-sunken hover:text-ink'
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {headerRight}
            <LanguageSwitcher compact />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-line bg-elevated p-1.5 pr-2.5 transition hover:bg-sunken shadow-xs"
              aria-label="Account menu"
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fluid-xs font-bold text-white shadow-xs"
                style={{ background: user?.avatarColor || (accent === 'orange' ? '#ea580c' : '#15803d') }}
              >
                {initials(user?.name)}
              </span>
              <span className="hidden lg:block text-fluid-xs font-semibold text-ink max-w-[100px] truncate">
                {user?.name?.split(' ')[0]}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</main>

      {/* Bottom tabs — Mobile & Tablet only */}
      <nav className="tabbar md:hidden" aria-label="Primary">
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
              <span>{item.label}</span>
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
        portalPath={user?.role === 'DRIVER' ? '/driver' : '/app'}
      />
    </div>
  );
}

/**
 * ConsoleShell — Officer and Admin.
 * Uses the exact same unified top navbar format on desktop, with responsive container.
 * Accent:
 *   - 'brand' (Green) for Officer
 *   - 'orange' (Orange #ea580c) for Super Admin
 */
export function ConsoleShell({
  nav,
  title,
  subtitle,
  children,
  headerRight,
  alertCount = 0,
  accent = 'brand',
}: {
  nav: NavItem[];
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerRight?: ReactNode;
  alertCount?: number;
  accent?: 'brand' | 'orange';
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-surface pb-10">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 pt-[env(safe-area-inset-top)] shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo & Console Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-line xl:hidden text-ink"
              aria-label="Open Navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link
              to={accent === 'orange' ? '/admin' : '/officer'}
              className="flex items-center gap-2.5 group"
            >
              <img src="/icon.svg" alt="Safaai Sarathi" className="h-8 w-8 transition group-hover:scale-105" />
              <div>
                <span className="hidden sm:block text-fluid-sm font-extrabold tracking-tight text-ink">
                  Safaai Sarathi
                </span>
                <span
                  className={`block text-fluid-xs font-semibold ${
                    accent === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-brand'
                  }`}
                >
                  {title}
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 rounded-2xl border border-line bg-elevated/70 p-1 shadow-xs backdrop-blur">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-fluid-xs font-semibold transition ${
                    isActive
                      ? accent === 'orange'
                        ? 'bg-orange-600 text-white shadow-sm font-bold'
                        : 'bg-brand text-brand-ink shadow-sm font-bold'
                      : 'text-muted hover:bg-sunken hover:text-ink'
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {headerRight}
            {alertCount > 0 && (
              <span className="chip border-danger/30 bg-danger/10 text-danger text-fluid-xs font-bold">
                <Bell className="h-3.5 w-3.5" />
                {alertCount}
              </span>
            )}
            <LanguageSwitcher compact />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-line bg-elevated p-1.5 pr-2.5 transition hover:bg-sunken shadow-xs"
              aria-label="Account menu"
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fluid-xs font-bold text-white shadow-xs"
                style={{ background: user?.avatarColor || (accent === 'orange' ? '#ea580c' : '#15803d') }}
              >
                {initials(user?.name)}
              </span>
              <span className="hidden lg:block text-fluid-xs font-semibold text-ink max-w-[110px] truncate">
                {user?.name?.split(' ')[0]}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation for Tablet / Mobile */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full bg-elevated border-r border-line p-4 space-y-4 animate-slide-in flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <img src="/icon.svg" alt="" className="h-7 w-7" />
                <span className="font-bold text-fluid-sm text-ink">{title}</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="p-1 text-muted hover:bg-sunken rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1 flex-1 overflow-y-auto">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-fluid-sm font-semibold transition ${
                      isActive
                        ? accent === 'orange'
                          ? 'bg-orange-600 text-white shadow-sm'
                          : 'bg-brand text-brand-ink shadow-sm'
                        : 'text-muted hover:bg-sunken hover:text-ink'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[0.65rem] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</main>

      <AccountModal
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        signOut={signOut}
        navigate={navigate}
        t={t}
        portalPath={accent === 'orange' ? '/admin' : '/officer'}
      />
    </div>
  );
}

export function BackLink({ to, label }: { to: string; label?: string }) {
  const t = useT();
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-fluid-xs font-semibold text-muted transition hover:bg-sunken hover:text-ink"
    >
      <ChevronLeft className="h-4 w-4" />
      {label ?? t('common.back')}
    </Link>
  );
}

function AccountModal({
  isOpen,
  onClose,
  user,
  signOut,
  navigate,
  t,
  portalPath,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  signOut: () => Promise<void>;
  navigate: (to: string) => void;
  t: (key: string) => string;
  portalPath: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-elevated p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h2 className="text-fluid-base font-bold text-ink">{t('common.account') || 'Account'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-sunken">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-fluid-base font-bold text-white shadow-sm"
            style={{ background: user?.avatarColor || '#15803d' }}
          >
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-fluid-sm text-ink truncate">{user?.name}</p>
            <p className="text-fluid-xs text-muted truncate">{user?.email || user?.phone}</p>
            <span className="inline-block mt-0.5 rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wider">
              {user?.role}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {user?.role === 'CITIZEN' && (
            <button
              onClick={() => {
                onClose();
                navigate('/app/profile');
              }}
              className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5 text-fluid-xs font-semibold text-ink transition hover:bg-sunken"
            >
              <User className="h-4 w-4 text-muted" />
              <span>Edit Profile & Language</span>
            </button>
          )}

          <button
            onClick={async () => {
              onClose();
              await signOut();
              navigate('/login');
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-fluid-xs font-semibold text-danger transition hover:bg-danger/20"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
