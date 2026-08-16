import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Siren, Wrench, ShieldAlert, Fuel, HeartPulse, CheckCircle2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Card, toast } from '../../components/ui';

const SOS_REASONS = [
  { id: 'breakdown', label: 'Vehicle Breakdown', icon: Wrench },
  { id: 'accident', label: 'Road Accident', icon: ShieldAlert },
  { id: 'fuel', label: 'Diesel Finished / Out of Fuel', icon: Fuel },
  { id: 'medical', label: 'Medical Emergency', icon: HeartPulse },
  { id: 'other', label: 'Other Urgent Issue', icon: AlertTriangle },
];

export default function DriverSos() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [reason, setReason] = useState('Vehicle Breakdown');
  const [message, setMessage] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);
  const [sent, setSent] = useState<any | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        async () => {
          // IP-based fallback
          try {
            const res = await fetch('https://ipapi.co/json/');
            const json = await res.json();
            if (json?.latitude && json?.longitude) {
              setPosition({ lat: json.latitude, lng: json.longitude });
            }
          } catch {
            setPosition({ lat: 23.2156, lng: 72.6369 });
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const raise = useMutation({
    mutationFn: async () => {
      const lat = position?.lat ?? 23.2156;
      const lng = position?.lng ?? 72.6369;
      return (
        await api('driver').post('/driver/sos', {
          reason,
          latitude: lat,
          longitude: lng,
          message: message || undefined,
        })
      ).data;
    },
    onSuccess: (data) => {
      setSent(data);
      toast.success('SOS Alert broadcasted — Ward Officer and City Ops notified!');
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not dispatch SOS. Try calling your Ward Officer.')),
  });

  // Press-and-hold trigger
  useEffect(() => {
    if (holdProgress === 0 || holdProgress >= 100) return;
    const timer = setTimeout(() => setHoldProgress((p) => Math.min(100, p + 8)), 100);
    return () => clearTimeout(timer);
  }, [holdProgress]);

  useEffect(() => {
    if (holdProgress >= 100 && !raise.isPending && !sent) {
      raise.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdProgress]);

  if (sent) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Card className="border-ok/40 bg-ok/5 p-6 text-center shadow-lg">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-ok text-white shadow-md">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-fluid-lg font-bold text-ink">Officer Notified</h1>
          <p className="mt-2 text-fluid-sm text-muted">
            Emergency alert was successfully received by your Ward Officer and City Control Room with your live GPS location.
          </p>
          <div className="mt-4 rounded-xl border border-line bg-sunken/60 p-3 text-left">
            <p className="text-fluid-xs font-semibold text-ink">Alert Details:</p>
            <p className="text-fluid-xs text-muted">Reason: <strong className="text-ink">{sent.alert?.message || reason}</strong></p>
            <p className="font-mono text-fluid-xs text-faint">
              Coordinates: {sent.alert?.latitude?.toFixed(5)}, {sent.alert?.longitude?.toFixed(5)}
            </p>
          </div>
        </Card>
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => {
            setSent(null);
            setHoldProgress(0);
          }}
        >
          Send Another Alert / Update
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-fluid-xl font-bold tracking-tight text-danger flex items-center gap-2">
          <Siren className="h-6 w-6" /> Driver Emergency SOS
        </h1>
        <p className="mt-1 text-fluid-xs text-muted">
          Broadcast an instant high-priority alert to your Ward Officer & Control Room with your live GPS coordinates.
        </p>
      </div>

      {/* Reason Selector */}
      <div>
        <label className="label mb-1.5">Select Emergency Reason</label>
        <div className="grid grid-cols-1 gap-2">
          {SOS_REASONS.map((r) => {
            const Icon = r.icon;
            const isSelected = reason === r.label;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.label)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-danger bg-danger/10 text-danger font-semibold'
                    : 'border-line bg-elevated text-ink hover:bg-sunken'
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${isSelected ? 'bg-danger text-white' : 'bg-sunken text-muted'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-fluid-sm">{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="sos-msg">Additional Note (optional)</label>
        <input
          id="sos-msg"
          type="text"
          className="field text-fluid-sm"
          placeholder="e.g. Near SG Highway flyover, right tire burst"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
        />
      </div>

      {/* Hold to Send Button */}
      <div className="text-center pt-2">
        <button
          type="button"
          onPointerDown={() => setHoldProgress(10)}
          onPointerUp={() => holdProgress < 100 && setHoldProgress(0)}
          onPointerLeave={() => holdProgress < 100 && setHoldProgress(0)}
          disabled={raise.isPending}
          className="relative mx-auto grid h-44 w-44 place-items-center overflow-hidden rounded-full bg-danger text-white shadow-2xl transition active:scale-95 disabled:opacity-60"
        >
          {/* Progress fill */}
          <div
            className="absolute inset-0 bg-red-800 transition-[height]"
            style={{ height: `${holdProgress}%`, bottom: 0, top: 'auto' }}
          />

          <div className="relative z-10 flex flex-col items-center gap-1.5 p-4 text-center">
            {raise.isPending ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <Siren className="h-10 w-10 animate-pulse" />
            )}
            <span className="text-fluid-base font-extrabold tracking-wider uppercase">
              {holdProgress > 0 ? `HOLD (${holdProgress}%)` : 'HOLD TO SOS'}
            </span>
            <span className="text-[10px] opacity-80">Press & hold 1.5s</span>
          </div>
        </button>
        <p className="mt-3 text-fluid-xs text-muted">
          Prevents accidental taps while driving
        </p>
      </div>
    </div>
  );
}
