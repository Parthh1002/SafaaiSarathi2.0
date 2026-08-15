import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  BrainCircuit,
  Truck,
  ShieldCheck,
  Siren,
  MapPinned,
  TrendingUp,
  Phone,
  MessageCircle,
  Building2,
} from 'lucide-react';
import { publicApi } from '../lib/api';
import { LanguageSwitcher, ThemeToggle } from '../components/ui';
import { useT } from '../lib/i18n';
import { formatNumber } from '../lib/format';

interface Stats {
  city: string;
  complaintsTotal: number;
  complaintsResolved: number;
  resolutionRatePct: number;
  avgResolutionHours: number;
  wards: number;
  vehicles: number;
  citizens: number;
}

/** Counts up to the real value once it arrives — never a decorative number. */
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const duration = 1100;
    let frame: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const decimals = value % 1 !== 0 ? 1 : 0;
  return (
    <span className="tabular-nums">
      {decimals ? shown.toFixed(1) : formatNumber(shown)}
      {suffix}
    </span>
  );
}

const STEPS = [
  { icon: Camera, key: '1' },
  { icon: BrainCircuit, key: '2' },
  { icon: Truck, key: '3' },
  { icon: ShieldCheck, key: '4' },
];

const DIFFERENTIATORS = [
  { icon: Siren, key: '1' },
  { icon: MapPinned, key: '2' },
  { icon: TrendingUp, key: '3' },
  { icon: ShieldCheck, key: '4' },
];

