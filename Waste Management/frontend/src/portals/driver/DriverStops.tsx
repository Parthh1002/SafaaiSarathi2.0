import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, Loader2, Navigation, Play, SkipForward } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, Modal, toast } from '../../components/ui';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONE, timeAgo } from '../../lib/format';
import { useT } from '../../lib/i18n';

/**
 * Assigned complaints, synced with the map stops. Closing one requires photo
 * proof (plan §2.2) — the API rejects a resolution without it, and this screen
 * makes that obvious rather than letting the driver hit a wall.
 */
export default function DriverStops() {
  const t = useT();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [resolving, setResolving] = useState<any | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [note, setNote] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['driver', 'shift'],
    queryFn: async () => (await api('driver').get('/driver/shift')).data,
  });

  const start = useMutation({
    mutationFn: async (id: string) => (await api('driver').post(`/driver/complaints/${id}/start`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['driver'] });
      toast.success('Marked as in progress — the citizen has been notified');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const resolve = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('photo', photo!);
      if (note) form.append('note', note);
      return (await api('driver').post(`/driver/complaints/${resolving.id}/resolve`, form)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['driver'] });
      toast.success('Resolved with photo proof — the citizen has been notified');
      closeSheet();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not close this complaint')),
  });

  function closeSheet() {
    setResolving(null);
    setPhoto(null);
    setPreview('');
    setNote('');
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Could not load your stops" onRetry={() => refetch()} />;

  const complaints = data?.assignedComplaints ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-fluid-xl font-bold tracking-tight">Assigned stops</h1>
        <p className="mt-1 text-fluid-sm text-muted">
          {complaints.length} open · emergencies are listed first
        </p>
      </div>

      {complaints.length === 0 ? (
        <EmptyState
          title="Nothing assigned right now"
          hint="New assignments arrive here the moment your ward officer dispatches them."
          icon={<CheckCircle2 className="h-8 w-8" />}
        />
      ) : (
        <ul className="space-y-2.5">
          {complaints.map((c: any) => (
            <li key={c.id}>
              <Card className={`p-3.5 ${c.isEmergency ? 'border-danger/40' : ''}`}>
                <div className="flex items-start gap-3">
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" loading="lazy" />
                  ) : (
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-sunken text-faint">
                      <Camera className="h-5 w-5" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-fluid-sm font-semibold">
                        {t(`category.${c.category}`)}
                      </p>
                      {c.isEmergency && <Badge tone="danger">Emergency</Badge>}
                      <Badge tone={STATUS_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-fluid-xs text-muted">{c.address || c.description || c.code}</p>
                    <p className="mt-0.5 font-mono text-fluid-xs text-faint">
                      {c.code} · {timeAgo(c.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}&travelmode=driving`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost btn-sm"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Go
                  </a>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={c.status === 'IN_PROGRESS' || start.isPending}
                    onClick={() => start.mutate(c.id)}
                  >
                    {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    Start
                  </button>
                  <button type="button" className="btn-primary btn-sm" onClick={() => setResolving(c)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Done
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Route stops that are not complaint-linked can be skipped with a reason. */}
      {data?.route?.stops?.some((s: any) => s.status === 'PENDING' && !s.complaintId) && (
        <Card className="p-4">
          <p className="label">Other route stops</p>
          <ul className="space-y-2">
            {data.route.stops
              .filter((s: any) => s.status === 'PENDING' && !s.complaintId)
              .map((s: any) => (
                <li key={s.seq} className="flex items-center gap-2 text-fluid-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sunken text-fluid-xs font-bold">
                    {s.seq}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await api('driver').post(`/driver/stops/${s.seq}/skip`, { reason: 'Not reachable' });
                        await queryClient.invalidateQueries({ queryKey: ['driver'] });
                        toast.info(`Stop ${s.seq} skipped`);
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    <SkipForward className="h-3.5 w-3.5" /> Skip
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {/* Resolution sheet — photo proof is mandatory. */}
      <Modal
        open={Boolean(resolving)}
        onClose={closeSheet}
        title="Close with photo proof"
        footer={
          <button
            className="btn-primary w-full"
            disabled={!photo || resolve.isPending}
            onClick={() => resolve.mutate()}
          >
            {resolve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Mark resolved
          </button>
        }
      >
        <div className="space-y-4">
          <p className="text-fluid-sm text-muted">
            A photo of the cleared site is required. It is shown to the citizen and stored as the resolution record.
          </p>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line py-8 transition hover:border-brand"
          >
            {preview ? (
              <img src={preview} alt="" className="h-40 w-full rounded-xl object-cover" />
            ) : (
              <>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
                  <Camera className="h-7 w-7" />
                </span>
                <span className="text-fluid-sm font-semibold">Take the "after" photo</span>
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
            <label className="label" htmlFor="note">Note (optional)</label>
            <textarea
              id="note"
              className="field min-h-[72px] resize-y py-2.5"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Cleared two loads, bin replaced"
              maxLength={500}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
