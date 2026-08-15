import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Eye, Siren, Truck, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, SectionTitle, Stat, toast } from '../../components/ui';
import { BaseMap, WardLayer, ComplaintLayer, TruckMarker, FitBounds } from '../../components/map/Map';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONE, pct, timeAgo } from '../../lib/format';
import { useT } from '../../lib/i18n';

/** Ward heatmap dashboard (plan §2.3) — live complaint density plus the fleet. */
export default function OfficerDashboard() {
  const t = useT();
  const queryClient = useQueryClient();
  const [trucks, setTrucks] = useState<Record<string, any>>({});

  const overview = useQuery({
    queryKey: ['officer', 'overview'],
    queryFn: async () => (await api('officer').get('/officer/overview')).data,
    refetchInterval: 30_000,
  });
  const wards = useQuery({
    queryKey: ['officer', 'wards'],
    queryFn: async () => (await api('officer').get('/officer/wards')).data,
  });
  const heatmap = useQuery({
    queryKey: ['officer', 'heatmap'],
    queryFn: async () => (await api('officer').get('/officer/heatmap', { params: { days: 14 } })).data,
  });
  const fleet = useQuery({
    queryKey: ['officer', 'fleet'],
    queryFn: async () => (await api('officer').get('/officer/fleet')).data,
    refetchInterval: 60_000,
  });

  const wardRooms = (wards.data ?? []).map((w: any) => `ward:${w.id}`);

  useSocket('officer', wardRooms, {
    [SOCKET_EVENTS.TRUCK_UPDATE]: (payload: any) => {
      if (payload?.id) setTrucks((prev) => ({ ...prev, [payload.id]: payload }));
    },
    [SOCKET_EVENTS.COMPLAINT_NEW]: (payload: any) => {
      toast.info(`New report ${payload.code} · ${t(`category.${payload.category}`)}`);
      void queryClient.invalidateQueries({ queryKey: ['officer'] });
    },
    [SOCKET_EVENTS.EMERGENCY_NEW]: (payload: any) => {
      toast.error(`EMERGENCY ${payload.code} · ${t(`category.${payload.category}`)}`);
      void queryClient.invalidateQueries({ queryKey: ['officer'] });
    },
    [SOCKET_EVENTS.SOS_NEW]: (payload: any) => toast.error(`SOS from driver ${payload.driver?.name}`),
  });

  if (overview.isLoading) return <Loading label="Loading your ward…" />;
  if (overview.error) return <ErrorState message="Could not load the dashboard" onRetry={() => overview.refetch()} />;

  const kpis = overview.data.kpis;
  const liveTrucks = { ...Object.fromEntries((fleet.data ?? []).map((v: any) => [v.id, v])), ...trucks };

  const mapPoints: Array<[number, number]> = (wards.data ?? []).map((w: any) => [w.center.latitude, w.center.longitude]);

  return (
    <div className="space-y-5">
      {/* KPI row — 2-up on phones, 4-up on desktop. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Open complaints"
          value={kpis.openComplaints}
          hint={`${kpis.complaintsToday} reported today`}
          icon={<Clock className="h-4 w-4" />}
        />
        <Stat
          label="Emergencies"
          value={kpis.emergenciesOpen}
          tone={kpis.emergenciesOpen > 0 ? 'danger' : 'ok'}
          hint={kpis.emergenciesOpen > 0 ? 'Needs acknowledgement' : 'All clear'}
          icon={<Siren className="h-4 w-4" />}
        />
        <Stat
          label="Needs review"
          value={kpis.reviewNeeded}
          tone="warn"
          hint="AI confidence below threshold"
          icon={<Eye className="h-4 w-4" />}
        />
        <Stat
          label="SLA compliance"
          value={pct(kpis.slaCompliancePct)}
          tone={kpis.slaCompliancePct >= 80 ? 'ok' : 'warn'}
          hint={`${kpis.overdue} overdue now`}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Map + side rail. Single column on phones, split on wide screens. */}
      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <h2 className="text-fluid-sm font-semibold">Live ward map</h2>
            <Badge tone="ok" className="ml-auto">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
              {Object.values(liveTrucks).filter((t: any) => t.online || t.status === 'ON_ROUTE').length} trucks live
            </Badge>
            <Badge tone="neutral">{heatmap.data?.length ?? 0} complaints</Badge>
          </div>

          <div className="h-[52dvh] min-h-[320px] w-full xl:h-[560px]">
            <BaseMap center={[23.2156, 72.6369]} zoom={12}>
              <FitBounds points={mapPoints} />
              {wards.data && (
                <WardLayer
                  wards={wards.data}
                  colorFor={(w: any) => (w.load > 60 ? '#dc2626' : w.load > 30 ? '#f59e0b' : '#16a34a')}
                />
              )}
              {heatmap.data && <ComplaintLayer points={heatmap.data} />}
              {Object.values(liveTrucks).map((truck: any) =>
                truck.latitude != null ? (
                  <TruckMarker
                    key={truck.id}
                    latitude={truck.latitude}
                    longitude={truck.longitude}
                    heading={truck.heading ?? 0}
                    active={truck.status === 'ON_ROUTE'}
                    label={`${truck.registrationNumber} · ${truck.status}`}
                  />
                ) : null
              )}
            </BaseMap>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 text-fluid-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" /> Low load
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" /> Moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" /> High / emergency
            </span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle title="Fleet" action={<Link to="/officer/fleet" className="text-fluid-xs font-semibold text-brand hover:underline">Manage</Link>} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-sunken p-2.5">
                <p className="text-fluid-lg font-bold tabular-nums">{kpis.vehiclesOnRoute}</p>
                <p className="text-fluid-xs text-muted">On route</p>
              </div>
              <div className="rounded-xl bg-sunken p-2.5">
                <p className="text-fluid-lg font-bold tabular-nums">{kpis.vehiclesOnline}</p>
                <p className="text-fluid-xs text-muted">Online</p>
              </div>
              <div className="rounded-xl bg-sunken p-2.5">
                <p className="text-fluid-lg font-bold tabular-nums">{kpis.vehiclesTotal}</p>
                <p className="text-fluid-xs text-muted">Total</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle title="Ward load" />
            <ul className="space-y-2">
              {(wards.data ?? []).map((w: any) => (
                <li key={w.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-fluid-sm">{w.name}</span>
                  <span className="text-fluid-xs tabular-nums text-muted">{w.openComplaints} open</span>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: w.load > 60 ? '#dc2626' : w.load > 30 ? '#f59e0b' : '#16a34a' }}
                  />
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <SectionTitle title="By status" />
            <ul className="space-y-1.5">
              {(overview.data.statusBreakdown ?? []).map((s: any) => (
                <li key={s.status} className="flex items-center justify-between gap-2">
                  <Badge tone={STATUS_TONE[s.status]}>{t(`status.${s.status}`)}</Badge>
                  <span className="text-fluid-sm font-semibold tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Attention rail */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle
            title="Needs your review"
            subtitle="AI confidence fell below the auto-approve threshold"
            action={<Link to="/officer/queue?reviewNeeded=1" className="text-fluid-xs font-semibold text-brand hover:underline">Open queue</Link>}
          />
          {kpis.reviewNeeded === 0 ? (
            <p className="flex items-center gap-2 text-fluid-sm text-muted">
              <CheckCircle2 className="h-4 w-4 text-ok" /> Nothing waiting on you.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-fluid-sm">
              <AlertTriangle className="h-4 w-4 text-warn" />
              <span>
                <span className="font-bold">{kpis.reviewNeeded}</span> report{kpis.reviewNeeded === 1 ? '' : 's'} need a
                human decision before dispatch.
              </span>
            </p>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle title="Top categories this week" />
          <ul className="space-y-2">
            {(overview.data.categoryBreakdown ?? []).slice(0, 5).map((c: any) => (
              <li key={c.category}>
                <div className="mb-1 flex items-center justify-between gap-2 text-fluid-xs">
                  <span className="truncate">{c.label}</span>
                  <span className="shrink-0 tabular-nums text-muted">{c.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${c.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
