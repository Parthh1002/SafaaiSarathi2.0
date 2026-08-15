import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle2, Siren, Truck, Users, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, SectionTitle, Stat } from '../../components/ui';
import { BaseMap, WardLayer, TruckMarker, FitBounds } from '../../components/map/Map';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';
import { pct, formatDuration } from '../../lib/format';

/** City-wide command dashboard (plan §2.4) — all wards, trucks and officers. */
export default function AdminDashboard() {
  const [trucks, setTrucks] = useState<Record<string, any>>({});

  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => (await api('admin').get('/admin/overview')).data,
    refetchInterval: 30_000,
  });
  const fleet = useQuery({
    queryKey: ['admin', 'fleet'],
    queryFn: async () => (await api('admin').get('/admin/fleet')).data,
    refetchInterval: 60_000,
  });

  useSocket('admin', ['city'], {
    [SOCKET_EVENTS.TRUCK_UPDATE]: (payload: any) => {
      if (payload?.id) setTrucks((prev) => ({ ...prev, [payload.id]: payload }));
    },
  });

  if (overview.isLoading) return <Loading label="Loading the city view…" />;
  if (overview.error) return <ErrorState message="Could not load the dashboard" onRetry={() => overview.refetch()} />;

  const kpis = overview.data.kpis;
  const wards = overview.data.wards ?? [];
  const liveFleet = { ...Object.fromEntries((fleet.data ?? []).map((v: any) => [v.id, v])), ...trucks };
  const positioned = Object.values(liveFleet).filter((v: any) => v.latitude != null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Open" value={kpis.openComplaints} hint={`${kpis.complaintsToday} today`} icon={<Clock className="h-4 w-4" />} />
        <Stat label="Emergencies" value={kpis.emergenciesOpen} tone={kpis.emergenciesOpen ? 'danger' : 'ok'} icon={<Siren className="h-4 w-4" />} />
        <Stat label="Overdue" value={kpis.overdue} tone={kpis.overdue ? 'warn' : 'ok'} />
        <Stat label="SLA" value={pct(kpis.slaCompliancePct)} tone={kpis.slaCompliancePct >= 80 ? 'ok' : 'warn'} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Trucks live" value={`${kpis.vehiclesOnline}/${kpis.vehiclesTotal}`} icon={<Truck className="h-4 w-4" />} />
        <Stat label="Wards" value={wards.length} hint={`${overview.data.staff?.officers ?? 0} officers`} icon={<Building2 className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <h2 className="text-fluid-sm font-semibold">City map</h2>
            <Badge tone="ok" className="ml-auto">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
              {positioned.length} trucks
            </Badge>
          </div>
          <div className="h-[52dvh] min-h-[320px] w-full xl:h-[560px]">
            <BaseMap center={[23.2156, 72.6369]} zoom={12}>
              <FitBounds points={wards.map((w: any) => [w.center.latitude, w.center.longitude])} />
              <WardLayer
                wards={wards}
                colorFor={(w: any) => (w.load > 60 ? '#dc2626' : w.load > 30 ? '#f59e0b' : '#16a34a')}
              />
              {positioned.map((v: any) => (
                <TruckMarker
                  key={v.id}
                  latitude={v.latitude}
                  longitude={v.longitude}
                  heading={v.heading ?? 0}
                  active={v.status === 'ON_ROUTE'}
                  label={`${v.registrationNumber} · ${v.driver?.name ?? 'unassigned'}`}
                />
              ))}
            </BaseMap>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle title="Wards under pressure" />
            <ul className="space-y-2.5">
              {[...wards]
                .sort((a: any, b: any) => b.load - a.load)
                .slice(0, 6)
                .map((w: any) => (
                  <li key={w.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-fluid-xs">
                      <span className="truncate font-medium">{w.name}</span>
                      <span className="shrink-0 tabular-nums text-muted">{w.openComplaints} open</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, w.load)}%`,
                          background: w.load > 60 ? '#dc2626' : w.load > 30 ? '#f59e0b' : '#16a34a',
                        }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </Card>

          <Card className="p-4">
            <SectionTitle title="City totals" />
            <dl className="space-y-2 text-fluid-sm">
              <Row label="Citizens registered" value={overview.data.staff?.citizens ?? 0} icon={<Users className="h-4 w-4" />} />
              <Row label="Ward officers" value={overview.data.staff?.officers ?? 0} icon={<Building2 className="h-4 w-4" />} />
              <Row label="Resolved (7d)" value={kpis.resolvedLast7Days} icon={<CheckCircle2 className="h-4 w-4" />} />
              <Row label="Avg resolution" value={formatDuration(kpis.avgResolutionMinutes)} icon={<Clock className="h-4 w-4" />} />
              <Row label="Needs review" value={kpis.reviewNeeded} icon={<Siren className="h-4 w-4" />} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-faint">{icon}</span>
      <dt className="min-w-0 flex-1 truncate text-muted">{label}</dt>
      <dd className="shrink-0 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
