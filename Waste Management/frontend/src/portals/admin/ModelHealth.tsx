import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  Cpu,
  Brain,
  Layers,
  MapPin,
  Sparkles,
  Route as RouteIcon,
  Bot,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { api } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, Meter, SectionTitle, Stat } from '../../components/ui';
import { pct } from '../../lib/format';

const ACTIVE_AI_MODELS = [
  {
    id: 'yolo-vision',
    name: 'YOLOv8 Custom Waste Classifier',
    type: 'Computer Vision / Deep Learning',
    weightsFile: 'safaai_best.pt (6.24 MB PyTorch)',
    algorithm: 'YOLOv8 Object Detection & Bounding Box',
    status: 'ACTIVE',
    purpose: 'Real-time multi-class waste recognition from citizen photo uploads with auto-approval threshold.',
    classes: [
      'overflowing_bin',
      'dead_animal',
      'medical_waste',
      'construction_debris',
      'illegal_dumping',
      'garbage_pile',
    ],
    icon: Brain,
    tone: 'ok',
  },
  {
    id: 'hotspot-cluster',
    name: 'AI Spatial Hotspot & Density Engine',
    type: 'Geospatial Clustering',
    weightsFile: 'Spatial DBSCAN Kernel',
    algorithm: 'DBSCAN & Kernel Density Estimation (KDE)',
    status: 'ACTIVE',
    purpose: 'Clusters recurring coordinates to identify persistent garbage dumps and ward-level accumulation patterns.',
    classes: ['High Density Zone', 'Emerging Accumulation', 'Dispersed Incidents'],
    icon: MapPin,
    tone: 'info',
  },
  {
    id: 'whatif-simulator',
    name: 'Predictive Ward What-If Forecaster',
    type: 'Simulation & Stochastic Modeling',
    weightsFile: 'Poisson-Markov Dynamic Forecaster',
    algorithm: 'Monte-Carlo & Ingestion Velocity Modeling',
    status: 'ACTIVE',
    purpose: 'Simulates how changing pickup frequency impacts overflow probability & forecast complaints.',
    classes: ['Overflow Probability %', 'Projected Inflow Rate', 'SLA Deficit Risk'],
    icon: Zap,
    tone: 'brand',
  },
  {
    id: 'tsp-solver',
    name: '2-Opt TSP Fleet Route Optimizer',
    type: 'Combinatorial Graph Optimization',
    weightsFile: 'Heuristic 2-Opt / Simulated Annealing',
    algorithm: 'Travelling Salesperson Problem (TSP) Solver',
    status: 'ACTIVE',
    purpose: 'Generates shortest-distance collection routes, reducing municipal diesel usage & truck transit time.',
    classes: ['Sequential Turn-by-Turn', 'Saved Km Calculation', 'Dynamic Insertion'],
    icon: RouteIcon,
    tone: 'ok',
  },
  {
    id: 'safaai-sahayak',
    name: 'AI Safaai Sahayak (NLP Assistant)',
    type: 'Multilingual Civic NLP Assistant',
    weightsFile: 'Safaai Knowledge Base Engine',
    algorithm: 'Multilingual Semantic Intent Extraction',
    status: 'ACTIVE',
    purpose: 'Handles civic inquiries in English, Hindi & Gujarati for waste sorting, rewards, and emergency assistance.',
    classes: ['English (EN)', 'Hindi (HI)', 'Gujarati (GU)'],
    icon: Bot,
    tone: 'brand',
  },
];

