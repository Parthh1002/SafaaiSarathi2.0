import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, KeyRound, Loader2, Shield, Smartphone, Truck, User, Building2 } from 'lucide-react';
import { api, errorMessage, type Portal, BASE } from '../lib/api';
import { useAuth, HOME_ROUTE } from '../lib/auth';
import { LanguageSwitcher, ThemeToggle, toast } from '../components/ui';
import { useT } from '../lib/i18n';

/**
 * One login screen per portal (plan §3) — no shared screen with a role
 * dropdown. The component is parameterised by portal, but each is mounted at
 * its own route with its own auth provider, so sessions never mix.
 */

interface PortalCopy {
  icon: typeof User;
  accent: string;
  hasNote?: boolean;
}

/** Copy lives in the locale files; only icon and accent stay here. */
const PORTAL_COPY: Record<Portal, PortalCopy> = {
  citizen: { icon: User, accent: 'text-brand' },
  driver: { icon: Truck, accent: 'text-info', hasNote: true },
  officer: { icon: Building2, accent: 'text-warn', hasNote: true },
  admin: { icon: Shield, accent: 'text-danger', hasNote: true },
};

interface DemoAccount {
  name: string;
  email: string;
  phone: string;
  role: string;
}

/**
 * Long, soft ramp so the sharp photo melts into the blurred copy behind it.
 * A short ramp would read as an edge, which is the one thing to avoid here.
 */
const FADE_RIGHT =
  'linear-gradient(to right, #000 0%, #000 42%, rgba(0,0,0,0.85) 58%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.15) 84%, transparent 94%)';

