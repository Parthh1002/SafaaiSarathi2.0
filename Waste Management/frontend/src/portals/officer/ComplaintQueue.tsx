import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Eye, Search, Truck, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, Meter, Modal, toast } from '../../components/ui';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONE, SEVERITY_TONE, timeAgo, formatDuration } from '../../lib/format';
import { useT } from '../../lib/i18n';

/**
 * The complaint queue (plan §2.3).
 *
 * Dense sortable table on desktop; the same rows become stacked cards under
 * `md` so an officer can triage from a phone without horizontal scrolling.
 */
export default function ComplaintQueue() {
  const t = useT();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const filters = {
    status: params.get('status') || undefined,
    reviewNeeded: params.get('reviewNeeded') ? true : undefined,
    emergency: params.get('emergency') ? true : undefined,
    overdue: params.get('overdue') ? true : undefined,
    sort: params.get('sort') || 'newest',
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['officer', 'queue', filters, page, search],
    queryFn: async () =>
      (await api('officer').get('/officer/complaints', { params: { ...filters, page, pageSize: 25, search: search || undefined } })).data,
  });

  const fleet = useQuery({
    queryKey: ['officer', 'fleet'],
    queryFn: async () => (await api('officer').get('/officer/fleet')).data,
  });

  const detail = useQuery({
    queryKey: ['officer', 'complaint', detailId],
    queryFn: async () => (await api('officer').get(`/officer/complaints/${detailId}`)).data,
    enabled: Boolean(detailId),
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'VERIFIED' | 'REJECTED' }) =>
      (await api('officer').post(`/officer/complaints/${id}/verify`, { decision })).data,
    onSuccess: async (_d, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['officer'] });
      toast.success(vars.decision === 'VERIFIED' ? 'Verified and queued for dispatch' : 'Rejected');
      setDetailId(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const assign = useMutation({
    mutationFn: async (vehicleId: string) =>
      (await api('officer').post('/officer/complaints/assign', { complaintIds: selected, vehicleId })).data,
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['officer'] });
      toast.success(`${res.assigned} complaint(s) assigned to ${res.vehicle.registrationNumber}`);
      setSelected([]);
      setAssigning(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const setFilter = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
    setPage(1);
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              className="field pl-9"
              placeholder="Search by ticket or address"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select className="field w-auto min-w-[8rem]" value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>

          <select className="field w-auto min-w-[9rem]" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="severity">Severity</option>
            <option value="confidence">Lowest AI confidence</option>
            <option value="due">Due soonest</option>
          </select>

          {[
            { key: 'reviewNeeded', label: 'Review needed' },
            { key: 'emergency', label: 'Emergencies' },
            { key: 'overdue', label: 'Overdue' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key, params.get(f.key) ? undefined : '1')}
              className={`chip transition ${params.get(f.key) ? 'border-brand bg-brand/10 text-brand' : 'text-muted hover:bg-sunken'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Bulk assign bar */}
      {selected.length > 0 && (
        <Card className="flex flex-wrap items-center gap-3 border-brand/40 bg-brand/5 p-3">
          <p className="text-fluid-sm font-semibold">{selected.length} selected</p>
          <button type="button" className="btn-primary btn-sm ml-auto" onClick={() => setAssigning(true)}>
            <Truck className="h-3.5 w-3.5" /> Assign to a vehicle
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected([])}>Clear</button>
        </Card>
      )}

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState message="Could not load the queue" onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No complaints match these filters" hint="Try clearing a filter or widening the search." />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <div className="table-scroll">
              <table className="w-full min-w-[56rem] text-left text-fluid-sm">
                <thead className="border-b border-line bg-sunken/60 text-fluid-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={selected.length === items.length && items.length > 0}
                        onChange={(e) => setSelected(e.target.checked ? items.map((c: any) => c.id) : [])}
                      />
                    </th>
                    <th className="px-3 py-2.5">Ticket</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">AI confidence</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">SLA</th>
                    <th className="px-3 py-2.5">Reported</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((c: any) => (
                    <tr key={c.id} className={`transition hover:bg-sunken/50 ${c.isEmergency ? 'bg-danger/5' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.code}`}
                          checked={selected.includes(c.id)}
                          onChange={(e) =>
                            setSelected((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-fluid-xs">{c.code}</span>
                        {c.isEmergency && <Badge tone="danger" className="ml-1.5">SOS</Badge>}
                        <p className="max-w-[16rem] truncate text-fluid-xs text-muted">{c.address}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block truncate">{t(`category.${c.category}`)}</span>
                        <Badge tone={SEVERITY_TONE[c.severity]} className="mt-0.5">{c.severity}</Badge>
                      </td>
                      <td className="w-40 px-3 py-2.5">
                        <Meter
                          value={(c.aiConfidence ?? 0) * 100}
                          tone={c.aiVerified ? 'ok' : c.reviewNeeded ? 'warn' : 'info'}
                        />
                        {c.reviewNeeded && <span className="mt-1 block text-fluid-xs font-medium text-warn">Review needed</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        {c.sla ? (
                          <span className={`text-fluid-xs font-medium ${c.sla.overdue ? 'text-danger' : 'text-muted'}`}>
                            {c.sla.overdue ? `${formatDuration(-c.sla.minutesLeft)} over` : formatDuration(c.sla.minutesLeft) + ' left'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-fluid-xs text-muted">{timeAgo(c.createdAt)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" className="btn-ghost btn-sm" onClick={() => setDetailId(c.id)}>
                          <Eye className="h-3.5 w-3.5" /> Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards — the same data, no sideways scrolling. */}
          <ul className="space-y-2.5 md:hidden">
            {items.map((c: any) => (
              <li key={c.id}>
                <Card className={`p-3.5 ${c.isEmergency ? 'border-danger/40' : ''}`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label={`Select ${c.code}`}
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-fluid-xs">{c.code}</span>
                        {c.isEmergency && <Badge tone="danger">SOS</Badge>}
                        <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
                      </div>
                      <p className="mt-1 truncate text-fluid-sm font-semibold">{t(`category.${c.category}`)}</p>
                      <p className="truncate text-fluid-xs text-muted">{c.address}</p>
                      <div className="mt-2">
                        <Meter value={(c.aiConfidence ?? 0) * 100} tone={c.aiVerified ? 'ok' : 'warn'} label="AI confidence" />
                      </div>
                      <button type="button" className="btn-ghost btn-sm mt-2 w-full" onClick={() => setDetailId(c.id)}>
                        <Eye className="h-3.5 w-3.5" /> Open
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-fluid-xs text-muted">
                Page {data.page} of {data.pages} · {data.total} complaints
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button type="button" className="btn-ghost btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail sheet */}
      <Modal open={Boolean(detailId)} onClose={() => setDetailId(null)} title="Complaint detail" wide>
        {detail.isLoading ? (
          <Loading />
        ) : detail.data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-fluid-sm">{detail.data.code}</span>
              <Badge tone={STATUS_TONE[detail.data.status]}>{t(`status.${detail.data.status}`)}</Badge>
              {detail.data.isEmergency && <Badge tone="danger">Emergency</Badge>}
              {detail.data.reviewNeeded && <Badge tone="warn">Review needed</Badge>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {detail.data.photoUrl && (
                <img src={detail.data.photoUrl} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
              )}
              <div className="space-y-2.5 text-fluid-sm">
                <Row label="Category" value={t(`category.${detail.data.category}`)} />
                <Row label="AI thought" value={detail.data.aiCategory ? t(`category.${detail.data.aiCategory}`) : '—'} />
                <Row label="Confidence" value={`${Math.round((detail.data.aiConfidence ?? 0) * 100)}%`} />
                <Row label="Fraud score" value={`${Math.round((detail.data.fraudScore ?? 0) * 100)}%`} />
                <Row label="Ward" value={detail.data.ward?.name ?? '—'} />
                <Row label="Reported by" value={detail.data.citizen?.name ?? '—'} />
                <Row label="Address" value={detail.data.address ?? '—'} />
                <Row label="Reported" value={timeAgo(detail.data.createdAt)} />
              </div>
            </div>

            {detail.data.fraudSignals?.length > 0 && (
              <div className="rounded-xl border border-warn/30 bg-warn/10 p-3">
                <p className="text-fluid-xs font-semibold text-warn">Fraud signals</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {detail.data.fraudSignals.map((s: string) => (
                    <Badge key={s} tone="warn">{s.replace(/_/g, ' ')}</Badge>
                  ))}
                </ul>
              </div>
            )}

            {detail.data.duplicates?.length > 0 && (
              <div className="rounded-xl border border-info/30 bg-info/10 p-3 text-fluid-xs text-info">
                Merged with {detail.data.duplicates.length} duplicate report(s).
              </div>
            )}

            {detail.data.description && (
              <div>
                <p className="label">Citizen's description</p>
                <p className="text-fluid-sm">{detail.data.description}</p>
              </div>
            )}

            <div>
              <p className="label">Timeline</p>
              <ol className="space-y-1.5">
                {detail.data.timeline?.map((t: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-fluid-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <span>
                      <span className="font-medium">{t(`status.${t.status}`)}</span>
                      {t.note ? ` — ${t.note}` : ''} · <span className="text-muted">{timeAgo(t.at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {['PENDING'].includes(detail.data.status) && (
              <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  className="btn-danger"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: detail.data.id, decision: 'REJECTED' })}
                >
                  <X className="h-4 w-4" /> Reject
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: detail.data.id, decision: 'VERIFIED' })}
                >
                  <Check className="h-4 w-4" /> Verify
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Assign sheet */}
      <Modal open={assigning} onClose={() => setAssigning(false)} title={`Assign ${selected.length} complaint(s)`}>
        <ul className="space-y-2">
          {(fleet.data ?? []).map((v: any) => (
            <li key={v.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left transition hover:bg-sunken disabled:opacity-50"
                disabled={assign.isPending || v.maintenanceFlag}
                onClick={() => assign.mutate(v.id)}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Truck className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fluid-sm font-semibold">{v.registrationNumber}</span>
                  <span className="block truncate text-fluid-xs text-muted">
                    {v.driver?.name ?? 'No driver'} · {v.assignedOpen} open · {v.status}
                  </span>
                </span>
                {v.maintenanceFlag && <Badge tone="warn">Maintenance</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-fluid-xs text-muted">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  );
}
