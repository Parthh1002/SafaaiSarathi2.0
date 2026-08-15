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
  Zap,
  Sparkles,
  Users,
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

const HERO_IMAGES = [
  // 1. Ahmedabad / Gujarat Clean Urban Corridor
  "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1600&q=80&auto=format&fit=crop",
  // 2. Modern Clean City Riverfront & Architecture
  "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1600&q=80&auto=format&fit=crop",
  // 3. Smart Sustainable Urban Greenery
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&q=80&auto=format&fit=crop",
  // 4. Modern Smart Civic Infrastructure & Roads
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1600&q=80&auto=format&fit=crop",
  // 5. Municipal Cleanliness & Waste Vehicle Logistics
  "https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=1600&q=80&auto=format&fit=crop",
  // 6. Clean City Morning Avenue
  "https://images.unsplash.com/photo-1595278456488-82afcc706243?w=1600&q=80&auto=format&fit=crop"
];



export default function Landing() {
  const t = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    publicApi
      .get<Stats>('/stats')
      .then((r) => setStats(r.data))
      .catch(() => setStats(null));

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    
    // Background image slider (6 seconds interval)
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-surface">
      {/* ---- Nav ---- */}
      <header className="fixed top-0 z-40 w-full transition-all duration-500">
        {/* Tricolor strip — always visible at top */}
        <div className={`flex h-1 w-full transition-all duration-500 ${scrolled ? 'opacity-0 h-0' : 'opacity-100'}`}>
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        {scrolled ? (
          /* Scrolled: centered floating pill */
          <div className="px-4 pt-2.5 sm:px-6">
            <div className="mx-auto flex max-w-5xl items-center justify-between rounded-full bg-surface/95 px-4 py-2 shadow-2xl backdrop-blur-xl ring-1 ring-line/60 sm:px-6">
              {/* Left Brand */}
              <div className="flex items-center gap-2.5 shrink-0">
                <img src="/icon.svg" alt="" className="h-7 w-7 shrink-0" />
                <span className="text-fluid-base font-bold tracking-tight text-ink whitespace-nowrap">
                  Safaai <span className="text-brand">Sarathi</span>
                </span>
              </div>

              {/* Center Nav Links with symbols & whitespace-nowrap */}
              <nav className="hidden md:flex items-center gap-1.5">
                <a
                  href="#how"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-fluid-sm font-medium text-muted transition-all hover:bg-brand/10 hover:text-brand whitespace-nowrap"
                >
                  <Zap className="h-3.5 w-3.5 text-brand" />
                  <span>{t('landing.nav.how')}</span>
                </a>
                <a
                  href="#why"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-fluid-sm font-medium text-muted transition-all hover:bg-brand/10 hover:text-brand whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5 text-brand" />
                  <span>{t('landing.nav.why')}</span>
                </a>
                <a
                  href="#staff"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-fluid-sm font-medium text-muted transition-all hover:bg-brand/10 hover:text-brand whitespace-nowrap"
                >
                  <Building2 className="h-3.5 w-3.5 text-brand" />
                  <span>{t('landing.nav.staff')}</span>
                </a>
              </nav>

              {/* Right Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <LanguageSwitcher compact />
                <ThemeToggle />
                <Link to="/login" className="btn-primary btn-sm rounded-full px-3.5 sm:px-4 py-1.5 text-xs sm:text-fluid-sm font-semibold whitespace-nowrap shadow-sm">
                  {t('common.signIn')}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Not scrolled: full-width white frosted bar with corner-to-corner layout */
          <div className="w-full border-b border-line/30 bg-surface/90 backdrop-blur-md transition-all duration-300">
            <div className="flex w-full items-center justify-between px-3 py-2 sm:px-8 lg:px-12">
              {/* Left: Brand Logo & Title at Left Corner */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="relative flex items-center justify-center">
                  <img src="/icon.svg" alt="" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 transition-transform duration-300 hover:scale-105" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-brand"></span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-fluid-base font-extrabold tracking-tight text-ink whitespace-nowrap leading-none">
                    Safaai <span className="text-brand">Sarathi</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-muted tracking-wider uppercase leading-tight mt-0.5">
                    Civic AI Platform
                  </span>
                </div>
              </div>

              {/* Center: Nav links with unique custom symbols in a sleek pill & strictly single line */}
              <nav className="hidden lg:flex items-center gap-1.5 rounded-full bg-surface/80 px-2 py-1 ring-1 ring-line/50 backdrop-blur-md shadow-sm">
                <a
                  href="#how"
                  className="flex items-center gap-2 rounded-full px-3.5 py-1 text-fluid-sm font-medium text-muted transition-all duration-200 hover:bg-brand/10 hover:text-brand whitespace-nowrap"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-brand text-xs">
                    <Zap className="h-3 w-3" />
                  </span>
                  <span>{t('landing.nav.how')}</span>
                </a>
                <span className="h-3.5 w-px bg-line/60" />
                <a
                  href="#why"
                  className="flex items-center gap-2 rounded-full px-3.5 py-1 text-fluid-sm font-medium text-muted transition-all duration-200 hover:bg-brand/10 hover:text-brand whitespace-nowrap"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-brand text-xs">
                    <Sparkles className="h-3 w-3" />
                  </span>
                  <span>{t('landing.nav.why')}</span>
                </a>
                <span className="h-3.5 w-px bg-line/60" />
                <a
                  href="#staff"
                  className="flex items-center gap-2 rounded-full px-3.5 py-1 text-fluid-sm font-medium text-muted transition-all duration-200 hover:bg-brand/10 hover:text-brand whitespace-nowrap"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-brand text-xs">
                    <Building2 className="h-3 w-3" />
                  </span>
                  <span>{t('landing.nav.staff')}</span>
                </a>
              </nav>

              {/* Right: Actions at Right Corner */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <LanguageSwitcher compact />
                <ThemeToggle />
                <Link
                  to="/login"
                  className="btn-primary btn-sm rounded-full px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-fluid-sm font-semibold shadow-md shadow-brand/20 whitespace-nowrap hover:shadow-lg transition-all"
                >
                  {t('common.signIn')}
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden px-4 pb-10 pt-24 sm:pb-14 sm:pt-28">
        {/* Sliding Background images */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-surface">
          {HERO_IMAGES.map((img, i) => (
            <img
              key={img}
              src={img}
              alt=""
              loading="eager"
              className={`absolute inset-0 h-full w-full object-cover object-center brightness-100 dark:brightness-[0.7] transition-opacity duration-1000 ease-in-out ${
                i === bgIndex ? 'opacity-100 dark:opacity-90' : 'opacity-0'
              }`}
            />
          ))}
          {/* Subtle gradient vignette blending into bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface/10 to-surface dark:from-transparent dark:via-surface/30 dark:to-surface" />
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

        {/* Premium Frosted Glass Hero Container for 100% Guaranteed Contrast & Legibility */}
        <div className="relative mx-auto max-w-4xl rounded-3xl border border-white/50 bg-white/40 p-6 text-center shadow-2xl backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/40 sm:p-10">
          {/* Official government badge row */}
          <div className="mb-3 flex items-center justify-center gap-2">
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-line" />
            <span className="inline-flex items-center gap-2 rounded-full border border-[#FF9933]/30 bg-[#FF9933]/10 px-3.5 py-1 text-fluid-xs font-bold tracking-wide text-[#b35900] dark:border-[#FF9933]/20 dark:bg-[#FF9933]/15 dark:text-[#ffb347]">
              <span className="text-[#000080] dark:text-[#6699ff]">🔵</span>
              भारत सरकार &nbsp;·&nbsp; Government of India
            </span>
            <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-line" />
          </div>

          <span className="chip border-brand/25 bg-brand/10 text-brand">
            <Building2 className="h-3.5 w-3.5" />
            {t('landing.hero.badge')}
          </span>

          <h1 className="mt-3 text-balance text-fluid-3xl font-extrabold leading-[1.15] tracking-tight text-ink">
            {t('landing.hero.title1')} <span className="text-brand">{t('landing.hero.title2')}</span>
          </h1>
          <p className="mx-auto mt-3.5 max-w-2xl text-balance text-fluid-base font-normal text-muted leading-relaxed">
            {t('landing.hero.body')}
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login" className="btn-primary w-full px-6 py-2.5 shadow-lg shadow-brand/25 sm:w-auto">
              {t('landing.hero.cta')} <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#staff" className="btn-ghost w-full px-6 py-2.5 sm:w-auto">{t('landing.hero.staffCta')}</a>
          </div>

          {/* Live impact counters, straight from the database. */}
          <dl className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: t('landing.stat.handled'), value: stats?.complaintsTotal ?? 0, suffix: '' },
              { label: t('landing.stat.rate'), value: stats?.resolutionRatePct ?? 0, suffix: '%' },
              { label: t('landing.stat.avg'), value: stats?.avgResolutionHours ?? 0, suffix: 'h' },
              { label: t('landing.stat.wards'), value: stats?.wards ?? 0, suffix: '' },
            ].map((item) => (
              <div key={item.label} className="card p-3.5 bg-surface/90 border border-line/50 shadow-sm hover:shadow-md transition-shadow">
                <dd className="text-fluid-xl font-extrabold text-ink">
                  {stats ? <Counter value={item.value} suffix={item.suffix} /> : <span className="text-muted">—</span>}
                </dd>
                <dt className="mt-0.5 text-fluid-xs font-medium text-muted">{item.label}</dt>
              </div>
            ))}
          </dl>
          {!stats && (
            <p className="mt-2.5 text-fluid-xs text-faint">
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

          <div className="relative mx-auto mt-12 max-w-4xl">
            {/* Vertical Line */}
            <div className="absolute bottom-4 left-[27px] top-4 w-0.5 bg-brand/20 md:left-1/2 md:-ml-px" />
            
            <div className="space-y-8 md:space-y-12">
              {STEPS.map((step, i) => (
                <div key={step.key} className={`relative flex flex-col md:flex-row md:items-center gap-4 md:gap-8 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                  {/* Timeline Dot */}
                  <div className="absolute left-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand ring-4 ring-elevated md:left-1/2 md:top-1/2 md:-ml-5 md:-mt-5">
                    <step.icon className="h-5 w-5" />
                  </div>
                  
                  {/* Content Card */}
                  <div className={`ml-14 md:ml-0 md:w-1/2 ${i % 2 === 0 ? 'md:pr-12 text-left md:text-right' : 'md:pl-12 text-left'}`}>
                    <div className="card group relative overflow-hidden p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-brand/5 border-transparent hover:border-brand/20">
                      <div className="absolute -right-4 -top-4 opacity-5 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-10">
                        <step.icon className="h-24 w-24" />
                      </div>
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand">Step {i + 1}</span>
                      <h3 className="text-fluid-lg font-bold text-ink">{t(`landing.how.${step.key}.title`)}</h3>
                      <p className="mt-2 text-fluid-sm leading-relaxed text-muted">{t(`landing.how.${step.key}.body`)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
