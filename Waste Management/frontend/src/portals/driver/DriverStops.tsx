import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, Loader2, Navigation, Play, RefreshCw, SkipForward, AlertCircle, BellRing } from 'lucide-react';
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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['driver', 'tasks', filter],
    queryFn: async () => {
      const res = await api('driver').get(`/driver/tasks?status=${filter}`);
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const vehicleId = data?.vehicleId;

  // Real-time task assignment listener over Socket.io
  useSocket('driver', vehicleId ? [`truck:${vehicleId}`] : [], {
    [SOCKET_EVENTS.ASSIGNMENT_NEW]: (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ['driver'] });
      playNotificationSound();
      toast.info('🔔 New collection task assigned by Ward Officer!');
    },
    'new_task_assigned': (payload: any) => {
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
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // AudioContext not allowed before user gesture
    }
  }

  const start = useMutation({
    mutationFn: async (id: string) => (await api('driver').post(`/driver/tasks/${id}/start`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['driver'] });
      toast.success('Collection started — live status updated');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const resolve = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error('Please take a clean-up proof photo first.');
      const form = new FormData();
      form.append('photo', photo);
      if (note) form.append('note', note);
      return (await api('driver').post(`/driver/tasks/${resolving.id}/complete`, form)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['driver'] });
      toast.success('Task marked collected with photo proof!');
      closeSheet();
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to complete task. Please try uploading again.')),
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

  return (
    <div className="space-y-4">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-fluid-xl font-bold tracking-tight">Collection Tasks</h1>
            <p className="text-fluid-xs text-muted">
              {tasks.length} {filter.toLowerCase()} stop{tasks.length === 1 ? '' : 's'} · Updates live via Socket.io
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-ghost btn-sm rounded-xl p-2"
            title="Refresh tasks"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-xl px-3 py-1.5 text-fluid-xs font-semibold transition ${
                filter === tab
                  ? 'bg-brand text-brand-ink shadow-sm'
                  : 'bg-sunken text-muted hover:text-ink'
              }`}
            >
              {tab === 'ALL' ? 'All Tasks' : tab === 'PENDING' ? 'Assigned' : tab === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
            </button>
          ))}
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks in this view"
          hint="When an officer assigns collection stops, they appear here instantly without refreshing."
          icon={<CheckCircle2 className="h-8 w-8 text-muted" />}
        />
      ) : (
        <ul className="space-y-3">
          {tasks.map((c: any) => (
            <li key={c.id}>
              <Card className={`p-4 transition ${c.isEmergency ? 'border-danger/50 shadow-danger/10' : ''}`}>
                <div className="flex items-start gap-3">
                  {c.photoUrl ? (
                    <img
                      src={c.photoUrl}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-xl object-cover border border-line"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-sunken text-faint">
                      <Camera className="h-6 w-6" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-fluid-sm font-bold text-ink">
                        {t(`category.${c.category}`)}
                      </span>
                      {c.isEmergency && <Badge tone="danger">Emergency</Badge>}
                      <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                    </div>

                    <p className="mt-1 line-clamp-2 text-fluid-xs text-muted">
                      {c.address || c.description || 'Reported Location'}
                    </p>

                    <div className="mt-1 flex items-center gap-2 font-mono text-fluid-xs text-faint">
                      <span>{c.code}</span>
                      {c.distanceKm != null && (
                        <span className="font-semibold text-brand">· {c.distanceKm} km away</span>
                      )}
                      <span>· {timeAgo(c.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Clean Photo Proof Thumbnail if completed */}
                {c.resolutionPhotoUrl && (
                  <div className="mt-3 rounded-xl border border-line/60 bg-sunken/40 p-2">
                    <p className="text-fluid-xs font-semibold text-muted">Proof of Work (Clean photo):</p>
                    <img
                      src={c.resolutionPhotoUrl}
                      alt="Proof of work"
                      className="mt-1 h-28 w-full rounded-lg object-cover"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                {c.status !== 'RESOLVED' && (
                  <div className="mt-3.5 grid grid-cols-3 gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost btn-sm flex items-center justify-center gap-1 text-fluid-xs"
                    >
                      <Navigation className="h-3.5 w-3.5 text-brand" /> Navigate
                    </a>

                    <button
                      type="button"
                      className="btn-ghost btn-sm flex items-center justify-center gap-1 text-fluid-xs"
                      disabled={c.status === 'IN_PROGRESS' || start.isPending}
                      onClick={() => start.mutate(c.id)}
                    >
                      {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {c.status === 'IN_PROGRESS' ? 'On Site' : 'Start'}
                    </button>

                    <button
                      type="button"
                      className="btn-primary btn-sm flex items-center justify-center gap-1 text-fluid-xs"
                      onClick={() => setResolving(c)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Done
                    </button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Proof of Work Modal — Photo upload is mandatory */}
      <Modal
        open={Boolean(resolving)}
        onClose={closeSheet}
        title="Proof of Work — Clean Photo"
        footer={
          <button
            className="btn-primary w-full"
            disabled={!photo || resolve.isPending}
            onClick={() => resolve.mutate()}
          >
            {resolve.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading & Resolving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Submit Clean Proof & Complete
              </>
            )}
          </button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-fluid-xs text-muted">
            <span className="font-semibold text-brand">Mandatory Step:</span> Take a clear photo of the cleaned site. The photo is timestamped, saved as verified proof of work, and updated live on the Citizen and Officer dashboards.
          </div>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-line py-8 transition hover:border-brand bg-sunken/50"
          >
            {preview ? (
              <div className="relative w-full px-2">
                <img src={preview} alt="Clean preview" className="h-44 w-full rounded-xl object-cover" />
                <span className="mt-2 block text-center text-fluid-xs font-semibold text-brand">Tap to retake photo</span>
              </div>
            ) : (
              <>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
                  <Camera className="h-7 w-7" />
                </span>
                <span className="text-fluid-sm font-semibold">Capture "Cleaned" Photo</span>
                <span className="text-fluid-xs text-faint">Camera or Gallery</span>
              </>
            )}
          </button>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) {
                setPhoto(selected);
                setPreview(URL.createObjectURL(selected));
              }
            }}
          />

          <div>
            <label className="label" htmlFor="note">Resolution Note (optional)</label>
            <textarea
              id="note"
              className="field min-h-[64px] resize-y py-2 text-fluid-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 2 bins emptied, area swept clean."
              maxLength={500}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
