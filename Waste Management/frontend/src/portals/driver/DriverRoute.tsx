import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Navigation, MapPin, Route as RouteIcon, Fuel, Clock, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, Meter, Stat } from '../../components/ui';
import { BaseMap, TruckMarker, RouteLine, PinMarker, FollowTarget } from '../../components/map/Map';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';
import { CATEGORY_LABELS, formatDistance, formatDuration } from '../../lib/format';
import { useT } from '../../lib/i18n';

/**
 * Live navigation (plan §2.2, §4.4): the driver's own truck moving on the map,
 * the optimised route drawn as a polyline, and the traversed portion greyed out
 * as stops are completed.
 */
export default function DriverRoute() {
  const t = useT();
  const [live, setLive] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [follow, setFollow] = useState(true);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['driver', 'shift'],
    queryFn: async () => (await api('driver').get('/driver/shift')).data,
    refetchInterval: 45_000,
  });

  const vehicleId = data?.vehicle?.id;

  useSocket('driver', vehicleId ? [`truck:${vehicleId}`] : [], {
    [SOCKET_EVENTS.TRUCK_UPDATE]: (payload: any) => {
      if (payload?.latitude == null) return;
      setLive({ latitude: payload.latitude, longitude: payload.longitude, heading: payload.heading });
      if (payload.routeProgress?.index != null) setProgressIndex(payload.routeProgress.index);
    },
    [SOCKET_EVENTS.ASSIGNMENT_NEW]: () => refetch(),
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

  const polyline = useMemo(() => data?.route?.polyline ?? [], [data]);
  const stops = data?.route?.stops ?? [];
  const nextStop = data?.nextStop;

  if (isLoading) return <Loading label="Loading your route…" />;
  if (error) return <ErrorState message="Could not load your shift" onRetry={() => refetch()} />;

  if (!data?.route) {
    return (
      <EmptyState
        title="No route published yet"
        hint="Your ward officer publishes the day's route each morning. It will appear here automatically."
        icon={<RouteIcon className="h-8 w-8" />}
      />
    );
  }

  const centre: [number, number] = live
    ? [live.latitude, live.longitude]
    : polyline[0]
      ? [polyline[0][1], polyline[0][0]]
      : [23.2156, 72.6369];

  return (
    <div className="space-y-4">
      {/* Map first — it is the driver's primary surface. */}
      <Card className="overflow-hidden p-0">
        <div className="relative h-[46dvh] min-h-[260px] w-full">
          <BaseMap center={centre} zoom={15}>
            <FollowTarget latitude={live?.latitude} longitude={live?.longitude} enabled={follow} />
            <RouteLine polyline={polyline} progressIndex={progressIndex} />
            {stops.map((stop: any) => (
              <PinMarker
                key={stop.seq}
                latitude={stop.latitude}
                longitude={stop.longitude}
                tone={stop.isEmergency ? 'danger' : 'brand'}
                label={`${stop.seq}. ${stop.label}`}
              />
            ))}
            {live && <TruckMarker latitude={live.latitude} longitude={live.longitude} heading={live.heading ?? 0} />}
          </BaseMap>

          <button
            type="button"
            onClick={() => setFollow((v) => !v)}
            className={`absolute bottom-3 right-3 z-[400] btn-sm rounded-xl border shadow-lift ${
              follow ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-elevated text-muted'
            }`}
          >
            <Navigation className="h-3.5 w-3.5" />
            {follow ? 'Following' : 'Free pan'}
          </button>
        </div>

        <div className="border-t border-line p-3">
          <Meter
            value={data.route.total ? (data.route.done / data.route.total) * 100 : 0}
            tone="brand"
            label={`${data.route.done} of ${data.route.total} stops done`}
          />
        </div>
      </Card>

      {/* Next stop — one primary action, large target. */}
      {nextStop ? (
        <Card className="border-brand/30 p-4">
          <p className="label mb-1">Next stop</p>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink font-bold">
              {nextStop.seq}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-fluid-base font-semibold leading-tight">{nextStop.label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {nextStop.isEmergency && <Badge tone="danger">Emergency</Badge>}
                {nextStop.category && <Badge tone="neutral">{t(`category.${nextStop.category}`)}</Badge>}
                {nextStop.eta && <span className="text-fluid-xs text-muted">ETA {nextStop.eta}</span>}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${nextStop.latitude},${nextStop.longitude}&travelmode=driving`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              <Navigation className="h-4 w-4" /> Navigate
            </a>
            <Link to="/driver/stops" className="btn-primary">
              <CheckCircle2 className="h-4 w-4" /> Open stops
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="flex items-center gap-3 border-ok/30 bg-ok/5 p-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-ok" />
          <div>
            <p className="text-fluid-base font-semibold">Route complete</p>
            <p className="text-fluid-xs text-muted">Every stop on today's beat has been handled.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Stops" value={`${data.summary.stopsDone}/${data.summary.stopsTotal}`} icon={<MapPin className="h-4 w-4" />} />
        <Stat label="Resolved" value={data.summary.resolvedToday} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Distance" value={`${data.summary.distanceKm} km`} icon={<RouteIcon className="h-4 w-4" />} />
        <Stat
          label="Planned"
          value={`${data.route.distanceKm} km`}
          hint={data.route.savedKm ? `${data.route.savedKm} km saved by optimising` : undefined}
          tone="info"
          icon={<Fuel className="h-4 w-4" />}
        />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted" />
          <p className="text-fluid-sm font-semibold">{data.route.label}</p>
        </div>
        <p className="mt-1 text-fluid-xs text-muted">
          {data.vehicle.registrationNumber} · {formatDuration(data.route.durationMin)} planned ·{' '}
          {formatDistance(data.route.distanceKm * 1000)} · solver {data.route.solver}
        </p>
      </Card>
    </div>
  );
}
