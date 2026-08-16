import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, MapPin, Route as RouteIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, EmptyState, ErrorState, Loading, SectionTitle, Stat } from '../../components/ui';
import { BaseMap, RouteLine } from '../../components/map/Map';
import { CATEGORY_LABELS, formatDateTime, formatDuration } from '../../lib/format';
import { useT } from '../../lib/i18n';

export default function DriverSummary() {
  const t = useT();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['driver', 'summary'],
    queryFn: async () => (await api('driver').get('/driver/summary')).data,
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Could not load your shift summary" onRetry={() => refetch()} />;

  // The GPS trail doubles as the audit record of where the truck actually went.
  const trail: [number, number][] = (data.trail ?? []).map((p: any) => [p.longitude, p.latitude]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-fluid-xl font-bold tracking-tight">Shift summary</h1>
        <p className="mt-1 text-fluid-sm text-muted">
          {data.vehicle.registrationNumber} · {data.date}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Stops done" value={`${data.stopsDone}/${data.stopsTotal}`} icon={<MapPin className="h-4 w-4" />} />
        <Stat label="Resolved" value={data.resolved} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Distance" value={`${data.distanceKm} km`} hint={`${data.plannedKm} km planned`} icon={<RouteIcon className="h-4 w-4" />} />
        <Stat label="Fuel Used" value={`${data.fuelLiters || 0} L`} icon={<RouteIcon className="h-4 w-4 text-brand" />} />
        <Stat label="On route" value={formatDuration(data.minutesOnRoute)} icon={<Clock className="h-4 w-4" />} />
      </div>

      {trail.length > 1 && (
        <section>
          <SectionTitle title="Where you drove" subtitle="Recorded from your GPS pings" />
          <Card className="overflow-hidden p-0">
            <div className="h-64 w-full">
              <BaseMap center={[trail[0][1], trail[0][0]]} zoom={14} scrollWheelZoom={false}>
                <RouteLine polyline={trail} progressIndex={trail.length - 1} />
              </BaseMap>
            </div>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle title="Resolved today" />
        {data.resolvedList?.length === 0 ? (
          <EmptyState title="Nothing closed yet today" hint="Complaints you resolve will be listed here." />
        ) : (
          <Card className="divide-y divide-line p-0">
            {data.resolvedList.map((c: any) => (
              <div key={c.code} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-fluid-sm font-medium">{t(`category.${c.category}`)}</p>
                  <p className="font-mono text-fluid-xs text-muted">{c.code}</p>
                </div>
                <span className="shrink-0 text-fluid-xs text-faint">{formatDateTime(c.resolvedAt)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      {data.skipped > 0 && (
        <p className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-fluid-xs text-warn">
          {data.skipped} stop{data.skipped === 1 ? '' : 's'} skipped today — your ward officer can see the reasons.
        </p>
      )}
    </div>
  );
}