export default function Login({ portal }: { portal: Portal }) {
  const t = useT();
  const copy = PORTAL_COPY[portal];
  const Icon = copy.icon;
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [firstLoginEmail, setFirstLoginEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [demo, setDemo] = useState<{ password: string; accounts: DemoAccount[]; googleEnabled: boolean } | null>(null);

  const isDemo = demo && demo.accounts.length > 0;
  const redirectTo = (location.state as { from?: string })?.from || HOME_ROUTE[portal];

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  useEffect(() => {
    api(portal)
      .get('/auth/demo-accounts')
      .then((r) => setDemo(r.data))
      .catch(() => setDemo(null));
  }, [portal]);

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {

      const { data, status } = await api(portal).post(`/auth/${portal}/login`, { email, password });
      if (status === 202 && data.twoFactorRequired) {
        setChallenge(data.challengeToken);
        toast.info(t('auth.enterAuthCode'));
        return;
      }
      if (data.driverFirstLogin) {
        setFirstLoginEmail(data.email);
        toast.info('A 6-digit verification PIN has been sent to your Gmail.');
        return;
      }
      signIn(data.accessToken, data.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(errorMessage(err, t('auth.signInFailed')));
    } finally {
      setBusy(false);
    }
  }

  async function submitTwoFactor(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api(portal).post('/auth/2fa/verify', { challengeToken: challenge, code, portal });
      signIn(data.accessToken, data.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(errorMessage(err, t('auth.invalidCode')));
    } finally {
      setBusy(false);
    }
  }

  async function submitDriverFirstLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api(portal).post('/auth/driver/first-login-verify', { email: firstLoginEmail, code });
      signIn(data.accessToken, data.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Incorrect verification PIN'));
    } finally {
      setBusy(false);
    }
  }

  const relevantDemo = demo?.accounts.filter((a) => a.role === portal.toUpperCase()).slice(0, 3) ?? [];

  return (
    /*
      The photo covers the whole viewport; the form floats on it as a card.
      A light scrim keeps text legible without washing the picture out, and it
      is built from the `surface` token so it turns dark automatically in the
      AMOLED theme rather than needing a second artwork.
    */
    <div className="relative flex h-dvh flex-col overflow-hidden bg-surface">
      {/*
        Two copies of the same photo, both drawn from the same pixels so the
        colours always agree:

          back  — over-scaled and heavily blurred, filling the whole viewport
          front — sharp, flush to the left edge at natural aspect

        The front copy is faded out with a mask rather than clipped, so it
        dissolves into the blur instead of meeting it at a seam. There is no
        edge anywhere for the eye to read as a partition.
      */}
      <img
        src="/auth-bg.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-125 object-cover blur-3xl"
      />
      <img
        src="/auth-bg.jpg"
        alt=""
        aria-hidden
        className="absolute inset-y-0 left-0 h-full w-auto max-w-none object-cover object-left"
        style={{ maskImage: FADE_RIGHT, WebkitMaskImage: FADE_RIGHT }}
      />
      <div aria-hidden className="absolute inset-0 bg-surface/40" />
      {/* Heavier wash on the left: the brand copy has no card of its own. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/45 to-surface/60 lg:via-surface/30 lg:to-surface/70"
      />

      {/* Top bar floats over the photo. No chip on the logo, so the icon starts
          on exactly the same left edge as the headline below it. */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/icon.svg" alt="" className="h-8 w-8 drop-shadow" />
          <span className="text-fluid-base font-bold tracking-tight">
            Safaai <span className="text-brand">Sarathi</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/" className="btn-ghost btn-sm bg-elevated/80 backdrop-blur">
            <ArrowLeft className="h-4 w-4" /> {t('common.home')}
          </Link>
          <LanguageSwitcher className="bg-elevated/80 backdrop-blur" />
          <ThemeToggle className="bg-elevated/80 backdrop-blur" />
        </div>
      </header>

      {/*
        The page itself never scrolls: it is exactly one viewport tall and the
        content is centred in the space the header leaves. On a genuinely short
        viewport (a phone in landscape) the card scrolls internally rather than
        clipping the sign-in button out of reach.
      */}
      <div className="relative z-10 grid min-h-0 w-full flex-1 items-center gap-6 px-4 pb-4 sm:px-8 lg:grid-cols-2 lg:gap-12">
        {/*
          Brand copy sits directly on the photo — no card. Dropping the panel is
          what lets the text start on the same left edge as the logo above it;
          any padding would have pushed it inwards. The left-hand scrim below
          carries the contrast instead.
        */}
        <section className="hidden max-w-xl lg:block">
          <h2 className="text-fluid-2xl font-bold leading-tight tracking-tight">
            {t(`auth.${portal}.headline`)} <span className="text-brand">{t(`auth.${portal}.highlight`)}</span>
          </h2>
          <p className="mt-3 max-w-lg text-fluid-sm text-muted">{t(`auth.${portal}.blurb`)}</p>

          <ul className="mt-5 space-y-2">
            {[1, 2, 3].map((n) => t(`auth.${portal}.point${n}`)).map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-fluid-sm">
                <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-fluid-xs text-faint">
            {t('auth.orgLine')}
          </p>
        </section>

        {/* Form card */}
        {/*
          An explicit ceiling rather than max-h-full: a grid row sizes itself to
          its content, so a percentage cap here would be circular and the card
          could push past the fold.
        */}
        <main className="mx-auto flex max-h-[calc(100dvh-5.5rem)] w-full max-w-md flex-col overflow-y-auto rounded-3xl border border-line/40 bg-elevated/55 p-5 shadow-lift backdrop-blur-2xl sm:p-7">
          <div className="flex w-full flex-col">
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sunken ${copy.accent}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-fluid-xl font-bold leading-tight tracking-tight">{t(`auth.${portal}.title`)}</h1>
              <p className="mt-0.5 text-fluid-xs text-muted">{t(`auth.${portal}.subtitle`)}</p>
            </div>
          </div>

          {copy.hasNote && (
            <p className="mt-3 rounded-xl border border-line bg-sunken px-3 py-2 text-fluid-xs text-muted">{t(`auth.${portal}.note`)}</p>
          )}

          <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-fluid-xs text-ink">
            <strong>Demo Credentials:</strong> Click any account tag at the bottom to auto-fill, or manually use password: <code className="font-mono select-all font-bold">safaai@2026</code>
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-fluid-xs text-danger">
              {error}
            </p>
          )}

          {/* ---- Two-factor step ---- */}
          {challenge ? (
            <form onSubmit={submitTwoFactor} className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="code">{t('auth.authCode')}</label>
                <input
                  id="code"
                  className="field text-center text-fluid-lg tracking-[0.4em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                  required
                />
              </div>
              <button className="btn-primary w-full" disabled={busy || code.length < 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {t('auth.verifyContinue')}
              </button>
              <button type="button" className="btn-ghost w-full" onClick={() => setChallenge(null)}>
                {t('common.back')}
              </button>
            </form>
          ) : firstLoginEmail ? (
            /* ---- Driver First Login Verify ---- */
            <form onSubmit={submitDriverFirstLogin} className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="code">Email Verification PIN</label>
                <input
                  id="code"
                  className="field text-center text-fluid-lg tracking-[0.4em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                  required
                />
                <p className="mt-1.5 text-fluid-xs text-muted">
                  A 6-digit PIN has been sent to <strong className="text-ink">{firstLoginEmail}</strong>. Please check your inbox and spam folder.
                </p>
              </div>
              <button className="btn-primary w-full" disabled={busy || code.length < 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Verify & Sign In
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => {
                  setFirstLoginEmail(null);
                  setCode('');
                }}
              >
                {t('common.back')}
              </button>
            </form>
          ) : (
            /* ---- Password ---- */
            <form onSubmit={submitPassword} className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="email">{t('auth.email')}</label>
                <input
                  id="email"
                  type="email"
                  className="field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="password">{t('auth.password')}</label>
                <input
                  id="password"
                  type="password"
                  className="field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button className="btn-primary w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('common.signIn')}
              </button>

              {portal === 'citizen' && (
                <>
                  {/* Flex rules rather than an overlapping chip — the card is
                      translucent, so an opaque label would read as a blob. */}
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-fluid-xs text-faint">{t('auth.orDivider')}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <a
                    href={demo?.googleEnabled ? `${BASE}/api/auth/citizen/google` : undefined}
                    onClick={(e) => {
                      if (!demo?.googleEnabled) {
                        e.preventDefault();
                        toast.warn('Google sign-in is not configured. Add GOOGLE_CLIENT_ID to api/.env.');
                      }
                    }}
                    className="btn-ghost w-full"
                  >
                    <GoogleMark /> {t('auth.continueGoogle')}
                  </a>
                  <p className="text-center text-fluid-xs text-muted">
                    {t('auth.newHere')}{' '}
                    <Link to="/register" className="font-semibold text-brand hover:underline">
                      {t('auth.createAccount')}
                    </Link>
                  </p>
                </>
              )}
            </form>
          )}

          {/*
            Seeded accounts as one compact row of chips, so a judge never has to
            guess a password and the card still fits a single screen.
          */}
          {relevantDemo.length > 0 && !challenge && (
            <div className="mt-4 border-t border-dashed border-line pt-3">
              <p className="text-fluid-xs font-medium text-faint">{t('auth.demoAccounts')}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {relevantDemo.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(demo!.password);
                    }}
                    className="rounded-lg border border-line px-2 py-1 text-fluid-xs font-medium text-muted transition hover:border-brand hover:bg-brand/5 hover:text-brand"
                  >
                    {account.email.split('@')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l3.9-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.4 6.6l3.9 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}
