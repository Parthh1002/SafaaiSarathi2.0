import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, ErrorState, Loading, SectionTitle, Stat, toast } from '../../components/ui';
import { formatDate, pct } from '../../lib/format';

/**
 * Compliance export centre (plan §2.4) — SWM Rules / Swachh Survekshan style
 * ward-wise reporting. CSV downloads through the API so the file matches
 * exactly what the server computed, and print-to-PDF uses the browser.
 */
export default function ComplianceExport() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'compliance', days],
    queryFn: async () => (await api('admin').get('/admin/export/compliance', { params: { days } })).data,
  });

  async function downloadCsv() {
    try {
      const res = await api('admin').get('/admin/export/compliance', {
        params: { days, format: 'csv' },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `safaai-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('Could not generate the CSV');
    }
  }

  if (isLoading) return <Loading label="Building the compliance report…" />;
  if (error) return <ErrorState message="Could not build the report" onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Compliance export"
        subtitle={data.title}
        action={
          <div className="flex flex-wrap gap-2">
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
            <button type="button" className="btn-ghost btn-sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={downloadCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Reported" value={data.totals.complaintsReported} />
        <Stat label="Resolved" value={data.totals.complaintsResolved} tone="ok" />
        <Stat label="Resolution rate" value={pct(data.totals.resolutionRatePct)} tone={data.totals.resolutionRatePct >= 80 ? 'ok' : 'warn'} />
        <Stat label="Still open" value={data.totals.openComplaints} tone={data.totals.openComplaints ? 'warn' : 'ok'} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <FileSpreadsheet className="h-4 w-4 text-muted" />
          <h3 className="text-fluid-sm font-semibold">Ward-wise summary</h3>
          <span className="ml-auto text-fluid-xs text-muted">
            {data.city} · generated {formatDate(data.generatedAt)}
          </span>
        </div>
        <div className="table-scroll">
          <table className="w-full min-w-[64rem] text-left text-fluid-sm">
            <thead className="border-b border-line bg-sunken/60 text-fluid-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Ward</th>
                <th className="px-4 py-2.5">Zone</th>
                <th className="px-4 py-2.5">Population</th>
                <th className="px-4 py-2.5">Reported</th>
                <th className="px-4 py-2.5">Resolved</th>
                <th className="px-4 py-2.5">Open</th>
                <th className="px-4 py-2.5">Emergencies</th>
                <th className="px-4 py-2.5">SLA %</th>
                <th className="px-4 py-2.5">Avg (min)</th>
                <th className="px-4 py-2.5">Vehicles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map((r: any) => (
                <tr key={r.wardCode} className="hover:bg-sunken/50">
                  <td className="px-4 py-2.5 font-medium">{r.wardName}</td>
                  <td className="px-4 py-2.5 text-fluid-xs text-muted">{r.zone}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.population.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.complaintsReported}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.complaintsResolved}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.openComplaints}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.emergencies}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-semibold tabular-nums ${r.slaCompliancePct >= 80 ? 'text-ok' : 'text-warn'}`}>
                      {r.slaCompliancePct}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{r.avgResolutionMinutes}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.vehiclesDeployed}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line bg-sunken/60 font-semibold">
              <tr>
                <td className="px-4 py-2.5" colSpan={3}>City total</td>
                <td className="px-4 py-2.5 tabular-nums">{data.totals.complaintsReported}</td>
                <td className="px-4 py-2.5 tabular-nums">{data.totals.complaintsResolved}</td>
                <td className="px-4 py-2.5 tabular-nums">{data.totals.openComplaints}</td>
                <td className="px-4 py-2.5 tabular-nums">{data.totals.emergencies}</td>
                <td className="px-4 py-2.5 tabular-nums">{data.totals.resolutionRatePct}%</td>
                <td className="px-4 py-2.5" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <p className="text-fluid-xs text-muted">
        Figures are computed from the operational database at export time. Every resolution counted here carries a
        crew photo and an audit-log entry.
      </p>
    </div>
  );
}
