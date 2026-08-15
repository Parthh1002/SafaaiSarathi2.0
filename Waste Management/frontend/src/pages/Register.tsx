import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LanguageSwitcher, ThemeToggle, toast } from '../components/ui';
import { useT } from '../lib/i18n';

/** Citizen self-registration. Staff accounts are provisioned by an admin only. */
export default function Register() {
  const t = useT();
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', language: 'en' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api('citizen').post('/auth/citizen/register', {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        language: form.language,
      });
      signIn(data.accessToken, data.user);
      toast.success(t('register.welcome'));
      if (data.devVerificationLink) console.info('Verification link:', data.devVerificationLink);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(errorMessage(err, t('register.failed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-dvh bg-surface px-5 py-6 sm:px-8">
      {/* Same photo wash as the login screens, so the auth flow feels of a piece. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
        <img src="/auth-bg.jpg" alt="" className="h-full w-full object-cover object-[30%_35%] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/50 via-surface/85 to-surface" />
      </div>

      <div className="relative flex items-center justify-between">
        <Link to="/login" className="btn-ghost btn-sm gap-1.5 border-0 px-2">
          <ArrowLeft className="h-4 w-4" /> {t('common.signIn')}
        </Link>
        <div className="flex items-center gap-2"><LanguageSwitcher compact /><ThemeToggle /></div>
      </div>

      <div className="relative mx-auto w-full max-w-sm py-8">
        <img src="/icon.svg" alt="" className="h-12 w-12" />
        <h1 className="mt-5 text-fluid-2xl font-bold tracking-tight">{t('register.title')}</h1>
        <p className="mt-1.5 text-fluid-sm text-muted">
          {t('register.subtitle')}
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-fluid-sm text-danger">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">{t('auth.fullName')}</label>
            <input
              id="name"
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="name"
              required
              minLength={2}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              className="field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">{t('register.phoneOptional')}</label>
            <input
              id="phone"
              className="field"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 12) })}
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">{t('auth.password')}</label>
            <input
              id="password"
              type="password"
              className="field"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              required
              minLength={8}
            />
            <p className="mt-1.5 text-fluid-xs text-muted">{t('register.passwordHint')}</p>
          </div>
          <div>
            <label className="label">{t('register.preferredLanguage')}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'en', label: 'English' },
                { id: 'hi', label: 'हिन्दी' },
                { id: 'gu', label: 'ગુજરાતી' },
              ].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setForm({ ...form, language: l.id })}
                  className={`min-h-touch rounded-xl border text-fluid-sm font-semibold transition ${
                    form.language === l.id ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-elevated text-muted'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {t('register.submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-fluid-sm text-muted">
          {t('auth.alreadyRegistered')}{' '}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            {t('common.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
