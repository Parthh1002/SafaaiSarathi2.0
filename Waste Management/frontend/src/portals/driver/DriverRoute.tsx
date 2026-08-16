import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Navigation,
  MapPin,
  Route as RouteIcon,
  Fuel,
  Clock,
  CheckCircle2,
  ArrowRight,
  Truck,
  ShieldAlert,
  Compass,
  Phone,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, Meter } from '../../components/ui';
import { BaseMap, TruckMarker, RouteLine, PinMarker, FollowTarget } from '../../components/map/Map';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';
import { CATEGORY_LABELS, formatDistance } from '../../lib/format';
import { useT } from '../../lib/i18n';

export default function DriverRoute() {
  const t = useT();
  const [live, setLive] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [follow, setFollow] = useState(true);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['driver', 'shift'],
    queryFn: async () => (await api('driver').get('/driver/shift')).data,
    refetchInterval: 30_000,
  });

  const vehicleId = data?.vehicle?.id;

  useSocket('driver', vehicleId ? [`truck:${vehicleId}`] : [], {
    [SOCKET_EVENTS.TRUCK_UPDATE]: (payload: any) => {
      if (payload?.latitude == null) return;
      setLive({ latitude: payload.latitude, longitude: payload.longitude, heading: payload.heading });
      if (payload.routeProgress?.index != null) setProgressIndex(payload.routeProgress.index);
    },
    [SOCKET_EVENTS.ASSIGNMENT_NEW]: () => refetch(),
    new_task_assigned: () => refetch(),
  });

  useEffect(() => {
    if (data?.vehicle?.latitude != null && !live) {
      setLive({
        latitude: data.vehicle.latitude,
        longitude: data.vehicle.longitude,
        heading: data.vehicle.heading,
      });
    }
  }, [data, live]);

  const assignedStops = useMemo(() => {
    if (data?.route?.stops?.length) return data.route.stops;
    if (data?.assignedComplaints?.length) {
      return data.assignedComplaints.map((c: any, idx: number) => ({
        seq: idx + 1,
        complaintId: c.id,
        code: c.code,
        label: c.address || c.code,
        category: c.category,
        latitude: c.latitude,
        longitude: c.longitude,
        status: c.status,
        isEmergency: c.isEmergency,
      }));
    }
    return [];
  }, [data]);

  const polyline = useMemo(() => {
    if (data?.route?.polyline?.length) return data.route.polyline;
    if (assignedStops.length) {
      const pts = assignedStops.map((s: any) => [s.latitude, s.longitude] as [number, number]);
      if (live) pts.unshift([live.latitude, live.longitude]);
      return pts;
    }
    return [];
  }, [data, assignedStops, live]);

  const nextStop = data?.nextStop || assignedStops.find((s: any) => s.status !== 'RESOLVED');

  if (isLoading) return <Loading label="Loading route navigation…" />;
  if (error) return <ErrorState message="Could not load your shift" onRetry={() => refetch()} />;

  const centre: [number, number] = live
    ? [live.latitude, live.longitude]
    : polyline[0]
      ? [polyline[0][0], polyline[0][1]]
      : [23.2156, 72.6369];

  const resolvedCount = assignedStops.filter((s: any) => s.status === 'RESOLVED').length;
  const totalStops = assignedStops.length;
  const progressPct = totalStops > 0 ? (resolvedCount / totalStops) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-fluid-lg font-bold tracking-tight text-ink">
              {data?.vehicle?.registrationNumber || 'Driver Navigation'}
            </h1>
            <p className="text-fluid-xs text-muted">
              Ward: <span className="font-semibold text-ink">{data?.vehicle?.ward?.name || 'Assigned Zone'}</span> ·
              Status: <span className="text-brand font-semibold">{data?.vehicle?.status || 'ON_ROUTE'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-line bg-elevated px-3 py-1.5 text-fluid-xs">
            <span className="text-muted">Completed: </span>
            <span className="font-bold text-ink">
              {resolvedCount} / {totalStops}
            </span>
          </div>
          <Link to="/driver/stops" className="btn-primary btn-sm">
            View All Tasks <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {!assignedStops.length ? (
        <Card className="p-8 text-center">
          <EmptyState
            title="No active stops assigned"
            hint="When your ward officer assigns new collection tasks, they will appear here live with turn-by-turn guidance."
            icon={<RouteIcon className="h-10 w-10 text-brand" />}
          />
        </Card>
      ) : (
        /* Multi-Column Desktop Grid */
        <div className="grid gap-5 lg:grid-cols-12 items-start">
          {/* Left Column: Interactive Map & Live HUD (7 of 12 cols on desktop) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <Card className="overflow-hidden p-0 shadow-md">
              <div className="relative h-[55dvh] min-h-[380px] w-full lg:h-[580px]">
                <BaseMap center={centre} zoom={15}>
                  <FollowTarget latitude={live?.latitude} longitude={live?.longitude} enabled={follow} />
                  {polyline.length > 1 && <RouteLine polyline={polyline} progressIndex={progressIndex} />}
                  {assignedStops.map((stop: any) => (
                    <PinMarker
                      key={stop.seq}
                      latitude={stop.latitude}
                      longitude={stop.longitude}
                      tone={stop.isEmergency ? 'danger' : 'brand'}
                      label={`${stop.seq}. ${stop.label}`}
                    />
                  ))}
                  {live && (
                    <TruckMarker latitude={live.latitude} longitude={live.longitude} heading={live.heading ?? 0} />
                  )}
                </BaseMap>

                {/* GPS HUD Overlay on Top Left */}
                <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 rounded-xl border border-line bg-surface/90 px-3 py-2 shadow-md backdrop-blur">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ok"></span>
                  </span>
                  <span className="text-[11px] font-bold text-ink uppercase tracking-wider">
                    {live ? 'GPS Live Connected' : 'Acquiring GPS…'}
                  </span>
                </div>

                {/* Free Pan / Following Button on Bottom Right */}
                <button
                  type="button"
                  onClick={() => setFollow((v) => !v)}
                  className={`absolute bottom-3 right-3 z-[400] flex items-center gap-1.5 rounded-xl border px-3 py-2 text-fluid-xs font-semibold shadow-lift backdrop-blur transition ${
                    follow ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface/90 text-muted'
                  }`}
                >
                  <Navigation className="h-4 w-4" />
                  {follow ? 'Following Truck' : 'Free Pan Mode'}
                </button>
              </div>

              {/* Progress Meter bar */}
              <div className="border-t border-line bg-elevated/50 p-4">
                <Meter
                  value={progressPct}
                  tone="brand"
                  label={`${resolvedCount} of ${totalStops} stops completed (${Math.round(progressPct)}%)`}
                />
              </div>
            </Card>
          </div>

          {/* Right Column: Active Task & Queue (5 of 12 cols on desktop) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            {/* Current Active Stop Card */}
            {nextStop ? (
              <Card className="relative overflow-hidden border-brand/40 bg-gradient-to-br from-surface to-brand/5 p-5 shadow-md">
                <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-brand-ink text-fluid-xs font-bold">
                      {nextStop.seq}
                    </span>
                    <h2 className="text-fluid-sm font-bold uppercase tracking-wider text-muted">Next Stop in Queue</h2>
                  </div>
                  <Badge tone={nextStop.isEmergency ? 'danger' : 'brand'}>
                    {nextStop.isEmergency ? 'Emergency' : 'Standard'}
                  </Badge>
                </div>

                <div className="mt-3.5 space-y-2">
                  <p className="text-fluid-base font-bold text-ink leading-snug">{nextStop.label}</p>
                  <p className="text-fluid-xs text-muted">
                    Category: <strong className="text-ink">{t(`category.${nextStop.category}`)}</strong>
                  </p>
                  {nextStop.code && (
                    <p className="font-mono text-fluid-xs text-muted">Ticket: #{nextStop.code}</p>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${nextStop.latitude},${nextStop.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-fluid-xs font-bold shadow-sm"
                  >
                    <Navigation className="h-4 w-4" /> Start Turn-by-Turn GPS
                  </a>
                  <Link
                    to="/driver/stops"
                    className="btn-ghost flex items-center justify-center rounded-xl border border-line px-3.5 text-fluid-xs font-semibold"
                  >
                    Complete
                  </Link>
                </div>
              </Card>
            ) : (
              <Card className="p-5 text-center border-ok/30 bg-ok/5">
                <CheckCircle2 className="mx-auto h-8 w-8 text-ok" />
                <h3 className="mt-2 text-fluid-sm font-bold text-ink">All Assigned Stops Complete!</h3>
                <p className="text-fluid-xs text-muted mt-1">
                  Great job! You have cleared all tasks in your queue. Check back for new dispatches.
                </p>
              </Card>
            )}

            {/* Sequential Stops Queue */}
            <Card className="overflow-hidden p-0 shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-sunken/40">
                <h3 className="text-fluid-xs font-bold uppercase tracking-wider text-muted">Stops Itinerary</h3>
                <span className="text-[11px] font-semibold text-brand">{totalStops} locations</span>
              </div>

              <div className="divide-y divide-line max-h-[340px] overflow-y-auto">
                {assignedStops.map((stop: any) => {
                  const isDone = stop.status === 'RESOLVED';
                  const isCurrent = nextStop?.seq === stop.seq;

                  return (
                    <div
                      key={stop.seq}
                      className={`flex items-center justify-between p-3.5 transition ${
                        isCurrent ? 'bg-brand/10' : 'hover:bg-sunken/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fluid-xs font-bold ${
                            isDone
                              ? 'bg-ok/20 text-ok'
                              : isCurrent
                                ? 'bg-brand text-brand-ink'
                                : 'bg-sunken text-muted'
                          }`}
                        >
                          {isDone ? '✓' : stop.seq}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-fluid-xs font-semibold truncate ${isDone ? 'line-through text-muted' : 'text-ink'}`}>
                            {stop.label}
                          </p>
                          <p className="text-[10px] text-muted">
                            {t(`category.${stop.category}`)} · {stop.code || 'Assigned'}
                          </p>
                        </div>
                      </div>

                      <Badge tone={isDone ? 'ok' : stop.isEmergency ? 'danger' : isCurrent ? 'brand' : 'neutral'}>
                        {isDone ? 'Done' : isCurrent ? 'Current' : 'Pending'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Quick Actions Support */}
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/driver/fuel"
                className="flex items-center gap-2 rounded-xl border border-line bg-elevated p-3 text-fluid-xs font-semibold text-ink transition hover:bg-sunken shadow-xs"
              >
                <Fuel className="h-4 w-4 text-brand" />
                <span>Log Fuel / Km</span>
              </Link>
              <Link
                to="/driver/sos"
                className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-fluid-xs font-semibold text-danger transition hover:bg-danger/20 shadow-xs"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Emergency SOS</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
