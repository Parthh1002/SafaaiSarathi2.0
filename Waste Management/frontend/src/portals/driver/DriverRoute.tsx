import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Navigation, MapPin, Route as RouteIcon, Fuel, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, Meter, Stat } from '../../components/ui';
import { BaseMap, TruckMarker, RouteLine, PinMarker, FollowTarget } from '../../components/map/Map';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';
import { CATEGORY_LABELS, formatDistance, formatDuration } from '../../lib/format';
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

  if (isLoading) return <Loading label="Loading your route…" />;
  if (error) return <ErrorState message="Could not load your shift" onRetry={() => refetch()} />;

  if (!assignedStops.length) {
    return (
      <EmptyState
        title="No active stops assigned"
        hint="When your ward officer assigns new collection tasks, they will appear here live with turn-by-turn guidance."
        icon={<RouteIcon className="h-8 w-8 text-brand" />}
      />
    );
  }

  const centre: [number, number] = live
    ? [live.latitude, live.longitude]
    : polyline[0]
      ? [polyline[0][0], polyline[0][1]]
      : [23.2156, 72.6369];

  return (
    <div className="space-y-4">
      {/* Map first — driver's primary surface */}
      <Card className="overflow-hidden p-0 shadow-md">
        <div className="relative h-[46dvh] min-h-[260px] w-full">
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
            value={assignedStops.length ? (assignedStops.filter((s: any) => s.status === 'RESOLVED').length / assignedStops.length) * 100 : 0}
            tone="brand"
            label={`${assignedStops.filter((s: any) => s.status === 'RESOLVED').length} of ${assignedStops.length} stops completed`}
          />
        </div>
      </Card>

      {/* Next stop */}
      {nextStop && (
        <Card className="border-brand/30 p-4 shadow-sm">
          <p className="label mb-1">Current Active Stop</p>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink font-bold text-fluid-base">
              {nextStop.seq}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-fluid-base text-ink">{nextStop.label}</p>
              <p className="text-fluid-xs text-muted">
                {t(`category.${nextStop.category}`)} · {nextStop.code || 'Assigned Stop'}
              </p>
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${nextStop.latitude},${nextStop.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary btn-sm shrink-0"
            >
              <Navigation className="h-4 w-4" /> Start GPS
            </a>
          </div>
        </Card>
      )}

      {/* All stops list */}
      <Card className="divide-y divide-line p-0">
        {assignedStops.map((stop: any) => (
          <div key={stop.seq} className="flex items-center justify-between p-3 text-fluid-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sunken text-fluid-xs font-bold text-muted">
                {stop.seq}
              </span>
              <div>
                <p className="font-medium text-ink leading-tight">{stop.label}</p>
                <p className="text-[11px] text-muted">{t(`category.${stop.category}`)}</p>
              </div>
            </div>
            <Badge tone={stop.status === 'RESOLVED' ? 'ok' : stop.isEmergency ? 'danger' : 'brand'}>
              {stop.status}
            </Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
