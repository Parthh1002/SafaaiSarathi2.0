import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Camera,
  Siren,
  Truck,
  Trophy,
  ArrowRight,
  MapPin,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  HelpCircle,
  Award,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, SectionTitle, Stat } from '../../components/ui';
import { STATUS_LABELS, STATUS_TONE, CATEGORY_LABELS, timeAgo, formatDistance } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';

export default function CitizenHome() {
  const t = useT();
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['citizen', 'home'],
    queryFn: async () => (await api('citizen').get('/citizen/home')).data,
    refetchInterval: 30_000,
  });

  if (isLoading) return <Loading label={t('citizen.home.loading')} />;
  if (error) return <ErrorState message={t('citizen.home.loadError')} onRetry={() => refetch()} />;

  const { stats, activeComplaints = [], truck } = data ?? {};

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-fluid-xs font-semibold uppercase tracking-wider text-muted">{t('citizen.home.greeting')}</p>
          <h1 className="text-fluid-2xl font-extrabold tracking-tight text-ink">
            {user?.name?.split(' ')[0] || 'Citizen'}
          </h1>
          {data?.user?.ward && (
            <p className="mt-1 flex items-center gap-1.5 text-fluid-xs font-medium text-muted">
              <MapPin className="h-3.5 w-3.5 text-brand" />
              {data.user.ward.name} · Ward Code: {data.user.ward.code}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/app/rewards"
            className="flex items-center gap-2.5 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-2 text-brand transition hover:bg-brand/20 shadow-xs"
          >
            <Trophy className="h-5 w-5" />
            <div>
              <span className="block text-[10px] uppercase font-bold tracking-wider">Available Credits</span>
              <span className="font-extrabold text-fluid-sm tabular-nums">{stats?.credits ?? 0} pts</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Responsive 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Primary Actions, Truck & Active Reports (7 of 12 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/app/report"
              className="flex items-center gap-3.5 rounded-2xl bg-brand p-5 text-brand-ink shadow-glow transition hover:scale-[1.01] active:scale-[0.99]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20">
                <Camera className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-fluid-base font-extrabold">{t('citizen.home.reportCta')}</span>
                <span className="block text-fluid-xs opacity-90">{t('citizen.home.reportSub')}</span>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 opacity-80" />
            </Link>

            <Link
              to="/app/emergency"
              className="flex items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger transition hover:bg-danger/15 active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white shadow-xs">
                <Siren className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-fluid-sm font-extrabold leading-tight">{t('citizen.home.emergency')}</span>
                <span className="block text-[11px] opacity-80">30-Min Fast Escalation</span>
              </div>
            </Link>

            <Link
              to="/app/schedule-pickup"
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-ink transition hover:bg-sunken hover:border-brand/30 active:scale-[0.99] shadow-xs"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand shadow-xs">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-fluid-sm font-extrabold leading-tight">Schedule Event Pickup</span>
                <span className="block text-[11px] text-muted">Wedding, Festival & Renovation (+25 Credits)</span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          </div>

          {/* Live Collection Truck Tracker Card */}
          {truck && (
            <Link to={`/app/track/${activeComplaints.find((c: any) => c.assignedVehicleId)?.id}`} className="block">
              <Card className="overflow-hidden border-brand/40 bg-gradient-to-r from-brand/10 via-surface to-brand/5 p-0 shadow-sm transition hover:shadow-md">
                <div className="flex items-center gap-3.5 p-4 sm:p-5">
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink shadow-md">
                    <Truck className="h-6 w-6" />
                    <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-brand/40" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-fluid-base font-bold text-ink">
                      {t('citizen.home.arriving', { minutes: truck.etaMinutes })}
                    </p>
                    <p className="truncate text-fluid-xs text-muted mt-0.5">
                      {t('citizen.home.truckSub', {
                        reg: truck.registrationNumber,
                        distance: formatDistance(truck.distanceMeters),
                        code: truck.complaintCode,
                      })}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-brand" />
                </div>
              </Card>
            </Link>
          )}

          {/* Quick Stats bar */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('citizen.home.statActive')} value={stats?.active ?? 0} />
            <Stat
              label={t('citizen.home.statResolved')}
              value={stats?.resolved ?? 0}
              tone="ok"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <Stat
              label={t('citizen.home.statCredits')}
              value={stats?.credits ?? 0}
              tone="brand"
              icon={<Trophy className="h-4 w-4" />}
            />
          </div>

          {/* Active Complaints Feed */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionTitle title="Your Active Complaints" subtitle="Live tracking and assignment updates" />
              {activeComplaints.length > 0 && (
                <Link to="/app/complaints" className="text-fluid-xs font-semibold text-brand hover:underline">
                  View All
                </Link>
              )}
            </div>

            {activeComplaints.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-ok" />
                <p className="mt-2 text-fluid-sm font-bold text-ink">No Pending Complaints</p>
                <p className="text-fluid-xs text-muted mt-1">
                  All your past complaints have been resolved and verified!
                </p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {activeComplaints.map((c: any) => (
                  <Link key={c.id} to={`/app/complaints/${c.id}`} className="block">
                    <Card className="flex items-center justify-between p-4 transition hover:bg-sunken/50 hover:shadow-xs">
                      <div className="space-y-1 min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-fluid-xs font-bold text-ink">#{c.code}</span>
                          <Badge tone={STATUS_TONE[c.status] || 'neutral'}>{c.status}</Badge>
                          <span className="text-[11px] text-muted">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="text-fluid-sm font-bold text-ink truncate">{t(`category.${c.category}`)}</p>
                        <p className="text-fluid-xs text-muted truncate">{c.address || 'Gandhinagar'}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Segregation Rules, Helplines & Rewards (5 of 12 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          {/* Green Credits Promotion Card */}
          <Card className="relative overflow-hidden border-brand/30 bg-gradient-to-br from-surface to-brand/10 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink font-bold shadow-xs">
                <Award className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-fluid-sm font-bold text-ink">Civic Rewards & Rebates</h3>
                <p className="text-fluid-xs text-muted mt-1 leading-relaxed">
                  Earn 50 Green Credits for verified civic reports. Redeem them for property tax rebates & BRTS bus passes.
                </p>
                <Link to="/app/rewards" className="inline-flex items-center gap-1.5 text-fluid-xs font-bold text-brand mt-3 hover:underline">
                  Browse Rewards Catalog <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </Card>

          {/* Waste Segregation Guide */}
          <Card className="p-5 space-y-3 shadow-xs">
            <h3 className="text-fluid-xs font-bold uppercase tracking-wider text-muted">Waste Segregation Guide</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 rounded-xl border border-ok/30 bg-ok/5 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ok text-white text-fluid-xs font-bold">
                  🟢
                </span>
                <div className="text-fluid-xs">
                  <strong className="block text-ink font-bold">Wet / Organic Waste (Green Bin)</strong>
                  <span className="text-muted">Kitchen scraps, fruit/vegetable peels, leftover food.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info/5 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-info text-white text-fluid-xs font-bold">
                  🔵
                </span>
                <div className="text-fluid-xs">
                  <strong className="block text-ink font-bold">Dry / Recyclables (Blue Bin)</strong>
                  <span className="text-muted">Cardboard, plastic bottles, metal cans, newspapers.</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Helplines */}
          <Card className="p-5 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-fluid-xs font-bold uppercase tracking-wider text-muted">24/7 Helpline Directory</h3>
              <Link to="/app/directory" className="text-[11px] font-semibold text-brand hover:underline">
                Full Directory
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href="tel:07923227900"
                className="flex items-center gap-2 rounded-xl border border-line bg-elevated p-2.5 text-fluid-xs font-semibold text-ink transition hover:bg-sunken"
              >
                <Phone className="h-3.5 w-3.5 text-brand" />
                <span>Sanitation</span>
              </a>
              <a
                href="tel:108"
                className="flex items-center gap-2 rounded-xl border border-line bg-elevated p-2.5 text-fluid-xs font-semibold text-danger transition hover:bg-sunken"
              >
                <Phone className="h-3.5 w-3.5 text-danger" />
                <span>Ambulance</span>
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
