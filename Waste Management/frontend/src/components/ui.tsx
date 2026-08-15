import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Globe, Info, Loader2, Moon, Sun, X, Inbox } from 'lucide-react';
import { LOCALES, LOCALE_LIST, useI18n } from '../lib/i18n';

/**
 * The shared component layer. Only design tokens cross the portal boundary —
 * layout stays portal-specific (mobile-native for citizen/driver, desktop
 * console for officer/admin), exactly as the plan asks.
 */

export type Tone = 'neutral' | 'info' | 'warn' | 'ok' | 'danger' | 'brand';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border-line bg-sunken text-muted',
  info: 'border-info/25 bg-info/10 text-info',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  ok: 'border-ok/25 bg-ok/10 text-ok',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  brand: 'border-brand/25 bg-brand/10 text-brand',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`chip ${TONE_CLASSES[tone]} ${className}`}>{children}</span>;
}

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-fluid-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-fluid-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** KPI tile. Stacks 2-up on phones, 4-up on desktop via the parent grid. */
export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-fluid-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {icon && <span className={`rounded-lg border p-1.5 ${TONE_CLASSES[tone]}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-fluid-xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-fluid-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand ${className}`} aria-hidden />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-10 text-fluid-sm text-muted">
      <Spinner />
      {label}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <span className="text-faint">{icon ?? <Inbox className="h-8 w-8" />}</span>
      <p className="text-fluid-sm font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-fluid-xs text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 px-6 py-8 text-center">
      <AlertTriangle className="h-7 w-7 text-danger" />
      <p className="text-fluid-sm font-semibold text-danger">{message}</p>
      {onRetry && (
        <button type="button" className="btn-ghost btn-sm mt-1" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Surfaced whenever the API reports `degraded: true`. The plan's honesty line
 * demands we say when a model was not actually available, not hide it.
 */
export function DegradedNotice({ reason }: { reason?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-fluid-xs text-warn">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="font-semibold">AI service unavailable.</span>{' '}
        {reason || 'A local fallback classifier was used — treat this result as unverified.'}
      </p>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 -z-10 cursor-default" aria-label="Close" onClick={onClose} />
      {/* Bottom sheet on phones, centred dialog on larger screens. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92dvh] w-full animate-sheet-up overflow-hidden rounded-t-3xl border border-line bg-elevated shadow-lift
                    sm:animate-fade-up sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h3 className="text-fluid-base font-semibold">{title}</h3>
          <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-sunken" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-line bg-sunken/60 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Toasts ---------------------------------------------------------------

type Toast = { id: number; message: string; tone: Tone };
let pushToast: ((t: Omit<Toast, 'id'>) => void) | null = null;

export const toast = {
  success: (message: string) => pushToast?.({ message, tone: 'ok' }),
  error: (message: string) => pushToast?.({ message, tone: 'danger' }),
  info: (message: string) => pushToast?.({ message, tone: 'info' }),
  warn: (message: string) => pushToast?.({ message, tone: 'warn' }),
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 4200);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:items-end">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-2 rounded-xl border p-3 text-fluid-sm shadow-lift backdrop-blur ${TONE_CLASSES[t.tone]}`}
        >
          {t.tone === 'ok' ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="min-w-0 flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Theme ----------------------------------------------------------------

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('ss_theme', next ? 'dark' : 'light');
  };

  return { dark, toggle };
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className={`grid h-touch w-touch place-items-center rounded-xl border border-line text-muted transition hover:bg-sunken ${className}`}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/**
 * Language switcher. Present in every shell and on every auth screen, because a
 * resident who cannot read English needs to change it *before* signing in, not
 * after.
 */
export function LanguageSwitcher({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        className={`flex min-h-touch items-center gap-1.5 rounded-xl border border-line px-2.5 text-fluid-sm font-semibold text-muted transition hover:bg-sunken ${className}`}
      >
        <Globe className="h-4 w-4 shrink-0" />
        {/* The native name, so it is recognisable to someone who cannot read the current language. */}
        <span className={compact ? 'sr-only' : ''}>{LOCALES[locale].native}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.375rem)] z-50 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-elevated p-1 shadow-lift"
        >
          {LOCALE_LIST.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={locale === code}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-fluid-sm transition ${
                  locale === code ? 'bg-brand/10 font-semibold text-brand' : 'text-ink hover:bg-sunken'
                }`}
              >
                <span>
                  {LOCALES[code].native}
                  {code !== 'en' && <span className="ml-1.5 text-fluid-xs text-faint">{LOCALES[code].label}</span>}
                </span>
                {locale === code && <Check className="h-4 w-4 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Progress meter used for AI confidence and SLA countdowns. */
export function Meter({ value, tone = 'brand', label }: { value: number; tone?: Tone; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const bar = {
    brand: 'bg-brand',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    info: 'bg-info',
    neutral: 'bg-muted',
  }[tone];

  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between text-fluid-xs text-muted">
          <span>{label}</span>
          <span className="tabular-nums font-semibold">{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${bar}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
