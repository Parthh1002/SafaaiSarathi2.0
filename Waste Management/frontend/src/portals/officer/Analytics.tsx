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
import { api } from '../../lib/api';
import { Card, ErrorState, Loading, SectionTitle } from '../../components/ui';
import { pct, formatDuration } from '../../lib/format';

/**
 * Ward analytics (plan §2.3). Every chart sits in a ResponsiveContainer inside
 * a fixed-height box, so they reflow rather than overflow on a phone.
 */

const PALETTE = ['#16a34a', '#0ea5e9', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export default function Analytics() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['officer', 'analytics'],
    queryFn: async () => (await api('officer').get('/officer/analytics', { params: { days: 14 } })).data,
  });

  if (isLoading) return <Loading label="Crunching the numbers…" />;
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
      <SectionTitle title="Ward analytics" subtitle="Last 14 days" />

      <Card className="p-4">
        <h3 className="mb-3 text-fluid-sm font-semibold">Reported vs resolved</h3>
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
          <h3 className="mb-3 text-fluid-sm font-semibold">Complaints by category</h3>
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
          <h3 className="mb-3 text-fluid-sm font-semibold">SLA compliance by ward</h3>
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
        <h3 className="border-b border-line px-4 py-3 text-fluid-sm font-semibold">Ward performance</h3>
        <div className="table-scroll">
          <table className="w-full min-w-[44rem] text-left text-fluid-sm">
            <thead className="border-b border-line bg-sunken/60 text-fluid-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Ward</th>
                <th className="px-4 py-2.5">Open</th>
                <th className="px-4 py-2.5">Reported 7d</th>
                <th className="px-4 py-2.5">Resolved 7d</th>
                <th className="px-4 py-2.5">Avg resolution</th>
                <th className="px-4 py-2.5">SLA</th>
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
