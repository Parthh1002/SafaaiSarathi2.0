import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  CheckCircle2,
  Loader2,
  Navigation,
  Play,
  RefreshCw,
  AlertCircle,
  Clock,
  ListChecks,
  MapPin,
  FileCheck,
  Truck,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, Modal, toast } from '../../components/ui';
import { STATUS_TONE, timeAgo } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useSocket, SOCKET_EVENTS } from '../../lib/socket';

export default function DriverStops() {
  const t = useT();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [resolving, setResolving] = useState<any | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [note, setNote] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['driver', 'tasks', filter],
    queryFn: async () => {
      const [res1, res2] = await Promise.all([
        api('driver').get(`/driver/tasks?status=${filter}`),
        api('driver').get('/driver/scheduled-tasks'),
      ]);

      const normalTasks = res1.data?.tasks || [];
      const scheduledTasks = (res2.data?.items || []).map((st: any) => ({
        ...st,
        isScheduled: true,
        category: 'SCHEDULED_PICKUP',
        description: `${st.eventReason} (Load: ${st.expectedQuantity})`,
      }));

      // Filter scheduled tasks based on status tab
      const filteredScheduled = scheduledTasks.filter((st: any) => {
        if (filter === 'ALL') return true;
        if (filter === 'PENDING') return st.status === 'ASSIGNED';
        if (filter === 'IN_PROGRESS') return st.status === 'IN_PROGRESS';
        if (filter === 'COMPLETED') return st.status === 'COMPLETED';
        return true;
      });

      return {
        ...res1.data,
        tasks: [...normalTasks, ...filteredScheduled],
        scheduledCount: scheduledTasks.length,
      };
    },
    refetchInterval: 20_000,
  });

  const vehicleId = data?.vehicleId;

  // Real-time task assignment listener over Socket.io
  useSocket('driver', vehicleId ? [`truck:${vehicleId}`] : [], {
    [SOCKET_EVENTS.ASSIGNMENT_NEW]: () => {
      queryClient.invalidateQueries({ queryKey: ['driver'] });
      playNotificationSound();
      toast.info('🔔 New collection task assigned by Ward Officer!');
    },
    new_task_assigned: () => {
      queryClient.invalidateQueries({ queryKey: ['driver'] });
      playNotificationSound();
      toast.info('🔔 New task dispatched to your truck!');
    },
    [SOCKET_EVENTS.COMPLAINT_UPDATE]: () => {
      queryClient.invalidateQueries({ queryKey: ['driver'] });
    },
  });

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      /* ignore */
    }
  }

  const start = useMutation({
    mutationFn: async (id: string) => (await api('driver').post(`/driver/tasks/${id}/start`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['driver'] });
      toast.success('Collection started — citizen notified');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const resolve = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error('Please take a clean-up proof photo first.');
      const form = new FormData();
      form.append('photo', photo);
      if (note) form.append('note', note);

      if (resolving.isScheduled) {
        return (await api('driver').post(`/driver/scheduled-tasks/${resolving.id}/complete`, form)).data;
      }
      return (await api('driver').post(`/driver/tasks/${resolving.id}/complete`, form)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['driver'] });
      toast.success('Task marked collected with clean photo proof! Citizen awarded Green Credits.');
      closeSheet();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function closeSheet() {
    setResolving(null);
    setPhoto(null);
    setPreview('');
    setNote('');
  }

  if (isLoading) return <Loading label="Loading assigned stops…" />;
  if (error) return <ErrorState message="Could not load your tasks" onRetry={() => refetch()} />;

  const tasks = data?.tasks ?? [];
  const counts = data?.counts ?? { total: 0, pending: 0, inProgress: 0, completed: 0 };

  return (
    <div className="space-y-5">
      {/* Top Header & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-fluid-xl font-bold tracking-tight text-ink">Collection Tasks</h1>
          <p className="text-fluid-xs text-muted">
            {counts.total} total stops assigned · Updates in real-time via Socket.io
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost btn-sm flex items-center gap-1.5 rounded-xl border border-line bg-elevated shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-brand' : 'text-muted'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Responsive Layout Grid */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left Column: Tasks List & Filters (8 of 12 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filter Bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(
              [
                { id: 'ALL', label: 'All Tasks', count: counts.total },
                { id: 'PENDING', label: 'Assigned', count: counts.pending },
                { id: 'IN_PROGRESS', label: 'In Progress', count: counts.inProgress },
                { id: 'COMPLETED', label: 'Completed', count: counts.completed },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-fluid-xs font-semibold transition ${
                  filter === tab.id
                    ? 'bg-brand text-brand-ink shadow-sm'
                    : 'border border-line bg-elevated text-muted hover:bg-sunken hover:text-ink'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    filter === tab.id ? 'bg-brand-ink/20 text-brand-ink' : 'bg-sunken text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Tasks Container */}
          {!tasks.length ? (
            <Card className="p-8 text-center">
              <EmptyState
                title="No tasks in this view"
                hint="When an officer assigns collection stops, they appear here instantly without refreshing."
                icon={<CheckCircle2 className="h-10 w-10 text-ok" />}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks.map((task: any) => {
                const isEmergency = task.isEmergency || task.priority === 'CRITICAL';
                const isDone = task.status === 'RESOLVED' || task.status === 'COMPLETED';
                const inProg = task.status === 'IN_PROGRESS';

                return (
                  <Card
                    key={task.id}
                    className={`overflow-hidden border p-4 sm:p-5 transition shadow-xs hover:shadow-md ${
                      isEmergency ? 'border-danger/40 bg-danger/5' : inProg ? 'border-brand/40 bg-brand/5' : 'bg-surface'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-fluid-xs font-bold text-ink">#{task.code}</span>
                          <Badge tone={STATUS_TONE[task.status] || 'neutral'}>{task.status}</Badge>
                          {isEmergency && <Badge tone="danger">Emergency (30m SLA)</Badge>}
                          {task.isScheduled && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 border border-brand/40 px-2.5 py-0.5 text-[10px] font-bold text-brand shadow-xs">
                              🗓️ Scheduled — {new Date(task.scheduledDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} ({task.scheduledTimeSlot})
                            </span>
                          )}
                          <span className="text-[11px] text-muted">{timeAgo(task.createdAt)}</span>
                        </div>

                        <h3 className="text-fluid-base font-bold text-ink leading-snug">
                          {task.isScheduled ? task.eventReason : (t(`category.${task.category}`) || task.category)}
                        </h3>

                        <p className="flex items-center gap-1.5 text-fluid-xs text-muted">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
                          <span className="truncate">{task.address || 'Reported Location'}</span>
                        </p>

                        {task.description && (
                          <p className="rounded-lg bg-sunken/60 p-2 text-fluid-xs text-muted italic">
                            "{task.description}"
                          </p>
                        )}
                      </div>

                      {/* Photo Thumbnail if available */}
                      {task.photoUrl && (
                        <a
                          href={task.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 overflow-hidden rounded-xl border border-line"
                        >
                          <img
                            src={task.photoUrl}
                            alt="Waste photo"
                            className="h-20 w-20 sm:h-24 sm:w-24 object-cover transition hover:scale-105"
                          />
                        </a>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost btn-sm flex items-center gap-1.5 rounded-xl border border-line text-fluid-xs font-semibold hover:bg-sunken"
                      >
                        <Navigation className="h-3.5 w-3.5 text-brand" /> GPS Directions
                      </a>

                      <div className="flex items-center gap-2">
                        {!isDone && !inProg && (
                          <button
                            type="button"
                            onClick={() => start.mutate(task.id)}
                            disabled={start.isPending}
                            className="btn-primary btn-sm flex items-center gap-1.5 rounded-xl"
                          >
                            <Play className="h-3.5 w-3.5" /> Start Trip
                          </button>
                        )}

                        {!isDone && (
                          <button
                            type="button"
                            onClick={() => setResolving(task)}
                            className="btn-sm flex items-center gap-1.5 rounded-xl bg-ok text-white font-bold shadow-xs hover:bg-ok/90"
                          >
                            <Camera className="h-3.5 w-3.5" /> Mark Collected
                          </button>
                        )}

                        {isDone && (
                          <span className="flex items-center gap-1 text-fluid-xs font-bold text-ok">
                            <CheckCircle2 className="h-4 w-4" /> Cleaned & Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Driver KPI Summary & Guidelines (4 of 12 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 shadow-xs border-brand/20 bg-gradient-to-br from-surface to-brand/5">
            <h2 className="text-fluid-xs font-bold uppercase tracking-wider text-muted">Today's Shift Progress</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-surface p-3 text-center">
                <span className="block text-fluid-xl font-extrabold text-brand tabular-nums">{counts.completed}</span>
                <span className="text-[11px] font-semibold text-muted">Completed</span>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 text-center">
                <span className="block text-fluid-xl font-extrabold text-warn tabular-nums">{counts.pending + counts.inProgress}</span>
                <span className="text-[11px] font-semibold text-muted">Pending</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-brand" />
              <h3 className="text-fluid-sm font-bold">Clean-Up Protocol</h3>
            </div>
            <ul className="space-y-2 text-fluid-xs text-muted leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand mt-0.5">1</span>
                <span>Reach the marked GPS coordinate and hit <strong>Start Trip</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand mt-0.5">2</span>
                <span>Safely load all waste into the collection compactor / truck.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand mt-0.5">3</span>
                <span>Take a clear photo of the <strong>cleaned location</strong> as verification proof.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Completion Modal */}
      {resolving && (
        <Modal
          open={Boolean(resolving)}
          onClose={closeSheet}
          title={`Proof of Cleanup: #${resolving.code}`}
          footer={
            <div className="flex gap-2 w-full">
              <button type="button" onClick={closeSheet} className="btn-ghost flex-1 rounded-xl">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resolve.mutate()}
                disabled={!photo || resolve.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5 rounded-xl font-bold"
              >
                {resolve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Submit Proof
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-fluid-xs text-muted">
              Upload a clear photo of the cleaned site to notify the citizen and complete this ticket.
            </p>

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPhoto(f);
                  setPreview(URL.createObjectURL(f));
                }
              }}
            />

            {preview ? (
              <div className="relative overflow-hidden rounded-2xl border border-line">
                <img src={preview} alt="Clean proof" className="h-48 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="absolute bottom-2 right-2 rounded-xl bg-black/70 px-3 py-1.5 text-fluid-xs font-bold text-white backdrop-blur"
                >
                  Retake Photo
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-brand/5 text-brand transition hover:bg-brand/10"
              >
                <Camera className="h-8 w-8" />
                <span className="text-fluid-xs font-bold">Take Clean Proof Photo</span>
              </button>
            )}

            <div>
              <label className="label" htmlFor="driver-note">
                Cleanup Note (Optional)
              </label>
              <textarea
                id="driver-note"
                className="field resize-none h-20 text-fluid-xs"
                placeholder="e.g. Cleared 250kg debris, area sanitized."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
