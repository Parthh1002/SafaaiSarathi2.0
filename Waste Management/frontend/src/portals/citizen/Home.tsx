import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Camera, Siren, Truck, Trophy, ArrowRight, MapPin, CheckCircle2, Clock } from 'lucide-react';
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
    <div className="space-y-5">
      <div>
        <p className="text-fluid-sm text-muted">{t('citizen.home.greeting')}</p>
        <h1 className="text-fluid-xl font-bold tracking-tight">{user?.name?.split(' ')[0]}</h1>
        {data?.user?.ward && (
          <p className="mt-0.5 flex items-center gap-1 text-fluid-xs text-muted">
            <MapPin className="h-3.5 w-3.5" />
            {data.user.ward.name} · {data.user.ward.code}
          </p>
        )}
      </div>

      {/* Primary actions — one tap from the top of the screen. */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/app/report"
          className="col-span-2 flex items-center gap-3 rounded-2xl bg-brand p-4 text-brand-ink shadow-glow transition active:scale-[0.99]"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <Camera className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-fluid-base font-bold">{t('citizen.home.reportCta')}</span>
            <span className="block text-fluid-xs opacity-90">{t('citizen.home.reportSub')}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 opacity-80" />
        </Link>

        <Link
          to="/app/emergency"
          className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-danger transition active:scale-[0.99]"
        >
          <Siren className="h-5 w-5 shrink-0" />
          <span className="text-fluid-sm font-bold leading-tight">{t('citizen.home.emergency')}</span>
        </Link>

        <Link
          to="/app/complaints"
          className="flex items-center gap-2.5 rounded-2xl border border-line bg-elevated p-3.5 transition active:scale-[0.99]"
        >
          <Clock className="h-5 w-5 shrink-0 text-muted" />
          <span className="text-fluid-sm font-semibold leading-tight">
            {t('citizen.home.activeCount', { count: stats?.active ?? 0 })}
          </span>
        </Link>
      </div>

      {/* Live truck card — the "your truck arrives in 12 min" moment. */}
      {truck && (
        <Link to={`/app/track/${activeComplaints.find((c: any) => c.assignedVehicleId)?.id}`} className="block">
          <Card className="overflow-hidden border-brand/30 p-0">
            <div className="flex items-center gap-3 bg-brand/10 p-4">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink">
                <Truck className="h-6 w-6" />
                <span className="absolute inset-0 animate-pulse-ring rounded-xl bg-brand/40" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-fluid-base font-bold">
                  {t('citizen.home.arriving', { minutes: truck.etaMinutes })}
                </p>
                <p className="truncate text-fluid-xs text-muted">
                  {t('citizen.home.truckSub', { reg: truck.registrationNumber, distance: formatDistance(truck.distanceMeters), code: truck.complaintCode })}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-brand" />
            </div>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label={t('citizen.home.statActive')} value={stats?.active ?? 0} />
        <Stat label={t('citizen.home.statResolved')} value={stats?.resolved ?? 0} tone="ok" icon={<CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />} />
        <Stat label={t('citizen.home.statCredits')} value={stats?.credits ?? 0} tone="brand" icon={<Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />} />
      </div>

      <section>
        <SectionTitle
          title={t('citizen.home.activeReports')}
          action={
            <Link to="/app/complaints" className="text-fluid-xs font-semibold text-brand hover:underline">
              {t('common.seeAll')}
            </Link>
          }
        />
        {activeComplaints.length === 0 ? (
          <EmptyState
            title={t('citizen.home.emptyTitle')}
            hint={t('citizen.home.emptyHint')}
            action={
              <Link to="/app/report" className="btn-primary btn-sm">
                {t('citizen.home.reportCta')}
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {activeComplaints.map((c: any) => (
              <li key={c.id}>
                <Link to={`/app/complaints/${c.id}`} className="block">
                  <Card className="flex items-center gap-3 p-3.5 transition hover:shadow-lift">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-sunken text-faint">
                        <Camera className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-fluid-sm font-semibold">
                          {t(`category.${c.category}`)}
                        </p>
                        {c.isEmergency && <Badge tone="danger">SOS</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-fluid-xs text-muted">{c.address || c.code}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
                        <span className="text-fluid-xs text-faint">{timeAgo(c.createdAt)}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
