import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Route as RouteIcon,
  Fuel,
  Truck,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, SectionTitle, Stat } from '../../components/ui';
import { BaseMap, RouteLine } from '../../components/map/Map';
import { CATEGORY_LABELS, formatDateTime, formatDuration } from '../../lib/format';
import { useT } from '../../lib/i18n';

export default function DriverSummary() {
  const t = useT();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['driver', 'summary'],
    queryFn: async () => (await api('driver').get('/driver/summary')).data,
  });

  if (isLoading) return <Loading label="Loading shift summary…" />;
  if (error) return <ErrorState message="Could not load your shift summary" onRetry={() => refetch()} />;

  const trail: [number, number][] = (data.trail ?? []).map((p: any) => [p.latitude, p.longitude]);

  return (
    <div className="space-y-6">
      {/* Shift Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-fluid-xl font-bold tracking-tight text-ink">Daily Shift Summary</h1>
            <p className="text-fluid-xs text-muted">
              Vehicle: <strong className="text-ink">{data.vehicle.registrationNumber}</strong> · Shift Date: {data.date}
            </p>
          </div>
        </div>

        <Badge tone="ok" className="text-fluid-xs font-bold py-1 px-3">
          Shift Active
        </Badge>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Stops Done"
          value={`${data.stopsDone} / ${data.stopsTotal}`}
          icon={<MapPin className="h-4 w-4" />}
        />
        <Stat
          label="Resolved"
          value={data.resolved}
          tone="ok"
          icon={<CheckCircle2 className="h-4 w-4 text-ok" />}
        />
        <Stat
          label="Distance Driven"
          value={`${data.distanceKm} km`}
          hint={`${data.plannedKm} km planned`}
          icon={<RouteIcon className="h-4 w-4 text-brand" />}
        />
        <Stat
          label="Fuel Used"
          value={`${data.fuelLiters || 0} L`}
          icon={<Fuel className="h-4 w-4 text-warn" />}
        />
        <Stat
          label="Time On Route"
          value={formatDuration(data.minutesOnRoute)}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Responsive 2-Column Content Layout */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Left Column: GPS Trail Map */}
        <section className="space-y-3">
          <SectionTitle
            title="GPS Route Audit"
            subtitle="Recorded path and trajectory from truck onboard telemetry"
          />
          <Card className="overflow-hidden p-0 shadow-sm">
            <div className="h-72 sm:h-96 w-full">
              {trail.length > 0 ? (
                <BaseMap center={[trail[0][0], trail[0][1]]} zoom={14} scrollWheelZoom={false}>
                  <RouteLine polyline={trail} progressIndex={trail.length - 1} />
                </BaseMap>
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-fluid-xs text-muted">
                  GPS trail is being recorded as the truck moves.
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Right Column: Resolved Stops List */}
        <section className="space-y-3">
          <SectionTitle
            title="Resolved Complaints Today"
            subtitle="Tickets resolved and confirmed with proof photo"
          />
          {data.resolvedList?.length === 0 ? (
            <Card className="p-8 text-center">
              <EmptyState
                title="Nothing closed yet today"
                hint="Complaints you mark as collected will appear here with timestamps."
                icon={<CheckCircle2 className="h-8 w-8 text-muted" />}
              />
            </Card>
          ) : (
            <Card className="divide-y divide-line p-0 shadow-sm max-h-96 overflow-y-auto">
              {data.resolvedList.map((c: any) => (
                <div key={c.code} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunken/40 transition">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ok/10 text-ok">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-fluid-sm font-bold text-ink">{t(`category.${c.category}`)}</p>
                    <p className="font-mono text-fluid-xs text-muted">#{c.code}</p>
                  </div>
                  <span className="shrink-0 text-fluid-xs text-muted font-medium">
                    {formatDateTime(c.resolvedAt)}
                  </span>
                </div>
              ))}
            </Card>
          )}

          {data.skipped > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl border border-warn/30 bg-warn/10 p-3.5 text-fluid-xs text-warn">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {data.skipped} stop{data.skipped === 1 ? '' : 's'} skipped today — ward officer has been notified.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
