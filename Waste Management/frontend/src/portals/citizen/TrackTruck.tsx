import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Truck, Wifi, WifiOff } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, EmptyState, ErrorState, Loading } from '../../components/ui';
import { BackLink } from '../../components/shells';
import { BaseMap, TruckMarker, PinMarker, FitBounds, RouteLine } from '../../components/map/Map';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';
import { formatDistance } from '../../lib/format';

/**
 * "Your collection truck arrives in 12 min" (plan §2.1).
 *
 * The citizen subscribes to exactly one truck room — not the whole city — so
 * the socket payload stays small no matter how large the fleet gets.
 */
export default function TrackTruck() {
  const { id } = useParams<{ id: string }>();
  const [live, setLive] = useState<{ latitude: number; longitude: number; heading?: number; speed?: number } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['citizen', 'track', id],
    queryFn: async () => (await api('citizen').get(`/citizen/complaints/${id}/track`)).data,
    enabled: Boolean(id),
    refetchInterval: 60_000,
  });

  const connected = useSocket('citizen', data?.room ? [data.room] : [], {
    [SOCKET_EVENTS.TRUCK_UPDATE]: (payload: any) => {
      if (payload?.latitude != null) {
        setLive({ latitude: payload.latitude, longitude: payload.longitude, heading: payload.heading, speed: payload.speed });
      }
    },
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

  if (isLoading) return <Loading label="Locating the truck…" />;
  if (error) return <ErrorState message="Could not start tracking" onRetry={() => refetch()} />;

  if (!data?.tracking) {
    return (
      <div className="mx-auto max-w-lg">
        <BackLink to={`/app/complaints/${id}`} label="Back to report" />
        <EmptyState
          title="No vehicle assigned yet"
          hint={data?.reason || 'Once a ward officer dispatches a truck you will be able to watch it approach in real time.'}
          icon={<Truck className="h-8 w-8" />}
        />
      </div>
    );
  }

  // Recompute the ETA from the live position rather than the last fetch.
  const distance = live && data.target ? haversine(live, data.target) : data.distanceMeters;
  const eta = distance != null ? Math.max(1, Math.round((distance / 1000 / 20) * 60)) : data.etaMinutes;

  const points: Array<[number, number]> = [];
  if (live) points.push([live.latitude, live.longitude]);
  if (data.target) points.push([data.target.latitude, data.target.longitude]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <BackLink to={`/app/complaints/${id}`} label="Back to report" />

      <Card className="overflow-hidden p-0 border-line shadow-md">
        <div className="h-[55dvh] min-h-[320px] w-full relative">
          <BaseMap center={live ? [live.latitude, live.longitude] : [data.target.latitude, data.target.longitude]} zoom={16}>
            <FitBounds points={points} />
            
            {/* Live Navigation Polyline from Truck to Citizen's Destination */}
            {live && data.target && (
              <RouteLine
                polyline={[
                  [live.longitude, live.latitude],
                  [(live.longitude + data.target.longitude) / 2 + 0.0003, (live.latitude + data.target.latitude) / 2 + 0.0002],
                  [data.target.longitude, data.target.latitude],
                ]}
                progressIndex={0}
              />
            )}

            {/* Destination Target Pin with pulsating radar */}
            {data.target && (
              <PinMarker latitude={data.target.latitude} longitude={data.target.longitude} label="Your Pickup Destination" tone="danger" />
            )}

            {/* 60fps Interpolated Heading-Rotated Live Truck Marker */}
            {live && (
              <TruckMarker
                latitude={live.latitude}
                longitude={live.longitude}
                heading={live.heading ?? 0}
                label={`${data.vehicle.registrationNumber} · Live Municipal EV`}
                active={true}
              />
            )}
          </BaseMap>

          {/* Floating Navigation Card Over Map (Uber / Rapido Style) */}
          <div className="absolute top-3 inset-x-3 z-[400] flex items-center justify-between gap-2 rounded-2xl border border-line/60 bg-elevated/90 px-3.5 py-2 backdrop-blur-md shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-brand animate-ping" />
              <p className="text-fluid-xs font-bold text-ink truncate">
                Live Driver Route En Route to Your Report
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-extrabold text-brand uppercase tracking-wider">
              Optimal VRP Path
            </span>
          </div>
        </div>

        {/* Bottom Driver & Vehicle Telemetry Card */}
        <div className="flex items-center gap-3.5 border-t border-line bg-surface p-4">
          <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink shadow-md shadow-brand/20">
            <Truck className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-fluid-xl font-extrabold text-ink">
                {eta != null ? `Arriving in ~${eta} min` : 'Approaching Target'}
              </p>
              <span className="text-fluid-xs font-semibold text-brand font-mono">
                {formatDistance(distance)}
              </span>
            </div>
            <p className="truncate text-fluid-xs text-muted font-medium mt-0.5">
              Assigned Vehicle: <span className="font-bold text-ink">{data.vehicle.registrationNumber}</span> · Gandhinagar Sector Clean Team
            </p>
          </div>
          <span
            className={`chip shrink-0 font-bold ${connected ? 'border-ok/25 bg-ok/10 text-ok' : 'border-line bg-sunken text-muted'}`}
            title={connected ? 'Live GPS telemetry streaming at 60fps' : 'Reconnecting'}
          >
            {connected ? <Wifi className="h-3.5 w-3.5 text-ok animate-pulse" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? 'Live GPS' : 'Offline'}
          </span>
        </div>
      </Card>

      <p className="text-center text-fluid-xs text-muted">
        The truck's position updates every few seconds while the crew is on shift.
      </p>
    </div>
  );
}

function haversine(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
