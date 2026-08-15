import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { api } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, Meter, SectionTitle, Stat } from '../../components/ui';
import { pct } from '../../lib/format';

/**
 * AI model health panel (plan §2.4): confidence trends, human-agreement rate,
 * and whether retraining is indicated.
 *
 * The "engine" field is shown prominently — if a model is a stand-in rather
 * than trained weights, the person running the city should be able to see that
 * at a glance.
 */
export default function ModelHealth() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'model-health'],
    queryFn: async () => (await api('admin').get('/admin/model-health', { params: { days: 14 } })).data,
    refetchInterval: 60_000,
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Could not load model health" onRetry={() => refetch()} />;

  const axis = { fontSize: 11, fill: 'rgb(var(--muted))' };
  const tooltipStyle = {
    background: 'rgb(var(--elevated))',
    border: '1px solid rgb(var(--line))',
    borderRadius: 12,
    fontSize: 12,
    color: 'rgb(var(--ink))',
  };

  const service = data.service ?? {};
  const models = service.models ?? {};

  return (
    <div className="space-y-5">
      <SectionTitle title="AI model health" subtitle={`Last ${data.windowDays} days · ${data.samples} classified reports`} />

      {!service.reachable && (
        <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-fluid-sm text-danger">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">Inference service unreachable</span> at {service.url}. New reports are being
            classified by the local fallback and flagged for manual review.
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Avg confidence"
          value={pct(data.avgConfidence * 100)}
          tone={data.avgConfidence >= 0.7 ? 'ok' : 'warn'}
          icon={<Activity className="h-4 w-4" />}
        />
        <Stat
          label="Low confidence"
          value={pct(data.lowConfidenceRate * 100)}
          hint="Routed to human review"
          tone={data.lowConfidenceRate > 0.4 ? 'warn' : 'ok'}
        />
        <Stat
          label="Human agreement"
          value={pct(data.humanAgreementRate * 100)}
          hint="Officer kept the AI's category"
          tone={data.humanAgreementRate >= 0.8 ? 'ok' : 'warn'}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <Stat
          label="Retraining"
          value={data.retrainingSuggested ? 'Suggested' : 'Not needed'}
          tone={data.retrainingSuggested ? 'warn' : 'ok'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      {data.retrainingSuggested && (
        <p className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-fluid-sm text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Low-confidence rate has stayed above 40% for three days. Collect the flagged images as a labelled batch and
            fine-tune before confidence drifts further.
          </span>
        </p>
      )}

      <Card className="p-4">
        <h3 className="mb-3 text-fluid-sm font-semibold">Confidence and agreement trend</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.daily} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
              <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={40} domain={[0, 1]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Math.round(Number(v) * 100)}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="avgConfidence" name="Avg confidence" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="humanAgreementRate" name="Human agreement" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="lowConfidenceRate" name="Low confidence" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Deployed models" subtitle="What is actually running behind each decision" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(models).map(([key, model]: [string, any]) => (
            <div key={key} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <p className="text-fluid-sm font-semibold capitalize">{key}</p>
                <Badge tone={model.engine === 'onnxruntime' ? 'ok' : model.engine === 'stub' ? 'warn' : 'info'}>
                  {model.engine}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-fluid-xs text-muted">
                {model.name} · {model.version}
              </p>
              {model.engine === 'stub' && (
                <p className="mt-1.5 text-fluid-xs text-warn">
                  Deterministic stand-in — no trained weights loaded. Set ONNX_MODEL_PATH to deploy the real model.
                </p>
              )}
            </div>
          ))}
        </div>
        {service.note && <p className="mt-3 text-fluid-xs text-faint">{service.note}</p>}
      </Card>

      <Card className="p-4">
        <SectionTitle title="Decision threshold" subtitle="Nothing health-related is decided automatically" />
        <Meter value={70} tone="brand" label="Auto-approve above" />
        <p className="mt-2 text-fluid-xs text-muted">
          Reports scoring under 70% confidence always go to a ward officer. Dead animal, medical waste, burning waste
          and sewage overflow are treated as emergencies regardless of the model's confidence.
        </p>
      </Card>
    </div>
  );
}