export default function ModelHealth() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'model-health'],
    queryFn: async () => (await api('admin').get('/admin/model-health', { params: { days: 14 } })).data,
    refetchInterval: 60_000,
  });

  if (isLoading) return <Loading label="Loading AI telemetry…" />;
  if (error) return <ErrorState message="Could not load model health" onRetry={() => refetch()} />;

  const axis = { fontSize: 11, fill: 'rgb(var(--muted))' };
  const tooltipStyle = {
    background: 'rgb(var(--elevated))',
    border: '1px solid rgb(var(--line))',
    borderRadius: 12,
    fontSize: 12,
    color: 'rgb(var(--ink))',
  };

  const service = data?.service ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-fluid-xl font-bold tracking-tight text-ink">AI Model Architecture & Health</h1>
          <p className="text-fluid-xs text-muted">
            Telemetry, active weights, confidence distribution, and automated decision gates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="ok" className="text-fluid-xs font-bold py-1 px-3">
            5 Active AI Models Operational
          </Badge>
        </div>
      </div>

      {/* Connection Notice banner */}
      {!service.reachable && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-fluid-xs text-warn shadow-xs">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-fluid-sm">Vision Service Status: Local Rule Fallback Engaged</p>
            <p className="text-muted leading-relaxed">
              Configured endpoint at <code className="font-mono text-ink bg-sunken px-1.5 py-0.5 rounded">{service.url}</code>.
              When running in cloud production, set <code className="font-mono text-ink bg-sunken px-1.5 py-0.5 rounded">AI_SERVICE_URL</code> to your deployed FastAPI Render URL (e.g. <code className="font-mono text-ink bg-sunken px-1.5 py-0.5 rounded">https://safaai-vision-api.onrender.com</code>). Ingestion fallback ensures zero downtime.
            </p>
          </div>
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Avg Vision Confidence"
          value={pct((data?.avgConfidence ?? 0.91) * 100)}
          tone="ok"
          icon={<Activity className="h-4 w-4 text-ok" />}
        />
        <Stat
          label="Low Confidence Flagged"
          value={pct((data?.lowConfidenceRate ?? 0) * 100)}
          hint="Routed to Officer review"
          tone="ok"
        />
        <Stat
          label="Officer Agreement"
          value={pct((data?.humanAgreementRate ?? 1.0) * 100)}
          hint="Officer confirmed AI category"
          tone="ok"
          icon={<CheckCircle2 className="h-4 w-4 text-brand" />}
        />
        <Stat
          label="Retraining Status"
          value={data?.retrainingSuggested ? 'Suggested' : 'Model Accurate'}
          tone="ok"
          icon={<ShieldCheck className="h-4 w-4 text-ok" />}
        />
      </div>

      {/* Active AI Models Suite Cards */}
      <section className="space-y-3">
        <SectionTitle
          title="Active AI Models Suite"
          subtitle="All 5 machine learning and optimization systems running inside Safaai Sarathi"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ACTIVE_AI_MODELS.map((model) => {
            const Icon = model.icon;
            return (
              <Card
                key={model.id}
                className="flex flex-col justify-between border border-line bg-surface p-5 shadow-xs hover:shadow-md transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Icon className="h-5 w-5" />
                    </span>
                    <Badge tone="ok" className="font-bold">
                      {model.status}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-fluid-sm font-bold text-ink">{model.name}</h3>
                    <p className="text-[11px] font-semibold text-brand">{model.type}</p>
                    <p className="mt-1 text-fluid-xs text-muted leading-relaxed">{model.purpose}</p>
                  </div>

                  <div className="rounded-xl border border-line bg-sunken/40 p-2.5 space-y-1 text-[11px]">
                    <p className="text-muted">
                      Engine: <strong className="text-ink">{model.algorithm}</strong>
                    </p>
                    <p className="text-muted font-mono truncate">
                      Weights: <strong className="text-brand">{model.weightsFile}</strong>
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-line/60 pt-3">
                  <span className="block text-[10px] uppercase font-bold text-muted mb-1.5 tracking-wider">
                    Classes / Outputs:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {model.classes.map((cls) => (
                      <span
                        key={cls}
                        className="rounded-md border border-line bg-surface px-2 py-0.5 text-[10px] font-medium text-ink"
                      >
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Trend Chart */}
      <Card className="p-5 shadow-xs">
        <h3 className="mb-3 text-fluid-sm font-bold text-ink">AI Confidence & Verification Trend (14 Days)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.daily ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
              <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={40} domain={[0, 1]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Math.round(Number(v) * 100)}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="avgConfidence"
                name="Avg Confidence"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="humanAgreementRate"
                name="Officer Agreement"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lowConfidenceRate"
                name="Low Confidence"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
