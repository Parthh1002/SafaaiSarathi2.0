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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Fuel, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, ErrorState, Loading, SectionTitle, Stat } from '../../components/ui';
import { pct, formatDuration } from '../../lib/format';

const PALETTE = ['#16a34a', '#0ea5e9', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export default function Analytics() {
  const [range, setRange] = useState<'week' | 'month'>('week');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['officer', 'analytics', range],
    queryFn: async () => (await api('officer').get('/officer/analytics', { params: { range } })).data,
  });

  if (isLoading) return <Loading label="Crunching ward analytics…" />;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-fluid-xl font-bold tracking-tight">Ward Analytics</h1>
          <p className="text-fluid-xs text-muted">
            Performance metrics, complaint distribution, and fleet operational efficiency
          </p>
        </div>

        {/* Range Toggle */}
        <div className="flex rounded-xl border border-line bg-sunken p-1 text-fluid-xs font-semibold">
          <button
            type="button"
            onClick={() => setRange('week')}
            className={`rounded-lg px-3 py-1 transition ${range === 'week' ? 'bg-elevated text-ink shadow-sm' : 'text-muted'}`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setRange('month')}
            className={`rounded-lg px-3 py-1 transition ${range === 'month' ? 'bg-elevated text-ink shadow-sm' : 'text-muted'}`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Fuel & Fleet Consumption Highlights */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total Fuel Logged"
          value={`${data.fuel?.totalLiters || 0} L`}
          icon={<Fuel className="h-4 w-4 text-brand" />}
        />
        <Stat
          label="Fuel Expenditure"
          value={`₹${(data.fuel?.totalCost || 0).toLocaleString()}`}
          icon={<DollarSign className="h-4 w-4 text-ok" />}
        />
        <Stat
          label="Fuel Logs Filed"
          value={data.fuel?.entriesCount || 0}
          icon={<Calendar className="h-4 w-4" />}
        />
        <Stat
          label="Avg Resolution"
          value={formatDuration(data.wards?.[0]?.avgResolutionMinutes || 120)}
          icon={<TrendingUp className="h-4 w-4 text-brand" />}
        />
      </div>

      {/* Trends chart */}
      <Card className="p-4">
        <h3 className="mb-3 text-fluid-sm font-semibold">Reported vs Resolved Complaints</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trends} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="rep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="res" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="reported" name="Reported" stroke="#0ea5e9" fill="url(#rep)" strokeWidth={2} />
              <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#16a34a" fill="url(#res)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-fluid-sm font-semibold">Complaints by Category</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categories}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="52%"
                  outerRadius="80%"
                  paddingAngle={2}
                >
                  {data.categories.map((_: any, i: number) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-fluid-sm font-semibold">SLA Compliance by Ward</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.wards} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                <XAxis dataKey="code" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={36} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v}%`} />
                <Bar dataKey="slaCompliancePct" name="SLA %" radius={[6, 6, 0, 0]}>
                  {data.wards.map((w: any, i: number) => (
                    <Cell key={i} fill={w.slaCompliancePct >= 80 ? '#16a34a' : w.slaCompliancePct >= 60 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <h3 className="border-b border-line px-4 py-3 text-fluid-sm font-semibold">Ward Performance Table</h3>
        <div className="table-scroll">
          <table className="w-full min-w-[44rem] text-left text-fluid-sm">
            <thead className="border-b border-line bg-sunken/60 text-fluid-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Ward</th>
                <th className="px-4 py-2.5">Open</th>
                <th className="px-4 py-2.5">Reported</th>
                <th className="px-4 py-2.5">Resolved</th>
                <th className="px-4 py-2.5">Avg Resolution</th>
                <th className="px-4 py-2.5">SLA Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.wards.map((w: any) => (
                <tr key={w.id} className="hover:bg-sunken/50">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{w.name}</span>
                    <span className="ml-1.5 text-fluid-xs text-muted">{w.code}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{w.openComplaints}</td>
                  <td className="px-4 py-2.5 tabular-nums">{w.reported7d}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
