import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from 'recharts';
import { api } from '../../lib/api';
import { Card, ErrorState, Loading, SectionTitle } from '../../components/ui';
import { pct, formatDuration } from '../../lib/format';

const PALETTE = ['#16a34a', '#0ea5e9', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export default function CityAnalytics() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: async () => (await api('admin').get('/admin/analytics', { params: { days } })).data,
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Could not load analytics" onRetry={() => refetch()} />;

  const axis = { fontSize: 11, fill: 'rgb(var(--muted))' };
  const tooltipStyle = {
    background: 'rgb(var(--elevated))',
    border: '1px solid rgb(var(--line))',
    borderRadius: 12,
    fontSize: 12,
    color: 'rgb(var(--ink))',
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        title="City analytics"
        subtitle={`Last ${days} days across every ward`}
        action={
          <div className="flex gap-1.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`chip transition ${days === d ? 'border-brand bg-brand/10 text-brand' : 'text-muted hover:bg-sunken'}`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      <Card className="p-4">
        <h3 className="mb-3 text-fluid-sm font-semibold">Reported, resolved and SLA compliance</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.trends} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis yAxisId="left" tick={axis} tickLine={false} axisLine={false} width={36} />
              <YAxis yAxisId="right" orientation="right" tick={axis} tickLine={false} axisLine={false} width={36} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="reported" name="Reported" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="resolved" name="Resolved" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="slaPct" name="SLA %" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-fluid-sm font-semibold">Emergencies over time</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="emg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="emergencies" name="Emergencies" stroke="#ef4444" fill="url(#emg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-fluid-sm font-semibold">Category mix</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categories} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" horizontal={false} />
                <XAxis type="number" tick={axis} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" tick={{ ...axis, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Complaints" radius={[0, 6, 6, 0]}>
                  {data.categories.map((_: any, i: number) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <h3 className="border-b border-line px-4 py-3 text-fluid-sm font-semibold">Ward-wise performance</h3>
        <div className="table-scroll">
          <table className="w-full min-w-[52rem] text-left text-fluid-sm">
            <thead className="border-b border-line bg-sunken/60 text-fluid-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Ward</th>
                <th className="px-4 py-2.5">Zone</th>
                <th className="px-4 py-2.5">Population</th>
                <th className="px-4 py-2.5">Open</th>
                <th className="px-4 py-2.5">Resolved 7d</th>
                <th className="px-4 py-2.5">Avg resolution</th>
                <th className="px-4 py-2.5">SLA</th>
                <th className="px-4 py-2.5">Trucks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.wards.map((w: any) => (
                <tr key={w.id} className="hover:bg-sunken/50">
                  <td className="px-4 py-2.5 font-medium">{w.name}</td>
                  <td className="px-4 py-2.5 text-fluid-xs text-muted">{w.zone}</td>
                  <td className="px-4 py-2.5 tabular-nums">{w.population.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 tabular-nums">{w.openComplaints}</td>
                  <td className="px-4 py-2.5 tabular-nums">{w.resolved7d}</td>
                  <td className="px-4 py-2.5">{formatDuration(w.avgResolutionMinutes)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`font-semibold tabular-nums ${
                        w.slaCompliancePct >= 80 ? 'text-ok' : w.slaCompliancePct >= 60 ? 'text-warn' : 'text-danger'
                      }`}
                    >
                      {pct(w.slaCompliancePct)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{w.vehicles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
