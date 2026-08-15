import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, Meter, SectionTitle } from '../../components/ui';
import { BaseMap, WardLayer, FitBounds } from '../../components/map/Map';
import { formatDate } from '../../lib/format';

/**
 * Hotspot prediction (plan §2.3): "tomorrow this zone likely overflows".
 *
 * The response says which model produced the forecast. When the LightGBM
 * service is unavailable the API falls back to a seasonal baseline and labels
 * it as such — a forecast presented as more certain than it is would be worse
 * than no forecast.
 */
export default function Hotspots() {
  const forecast = useQuery({
    queryKey: ['officer', 'hotspots'],
    queryFn: async () => (await api('officer').get('/officer/hotspots')).data,
  });
  const wards = useQuery({
    queryKey: ['officer', 'wards'],
    queryFn: async () => (await api('officer').get('/officer/wards')).data,
  });

  if (forecast.isLoading) return <Loading label="Running the forecast…" />;
  if (forecast.error) return <ErrorState message="Could not load the forecast" onRetry={() => forecast.refetch()} />;

  const predictions = forecast.data?.predictions ?? [];
  const riskById = Object.fromEntries(predictions.map((p: any) => [p.wardId, p.riskScore]));

  const riskColour = (score: number) => (score >= 70 ? '#dc2626' : score >= 40 ? '#f59e0b' : '#16a34a');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-fluid-xl font-bold tracking-tight">Hotspot forecast</h1>
        <p className="mt-1 text-fluid-sm text-muted">
          Predicted complaint pressure for {formatDate(forecast.data?.forDate)} · model {forecast.data?.modelVersion}
        </p>
      </div>

      {forecast.data?.source === 'api-fallback' && (
        <p className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-fluid-xs text-warn">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">Baseline forecast.</span> {forecast.data.note} These numbers come from a
            seasonal weekday average, not the trained model.
          </span>
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden p-0">
          <div className="h-[46dvh] min-h-[300px] w-full xl:h-[520px]">
            <BaseMap center={[23.2156, 72.6369]} zoom={12}>
              <FitBounds points={(wards.data ?? []).map((w: any) => [w.center.latitude, w.center.longitude])} />
              {wards.data && (
                <WardLayer
                  wards={wards.data.map((w: any) => ({ ...w, openComplaints: w.openComplaints }))}
                  colorFor={(w: any) => riskColour(riskById[w.id] ?? 0)}
                />
              )}
            </BaseMap>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 text-fluid-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" /> Low risk</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" /> Watch</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" /> Likely overflow</span>
          </div>
        </Card>

        <div className="space-y-3">
          <SectionTitle title="Ranked by risk" subtitle="Send trucks before the pile appears" />
          {predictions.map((p: any) => (
            <Card key={p.wardId} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-fluid-base font-semibold">{p.name}</p>
                  <p className="text-fluid-xs text-muted">
                    ~{p.predictedCount} complaints expected
                  </p>
                </div>
                <Badge tone={p.riskScore >= 70 ? 'danger' : p.riskScore >= 40 ? 'warn' : 'ok'}>
                  {p.riskScore >= 70 ? <AlertTriangle className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                  {p.riskScore}
                </Badge>
              </div>

              <div className="mt-2.5">
                <Meter
                  value={p.riskScore}
                  tone={p.riskScore >= 70 ? 'danger' : p.riskScore >= 40 ? 'warn' : 'ok'}
                  label="Risk score"
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-fluid-xs text-muted">
                <span>Model confidence</span>
                <span className="font-semibold tabular-nums">{Math.round((p.confidence ?? 0) * 100)}%</span>
              </div>

              {p.drivers?.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-fluid-xs font-medium text-brand">Why this score</summary>
                  <ul className="mt-1.5 space-y-1">
                    {p.drivers.map((d: any) => (
                      <li key={d.feature} className="flex items-center justify-between gap-2 text-fluid-xs">
                        <span className="truncate text-muted">{d.feature.replace(/_/g, ' ')}</span>
                        <span className="shrink-0 font-mono tabular-nums">{d.value}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
