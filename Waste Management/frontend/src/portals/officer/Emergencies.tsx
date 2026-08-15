import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Siren, Truck, Phone } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, Meter, toast } from '../../components/ui';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONE, timeAgo, formatDuration } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';

/**
 * Emergency panel (plan §2.3) — unacknowledged emergencies with a live
 * countdown to auto-escalation. The countdown ticks client-side so an officer
 * sees urgency change without refreshing.
 */
export default function Emergencies() {
  const t = useT();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['officer', 'emergencies'],
    queryFn: async () => (await api('officer').get('/officer/emergencies')).data,
    refetchInterval: 20_000,
  });

  const sos = useQuery({
    queryKey: ['officer', 'sos'],
    queryFn: async () => (await api('officer').get('/officer/sos')).data,
    refetchInterval: 20_000,
  });

  const wards = useQuery({
    queryKey: ['officer', 'wards'],
    queryFn: async () => (await api('officer').get('/officer/wards')).data,
  });

  useSocket('officer', (wards.data ?? []).map((w: any) => `ward:${w.id}`), {
    [SOCKET_EVENTS.EMERGENCY_NEW]: () => {
      void queryClient.invalidateQueries({ queryKey: ['officer', 'emergencies'] });
      toast.error('New emergency reported');
    },
    [SOCKET_EVENTS.SOS_NEW]: () => void queryClient.invalidateQueries({ queryKey: ['officer', 'sos'] }),
  });

  const acknowledge = useMutation({
    mutationFn: async (id: string) => (await api('officer').post(`/officer/complaints/${id}/verify`, { decision: 'VERIFIED', note: 'Acknowledged by officer' })).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['officer'] });
      toast.success('Acknowledged — escalation timer stopped');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const ackSos = useMutation({
    mutationFn: async (id: string) => (await api('officer').post(`/officer/sos/${id}/acknowledge`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['officer', 'sos'] });
      toast.success('SOS acknowledged — the driver has been told you are responding');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Could not load emergencies" onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      {/* Driver SOS outranks everything else on this screen. */}
      {sos.data?.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-fluid-lg font-semibold">
            <Siren className="h-5 w-5 text-danger" /> Driver SOS
          </h2>
          <ul className="space-y-2.5">
            {sos.data.map((alert: any) => (
              <li key={alert.id}>
                <Card className="border-danger/50 bg-danger/5 p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white">
                      <Siren className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-fluid-base font-bold">{alert.driver?.name}</p>
                      <p className="text-fluid-xs text-muted">
                        {alert.vehicle?.registrationNumber} · {timeAgo(alert.createdAt)}
                      </p>
                      {alert.message && <p className="mt-1 text-fluid-sm">{alert.message}</p>}
                    </div>
                    <div className="flex gap-2">
                      {alert.driver?.phone && (
                        <a href={`tel:${alert.driver.phone}`} className="btn-ghost btn-sm">
                          <Phone className="h-3.5 w-3.5" /> Call
                        </a>
                      )}
                      <a
                        href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost btn-sm"
                      >
                        Locate
                      </a>
                      <button type="button" className="btn-danger btn-sm" onClick={() => ackSos.mutate(alert.id)}>
                        <Check className="h-3.5 w-3.5" /> Respond
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-fluid-lg font-semibold">Open emergencies</h2>
        {(data ?? []).length === 0 ? (
          <EmptyState
            title="No open emergencies"
            hint="Dead animals, medical waste, burning waste and sewage overflows appear here immediately with a 30-minute clock."
            icon={<Check className="h-8 w-8 text-ok" />}
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.map((c: any) => {
              const dueMs = c.dueAt ? new Date(c.dueAt).getTime() - now : null;
              const minutesLeft = dueMs != null ? Math.round(dueMs / 60_000) : null;
              const overdue = dueMs != null && dueMs < 0;

              return (
                <li key={c.id}>
                  <Card className={`p-4 ${overdue ? 'border-danger/60' : 'border-warn/40'}`}>
                    <div className="flex items-start gap-3">
                      {c.photoUrl ? (
                        <img src={c.photoUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
                          <Siren className="h-7 w-7" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-fluid-base font-bold">{t(`category.${c.category}`)}</p>
                          <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-fluid-xs text-muted">{c.address}</p>
                        <p className="font-mono text-fluid-xs text-faint">
                          {c.code} · {c.ward?.name} · {timeAgo(c.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Meter
                        value={c.sla?.pctElapsed ?? 0}
                        tone={overdue ? 'danger' : (minutesLeft ?? 60) < 10 ? 'warn' : 'info'}
                        label={
                          overdue
                            ? `Escalated · ${formatDuration(Math.abs(minutesLeft ?? 0))} over SLA`
                            : `${formatDuration(minutesLeft ?? 0)} until auto-escalation`
                        }
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <a
                        href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost btn-sm"
                      >
                        <Truck className="h-3.5 w-3.5" /> Locate
                      </a>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={c.status !== 'PENDING' || acknowledge.isPending}
                        onClick={() => acknowledge.mutate(c.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {c.status === 'PENDING' ? 'Acknowledge' : 'Acknowledged'}
                      </button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
