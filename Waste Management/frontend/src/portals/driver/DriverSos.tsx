import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Siren } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Card, toast } from '../../components/ui';

/**
 * SOS (plan §2.2): instant alert to the nearest officer and every admin, with
 * live location attached. Held for two seconds so it cannot fire from a pocket
 * tap while driving.
 */
export default function DriverSos() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [message, setMessage] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);
  const [sent, setSent] = useState<any | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPosition(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const raise = useMutation({
    mutationFn: async () =>
      (
        await api('driver').post('/driver/sos', {
          latitude: position!.lat,
          longitude: position!.lng,
          message: message || undefined,
        })
      ).data,
    onSuccess: (data) => {
      setSent(data);
      toast.success('SOS sent — your ward officer has been alerted');
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not send the SOS')),
  });

  // Press-and-hold guard.
  useEffect(() => {
    if (holdProgress === 0 || holdProgress >= 100) return;
    const timer = setTimeout(() => setHoldProgress((p) => Math.min(100, p + 5)), 100);
    return () => clearTimeout(timer);
  }, [holdProgress]);

  useEffect(() => {
    if (holdProgress >= 100 && !raise.isPending && !sent) raise.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdProgress]);

  if (sent) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Card className="border-ok/30 bg-ok/5 p-6 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-ok text-white">
            <Siren className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-fluid-lg font-bold">SOS sent</h1>
          <p className="mt-2 text-fluid-sm text-muted">
            Your ward officer and the city admin have been alerted with your live location. Stay where you are if it is
            safe to do so.
          </p>
          <p className="mt-3 font-mono text-fluid-xs text-faint">
            {sent.latitude.toFixed(5)}, {sent.longitude.toFixed(5)}
          </p>
        </Card>
        <button type="button" className="btn-ghost w-full" onClick={() => setSent(null)}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-fluid-xl font-bold tracking-tight">Emergency SOS</h1>
        <p className="mt-1 text-fluid-sm text-muted">
          Use this if you are in danger, have had an accident, or need immediate help on the route.
        </p>
      </div>

      {!position && (
        <p className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-fluid-xs text-warn">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Waiting for GPS. The SOS is far more useful with your location attached.
        </p>
      )}

      <button
        type="button"
        onPointerDown={() => setHoldProgress(5)}
        onPointerUp={() => holdProgress < 100 && setHoldProgress(0)}
        onPointerLeave={() => holdProgress < 100 && setHoldProgress(0)}
        disabled={!position || raise.isPending}
        className="relative mx-auto grid h-48 w-48 place-items-center overflow-hidden rounded-full bg-danger text-white shadow-lift transition active:scale-95 disabled:opacity-60"
      >
        <span
          className="absolute inset-x-0 bottom-0 bg-white/25 transition-[height] duration-100"
          style={{ height: `${holdProgress}%` }}
          aria-hidden
        />
        <span className="relative flex flex-col items-center gap-2">
          {raise.isPending ? <Loader2 className="h-12 w-12 animate-spin" /> : <Siren className="h-12 w-12" />}
          <span className="text-fluid-base font-bold">{holdProgress > 0 ? 'Keep holding…' : 'Hold to send'}</span>
        </span>
      </button>

      <p className="text-center text-fluid-xs text-muted">Press and hold for two seconds to confirm.</p>

      <div>
        <label className="label" htmlFor="msg">What's happening? (optional)</label>
        <textarea
          id="msg"
          className="field min-h-[72px] resize-y py-2.5"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Vehicle breakdown on Ring Road"
          maxLength={300}
        />
      </div>
    </div>
  );
}
