import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  Loader2,
  Siren,
  Wrench,
  ShieldAlert,
  Fuel,
  HeartPulse,
  CheckCircle2,
  PhoneCall,
  MapPin,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Card, toast } from '../../components/ui';

const SOS_REASONS = [
  { id: 'breakdown', label: 'Vehicle Breakdown / Puncture', icon: Wrench },
  { id: 'accident', label: 'Road Accident', icon: ShieldAlert },
  { id: 'fuel', label: 'Diesel Finished / Out of Fuel', icon: Fuel },
  { id: 'medical', label: 'Medical Emergency', icon: HeartPulse },
  { id: 'other', label: 'Other Urgent Assistance', icon: AlertTriangle },
];

export default function DriverSos() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [reason, setReason] = useState('Vehicle Breakdown / Puncture');
  const [message, setMessage] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);
  const [sent, setSent] = useState<any | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setPosition({ lat: 23.2156, lng: 72.6369 }),
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

  // Press-and-hold trigger logic
  useEffect(() => {
    if (holdProgress === 0 || holdProgress >= 100) return;
    const timer = setTimeout(() => setHoldProgress((p) => Math.min(100, p + 8)), 100);
    return () => clearTimeout(timer);
  }, [holdProgress]);

  useEffect(() => {
    if (holdProgress >= 100 && !raise.isPending && !sent) {
      raise.mutate();
    }
  }, [holdProgress, raise, sent]);

  if (sent) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <Card className="border-ok/40 bg-ok/5 p-6 text-center shadow-lg">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-ok text-white shadow-md">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-fluid-lg font-bold text-ink">SOS Alert Broadcasted</h1>
          <p className="mt-2 text-fluid-sm text-muted">
            Emergency alert was received by your Ward Officer and City Control Room with your live GPS location.
          </p>
          <div className="mt-4 rounded-xl border border-line bg-surface p-3 text-left">
            <p className="text-fluid-xs font-semibold text-ink">Dispatched Details:</p>
            <p className="text-fluid-xs text-muted">
              Reason: <strong className="text-ink">{sent.alert?.message || reason}</strong>
            </p>
            <p className="font-mono text-fluid-xs text-faint">
              Coordinates: {sent.alert?.latitude?.toFixed(5)}, {sent.alert?.longitude?.toFixed(5)}
            </p>
          </div>
        </Card>
        <button
          type="button"
          className="btn-ghost w-full rounded-xl border border-line"
          onClick={() => {
            setSent(null);
            setHoldProgress(0);
            setMessage('');
          }}
        >
          Dismiss & Reset Emergency
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
            <Siren className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-fluid-xl font-bold tracking-tight text-danger">Driver Emergency SOS</h1>
            <p className="text-fluid-xs text-muted">
              Broadcasts immediate high-priority alert with live GPS coordinates to Ward Officer & Municipal Control Room
            </p>
          </div>
        </div>

        {position && (
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-1.5 text-fluid-xs text-muted">
            <MapPin className="h-3.5 w-3.5 text-danger" />
            <span>
              GPS: {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
            </span>
          </div>
        )}
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Select Reason & Note (7 of 12 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5 space-y-4 shadow-sm">
            <div>
              <label className="label">1. Select Emergency Reason</label>
              <div className="space-y-2">
                {SOS_REASONS.map((item) => {
                  const Icon = item.icon;
                  const selected = reason === item.label;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setReason(item.label)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? 'border-danger bg-danger/10 text-danger shadow-xs'
                          : 'border-line bg-surface hover:bg-sunken text-ink'
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                          selected ? 'bg-danger text-white' : 'bg-sunken text-muted'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 text-fluid-xs font-semibold">{item.label}</span>
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                          selected ? 'border-danger bg-danger' : 'border-line'
                        }`}
                      >
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="sos-note">
                2. Additional Note (Optional)
              </label>
              <input
                id="sos-note"
                className="field text-fluid-xs"
                placeholder="e.g. Right front tyre burst near Infocity circle"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </Card>
        </div>

        {/* Right Column: Hold-To-Broadcast Trigger & Helplines (5 of 12 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Big Trigger Card */}
          <Card className="p-6 text-center space-y-4 border-danger/30 bg-gradient-to-b from-surface to-danger/5 shadow-md">
            <h2 className="text-fluid-sm font-bold uppercase tracking-wider text-danger">3. Hold To Broadcast</h2>
            <p className="text-fluid-xs text-muted">Press and hold the button below for 2 seconds to trigger emergency.</p>

            <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
              {/* Progress ring background */}
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="rgb(var(--line))" strokeWidth="6" fill="none" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#dc2626"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * holdProgress) / 100}
                  className="transition-all duration-100 ease-linear"
                />
              </svg>

              <button
                type="button"
                onMouseDown={() => setHoldProgress(10)}
                onMouseUp={() => setHoldProgress(0)}
                onTouchStart={() => setHoldProgress(10)}
                onTouchEnd={() => setHoldProgress(0)}
                disabled={raise.isPending}
                className="relative grid h-28 w-28 place-items-center rounded-full bg-danger text-white shadow-xl transition active:scale-95 disabled:opacity-50 select-none cursor-pointer"
              >
                {raise.isPending ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <div className="flex flex-col items-center">
                    <Siren className="h-7 w-7" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider mt-1">HOLD SOS</span>
                  </div>
                )}
              </button>
            </div>

            <p className="text-[11px] font-medium text-faint">
              {holdProgress > 0 && holdProgress < 100
                ? `Broadcasting in ${Math.round((100 - holdProgress) / 40)}s…`
                : 'Release to cancel anytime'}
            </p>
          </Card>

          {/* Speed Dial Helplines */}
          <Card className="p-4 space-y-2.5">
            <h3 className="text-fluid-xs font-bold uppercase tracking-wider text-muted">Direct Emergency Helplines</h3>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="tel:07923227900"
                className="flex items-center gap-2 rounded-xl border border-line bg-elevated p-2.5 text-fluid-xs font-semibold text-ink transition hover:bg-sunken"
              >
                <PhoneCall className="h-4 w-4 text-brand" />
                <span>Control Room</span>
              </a>
              <a
                href="tel:108"
                className="flex items-center gap-2 rounded-xl border border-line bg-elevated p-2.5 text-fluid-xs font-semibold text-danger transition hover:bg-sunken"
              >
                <HeartPulse className="h-4 w-4 text-danger" />
                <span>108 Ambulance</span>
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
