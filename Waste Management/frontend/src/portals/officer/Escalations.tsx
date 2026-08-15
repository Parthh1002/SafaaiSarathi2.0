import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, SectionTitle } from '../../components/ui';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONE, formatDateTime, timeAgo } from '../../lib/format';
import { useT } from '../../lib/i18n';

/** Escalation log (plan §2.3) — what escalated, when, and why. */
export default function Escalations() {
  const t = useT();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['officer', 'escalations'],
    queryFn: async () => (await api('officer').get('/officer/escalations')).data,
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Could not load the escalation log" onRetry={() => refetch()} />;

  if (!data?.length) {
    return (
      <EmptyState
        title="Nothing has escalated"
        hint="Complaints escalate automatically when they pass their SLA without being acknowledged."
        icon={<Check className="h-8 w-8 text-ok" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Escalation log" subtitle="Automatic and manual escalations across your wards" />

      {/* Desktop table */}
      <Card className="hidden overflow-hidden p-0 md:block">
        <div className="table-scroll">
          <table className="w-full min-w-[48rem] text-left text-fluid-sm">
            <thead className="border-b border-line bg-sunken/60 text-fluid-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5">Level</th>
                <th className="px-3 py-2.5">Ticket</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Reason</th>
                <th className="px-3 py-2.5">Escalated to</th>
                <th className="px-3 py-2.5">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((e: any) => (
                <tr key={e.id} className="hover:bg-sunken/50">
                  <td className="px-3 py-2.5">
                    <Badge tone={e.level >= 2 ? 'danger' : 'warn'}>L{e.level}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-fluid-xs">{e.complaint?.code}</span>
                    <Badge tone={STATUS_TONE[e.complaint?.status]} className="ml-1.5">
                      {t(`status.${e.complaint?.status}`)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">{t(`category.${e.complaint?.category}`)}</td>
                  <td className="max-w-[20rem] px-3 py-2.5 text-fluid-xs text-muted">{e.reason}</td>
                  <td className="px-3 py-2.5 text-fluid-xs">
                    {e.escalatedTo ? `${e.escalatedTo.name} (${e.escalatedTo.role})` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-fluid-xs text-muted">{formatDateTime(e.escalatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <ul className="space-y-2.5 md:hidden">
        {data.map((e: any) => (
          <li key={e.id}>
            <Card className="p-3.5">
              <div className="flex items-center gap-2">
                <Badge tone={e.level >= 2 ? 'danger' : 'warn'}>
                  <ArrowUpRight className="h-3.5 w-3.5" /> L{e.level}
                </Badge>
                <span className="font-mono text-fluid-xs">{e.complaint?.code}</span>
                <span className="ml-auto text-fluid-xs text-muted">{timeAgo(e.escalatedAt)}</span>
              </div>
              <p className="mt-1.5 text-fluid-sm font-medium">
                {t(`category.${e.complaint?.category}`)}
              </p>
              <p className="mt-0.5 text-fluid-xs text-muted">{e.reason}</p>
              {e.escalatedTo && (
                <p className="mt-1 text-fluid-xs">
                  → <span className="font-medium">{e.escalatedTo.name}</span> ({e.escalatedTo.role})
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
