import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AlertTriangle, Info, TrendingUp, Sparkles, Lightbulb, Play, Clock, ArrowRight, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, Meter, SectionTitle, toast } from '../../components/ui';
import { BaseMap, WardLayer, FitBounds, ComplaintLayer } from '../../components/map/Map';
import { formatDate } from '../../lib/format';

export default function Hotspots() {
  const [delayHours, setDelayHours] = useState(6);
  const [simResult, setSimResult] = useState<any | null>(null);

  const forecast = useQuery({
    queryKey: ['officer', 'hotspots'],
    queryFn: async () => (await api('officer').get('/officer/hotspots')).data,
  });
  const wards = useQuery({
    queryKey: ['officer', 'wards'],
    queryFn: async () => (await api('officer').get('/officer/wards')).data,
  });
  const recommendations = useQuery({
    queryKey: ['officer', 'recommendations'],
    queryFn: async () => (await api('officer').get('/officer/recommendations')).data,
  });

  const simulate = useMutation({
    mutationFn: async () => {
      const res = await api('officer').post('/officer/simulate', { delayHours });
      return res.data;
    },
    onSuccess: (data) => {
      setSimResult(data);
      toast.success('Simulation completed with real historical rates.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (forecast.isLoading) return <Loading label="Running the hotspot analysis…" />;
  if (forecast.error) return <ErrorState message="Could not load the forecast" onRetry={() => forecast.refetch()} />;

  const predictions = forecast.data?.predictions ?? [];
  const riskById = Object.fromEntries(predictions.map((p: any) => [p.wardId, p.riskScore]));
  const riskColour = (score: number) => (score >= 70 ? '#dc2626' : score >= 40 ? '#f59e0b' : '#16a34a');

  const recCards = recommendations.data?.recommendations ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-fluid-xl font-bold tracking-tight">Garbage Hotspots & AI Insights</h1>
        <p className="mt-1 text-fluid-xs text-muted">
          Spatial density clusters, predictive risk forecasts for {formatDate(forecast.data?.forDate)}, and automated recommendations.
        </p>
      </div>

      {/* AI Recommendation Cards */}
      {recCards.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-fluid-sm font-bold text-ink">
            <Sparkles className="h-4 w-4 text-brand" />
            <span>AI Automated Operational Recommendations</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {recCards.map((card: any) => (
              <Card key={card.id} className="flex flex-col justify-between p-4 border-brand/20 bg-brand/5 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <Badge tone={card.priority === 'CRITICAL' ? 'danger' : card.priority === 'HIGH' ? 'warn' : 'brand'}>
                      {card.priority}
                    </Badge>
                    <span className="text-fluid-xs font-semibold text-muted">{card.type}</span>
                  </div>
                  <h3 className="mt-2.5 text-fluid-sm font-bold text-ink">{card.title}</h3>
                  <p className="mt-1.5 text-fluid-xs text-muted leading-relaxed">{card.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Map & Risk List */}
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden p-0">
          <div className="h-[46dvh] min-h-[320px] w-full xl:h-[500px]">
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
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" /> High risk overflow</span>
          </div>
        </Card>

        <div className="space-y-3">
          <SectionTitle title="Ranked by Risk Score" subtitle="Prioritize pre-emptive morning sweeps" />
          {predictions.map((p: any) => (
            <Card key={p.wardId} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-fluid-base font-semibold">{p.name}</p>
                  <p className="text-fluid-xs text-muted">
                    ~{p.predictedCount} expected complaints
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
                <span>Confidence score</span>
                <span className="font-semibold tabular-nums">{Math.round((p.confidence ?? 0) * 100)}%</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* FEATURE 7: What-If Collection Simulator */}
      <Card className="p-5 border-line shadow-sm">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-fluid-base font-bold">What-If Collection Delay Simulator</h2>
            <p className="text-fluid-xs text-muted">
              Forecast spillover probability and additional complaints if collection is deferred
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Collection Delay Window</label>
                <span className="font-mono text-fluid-sm font-bold text-brand">+{delayHours} Hours</span>
              </div>
              <input
                type="range"
                min="1"
                max="48"
                step="1"
                value={delayHours}
                onChange={(e) => setDelayHours(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-faint">
                <span>Immediate (1h)</span>
                <span>6h Delay</span>
                <span>12h Delay</span>
                <span>24h Delay</span>
                <span>48h (Critical)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => simulate.mutate()}
              disabled={simulate.isPending}
              className="btn-primary w-full"
            >
              {simulate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Real-Time Simulation
            </button>
          </div>

          {/* Simulation Output */}
          <div className="rounded-xl border border-line bg-sunken/40 p-4">
            {simResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-fluid-xs font-semibold text-muted">Simulated Delay</span>
                  <Badge tone={simResult.estimatedSlaPenaltyRisk === 'HIGH' ? 'danger' : 'warn'}>
                    Risk: {simResult.estimatedSlaPenaltyRisk}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl border border-line bg-elevated p-3">
                    <p className="text-fluid-xs text-muted">Projected New Reports</p>
                    <p className="text-fluid-lg font-bold text-danger">+{simResult.projectedAdditionalReports}</p>
                    <p className="text-[10px] text-faint">Based on {simResult.averageReportsPerHour} reports/hr rate</p>
                  </div>
                  <div className="rounded-xl border border-line bg-elevated p-3">
                    <p className="text-fluid-xs text-muted">Overflow Probability</p>
                    <p className="text-fluid-lg font-bold text-warn">{simResult.overflowProbabilityPercent}%</p>
                    <p className="text-[10px] text-faint">Secondary bin required</p>
                  </div>
                </div>

                <div className="mt-2 space-y-1.5 text-fluid-xs text-muted">
                  <p className="flex items-center justify-between">
                    <span>Immediate Dispatch SLA:</span>
                    <strong className="text-ok">{simResult.immediateDispatchImpact.slaComplianceEstimated}</strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Delayed (+{delayHours}h) SLA Estimate:</span>
                    <strong className="text-danger">{simResult.delayedDispatchImpact.slaComplianceEstimated}</strong>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted">
                <Info className="h-8 w-8 text-faint mb-2" />
                <p className="text-fluid-xs">Select delay hours and click "Run Real-Time Simulation" to calculate historical impact.</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