export default function Landing() {
  const t = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    publicApi
      .get<Stats>('/stats')
      .then((r) => setStats(r.data))
      .catch(() => setStats(null));

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-dvh bg-surface">
      {/* ---- Nav ---- */}
      {/* ---- Nav ---- */}
      <header className="fixed top-0 z-40 w-full transition-all duration-500">
        <div className={`transition-all duration-500 ${scrolled ? 'px-4 pt-3 sm:px-8' : 'px-0 pt-0'}`}>
          <div
            className={`mx-auto flex items-center justify-between transition-all duration-500 ${
              scrolled
                ? 'max-w-4xl rounded-full bg-surface/95 px-5 py-2 shadow-xl backdrop-blur-lg ring-1 ring-line/60'
                : 'max-w-6xl border-b border-white/10 bg-surface/80 px-5 py-3 backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <img src="/icon.svg" alt="" className="h-8 w-8 shrink-0" />
              <span className="text-fluid-base font-bold tracking-tight text-ink">
                Safaai <span className="text-brand">Sarathi</span>
              </span>
            </div>

            <nav className="hidden items-center gap-0.5 md:flex">
              {[['#how', t('landing.nav.how')], ['#why', t('landing.nav.why')], ['#staff', t('landing.nav.staff')]].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-full px-3 py-1.5 text-fluid-sm font-medium text-muted transition-colors duration-200 hover:text-brand"
                >{label}</a>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <LanguageSwitcher compact />
              <ThemeToggle />
              <Link
                to="/login"
                className="btn-primary btn-sm ml-1 rounded-full px-4"
              >{t('common.signIn')}</Link>
            </div>
          </div>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden px-4 pb-10 pt-20 sm:pb-14 sm:pt-24">
        {/* Background image — Indian city street with civic workers */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1600&q=85&auto=format&fit=crop&crop=center"
            alt=""
            className="h-full w-full object-cover object-center"
          />
          {/* Multi-stop gradient overlay: 10% → 25% → 50% → 75% → 100% opacity — light mode */}
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              background:
                'linear-gradient(to bottom, rgba(247,247,245,0.10) 0%, rgba(247,247,245,0.25) 20%, rgba(247,247,245,0.52) 45%, rgba(247,247,245,0.78) 68%, rgba(247,247,245,1.00) 100%)',
            }}
          />
          {/* Dark mode overlay */}
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.22) 20%, rgba(0,0,0,0.52) 45%, rgba(0,0,0,0.82) 68%, rgba(0,0,0,1.00) 100%)',
            }}
          />
        </div>
        {/* Indian Government tricolor accent strip */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex h-1">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white dark:bg-white/30" />
          <div className="flex-1 bg-[#138808]" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[60vmin] w-[90vmin] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-4xl text-center">
          {/* Official government badge row */}
          <div className="mb-3 flex items-center justify-center gap-2">
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-line" />
            <span className="inline-flex items-center gap-2 rounded-full border border-[#FF9933]/30 bg-[#FF9933]/8 px-3 py-1 text-fluid-xs font-semibold tracking-wide text-[#b35900] dark:border-[#FF9933]/20 dark:bg-[#FF9933]/10 dark:text-[#ffb347]">
              <span className="text-[#000080] dark:text-[#6699ff]">🔵</span>
              भारत सरकार &nbsp;·&nbsp; Government of India
            </span>
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-line" />
          </div>
          <span className="chip border-brand/25 bg-brand/10 text-brand">
            <Building2 className="h-3.5 w-3.5" />
            {t('landing.hero.badge')}
          </span>

          <h1 className="mt-3 text-balance text-fluid-3xl font-bold leading-[1.1] tracking-tight">
            {t('landing.hero.title1')} <span className="text-brand">{t('landing.hero.title2')}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-balance text-fluid-base text-muted">
            {t('landing.hero.body')}
          </p>

          <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link to="/login" className="btn-primary w-full px-6 sm:w-auto">
              {t('landing.hero.cta')} <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#staff" className="btn-ghost w-full px-6 sm:w-auto">{t('landing.hero.staffCta')}</a>
          </div>

          {/* Live impact counters, straight from the database. */}
          <dl className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: t('landing.stat.handled'), value: stats?.complaintsTotal ?? 0, suffix: '' },
              { label: t('landing.stat.rate'), value: stats?.resolutionRatePct ?? 0, suffix: '%' },
              { label: t('landing.stat.avg'), value: stats?.avgResolutionHours ?? 0, suffix: 'h' },
              { label: t('landing.stat.wards'), value: stats?.wards ?? 0, suffix: '' },
            ].map((item) => (
              <div key={item.label} className="card p-3.5">
                <dd className="text-fluid-xl font-bold text-ink dark:text-white">
                  {stats ? <Counter value={item.value} suffix={item.suffix} /> : <span className="text-muted">—</span>}
                </dd>
                <dt className="mt-0.5 text-fluid-xs text-muted">{item.label}</dt>
              </div>
            ))}
          </dl>
          {!stats && (
            <p className="mt-2 text-fluid-xs text-faint">
              {t('landing.stat.pending')}
            </p>
          )}
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section id="how" className="border-t border-line bg-elevated px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-fluid-2xl font-bold tracking-tight">{t('landing.how.title')}</h2>
            <p className="mt-2 text-fluid-sm text-muted">
              {t('landing.how.body')}
            </p>
          </div>

          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.key} className="card relative p-4">
                <span className="absolute right-3.5 top-3.5 text-fluid-2xl font-bold text-ink/20 dark:text-white/25">{i + 1}</span>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-fluid-base font-semibold">{t(`landing.how.${step.key}.title`)}</h3>
                <p className="mt-1 text-fluid-sm text-muted">{t(`landing.how.${step.key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Differentiators ---- */}
      <section id="why" className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-fluid-2xl font-bold tracking-tight">{t('landing.why.title')}</h2>
            <p className="mt-2 text-fluid-sm text-muted">
              {t('landing.why.body')}
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {DIFFERENTIATORS.map((item) => (
              <div key={item.key} className="card p-4 sm:p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-fluid-base font-semibold">{t(`landing.why.${item.key}.title`)}</h3>
                <p className="mt-1.5 text-fluid-sm text-muted">{t(`landing.why.${item.key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Zero-install channels ---- */}
      <section className="border-y border-line bg-elevated px-4 py-10 sm:py-14">
        <div className="mx-auto grid max-w-6xl items-center gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-fluid-2xl font-bold tracking-tight">{t('landing.channels.title')}</h2>
            <p className="mt-2 text-fluid-sm text-muted">
              {t('landing.channels.body')}
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-fluid-base font-semibold">{t('landing.channels.whatsapp')}</h3>
                  <p className="text-fluid-sm text-muted">{t('landing.channels.whatsappBody')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-fluid-base font-semibold">{t('landing.channels.ivr')}</h3>
                  <p className="text-fluid-sm text-muted">{t('landing.channels.ivrBody')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-fluid-base font-semibold">{t('landing.models.title')}</h3>
            <p className="mt-1.5 text-fluid-sm text-muted">
              {t('landing.models.body')}
            </p>
            <ul className="mt-3 grid gap-1.5 text-fluid-sm">
              {['YOLOv8-nano — waste classification', 'CLIP embeddings — duplicate merging', 'LightGBM — hotspot forecasting', 'OSRM / OR-Tools — route optimisation'].map((t) => (
                <li key={t} className="flex items-center gap-2 text-muted">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Staff entry points ---- */}
      <section id="staff" className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-fluid-2xl font-bold tracking-tight">{t('landing.portals.title')}</h2>
            <p className="mt-2 text-fluid-sm text-muted">
              {t('landing.portals.body')}
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { to: '/driver/login', title: t('landing.portal.driver'), body: t('landing.portal.driverBody'), icon: Truck },
              { to: '/officer/login', title: t('landing.portal.officer'), body: t('landing.portal.officerBody'), icon: MapPinned },
              { to: '/admin/login', title: t('landing.portal.admin'), body: t('landing.portal.adminBody'), icon: ShieldCheck },
            ].map((portal) => (
              <Link key={portal.to} to={portal.to} className="card group p-5 transition hover:shadow-lift">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                  <portal.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 flex items-center gap-1.5 text-fluid-lg font-semibold">
                  {portal.title}
                  <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
                </h3>
                <p className="mt-1.5 text-fluid-sm text-muted">{portal.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Deep-green footer with Indian Government official styling */}
      <footer className="bg-[#0f4d2a] text-white">
        {/* Tricolor top strip */}
        <div className="flex h-1.5">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white/70" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Logo + bilingual name */}
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <div>
              <div className="text-fluid-base font-bold tracking-tight">Safaai Sarathi &nbsp;<span className="font-normal opacity-70">·</span>&nbsp; <span className="font-semibold opacity-90">सफाई सारथी</span></div>
              <div className="text-[0.65rem] font-medium uppercase tracking-widest text-white/60">Government of India &nbsp;·&nbsp; भारत सरकार</div>
            </div>
          </div>

          <p className="mt-3 max-w-2xl text-fluid-xs text-white/75">
            {t('landing.footer.body', { city: stats?.city ?? 'Gandhinagar' })}
          </p>

          <div className="mt-2.5 space-y-0.5 text-fluid-xs text-white/60">
            <p>{t('landing.footer.org')}</p>
            <p>{t('landing.footer.helplines')}</p>
          </div>

          {/* Bottom bar with Ashoka Chakra wheel emoji and copyright */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3">
            <p className="text-fluid-xs text-white/50">
              {t('landing.footer.rights', { year: new Date().getFullYear() })}
            </p>
            <span className="text-fluid-xs text-white/40 flex items-center gap-1.5">
              <span className="text-base">☸️</span> Satyameva Jayate &nbsp;·&nbsp; सत्यमेव जयते
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
