import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Crosshair, Loader2, RefreshCw, Sparkles, Users } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, DegradedNotice, Meter, toast } from '../../components/ui';
import { BaseMap, LocationPicker } from '../../components/map/Map';
import { CATEGORY_LABELS, confidenceLabel, formatDistance } from '../../lib/format';
import { useT } from '../../lib/i18n';

/**
 * The headline demo moment (plan §10.1): photo → AI auto-category → confirm
 * location → submit.
 *
 * The AI's guess is shown, never silently applied: the citizen confirms or
 * overrides it. Below the auto-approve threshold we say so plainly.
 */

type Step = 'capture' | 'review' | 'location';

interface Classification {
  category: string;
  confidence: number;
  alternatives: { category: string; label: string; confidence: number }[];
  modelVersion: string;
  degraded?: boolean;
  degradedReason?: string;
  capture?: { quality?: string };
}

export default function NewReport() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('capture');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [classifying, setClassifying] = useState(false);
  const [ai, setAi] = useState<Classification | null>(null);
  const [category, setCategory] = useState<string>('GARBAGE_PILE');
  const [description, setDescription] = useState('');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [duplicate, setDuplicate] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ask for location as soon as the flow opens — it is needed either way.
  useEffect(() => {
    locate();
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!navigator.geolocation) {
      toast.warn('Your browser cannot share location. Pick the spot on the map instead.');
      setPosition({ lat: 23.2156, lng: 72.6369 });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.warn('Location denied — drop the pin manually on the map.');
        setPosition({ lat: 23.2156, lng: 72.6369 });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function onPhoto(selected: File) {
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setStep('review');
    setClassifying(true);
    setAi(null);

    try {
      const form = new FormData();
      form.append('photo', selected);
      const { data } = await api('citizen').post<Classification>('/citizen/classify', form);
      setAi(data);
      setCategory(data.category);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not analyse the photo'));
    } finally {
      setClassifying(false);
    }
  }

  // Warn about an existing nearby report before a duplicate is filed.
  useEffect(() => {
    if (step !== 'location' || !position) return;
    api('citizen')
      .get('/citizen/complaints/check-duplicate', {
        params: { latitude: position.lat, longitude: position.lng, category },
      })
      .then((r) => setDuplicate(r.data.found ? r.data : null))
      .catch(() => setDuplicate(null));
  }, [step, position, category]);

  async function submit() {
    if (!position) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      if (file) form.append('photo', file);
      form.append('latitude', String(position.lat));
      form.append('longitude', String(position.lng));
      form.append('category', category);
      if (description) form.append('description', description);
      form.append('channel', 'WEB');

      const { data } = await api('citizen').post('/citizen/complaints', form);
      await queryClient.invalidateQueries({ queryKey: ['citizen'] });

      toast.success(
        data.duplicate
          ? `Merged with ${data.duplicate.of} — ${data.duplicate.alsoReportedBy} people reported this`
          : `Report ${data.complaint.code} filed · +${data.creditsAwarded} credits`
      );
      navigate(`/app/complaints/${data.complaint.id}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not submit the report'));
    } finally {
      setSubmitting(false);
    }
  }

  const verdict = ai ? confidenceLabel(ai.confidence) : null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <header>
        <h1 className="text-fluid-xl font-bold tracking-tight">Report an issue</h1>
        <p className="mt-1 text-fluid-sm text-muted">
          {step === 'capture' && 'Start with a photo — the category fills itself in.'}
          {step === 'review' && 'Check what the AI found, then correct it if needed.'}
          {step === 'location' && 'Confirm exactly where this is.'}
        </p>
      </header>

      {/* Progress */}
      <ol className="flex items-center gap-2">
        {(['capture', 'review', 'location'] as Step[]).map((s, i) => {
          const index = ['capture', 'review', 'location'].indexOf(step);
          const done = i < index;
          const active = s === step;
          return (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-fluid-xs font-bold transition ${
                  done ? 'bg-brand text-brand-ink' : active ? 'border-2 border-brand text-brand' : 'bg-sunken text-faint'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {i < 2 && <span className={`h-0.5 flex-1 rounded ${done ? 'bg-brand' : 'bg-sunken'}`} />}
            </li>
          );
        })}
      </ol>

      {/* ---- Step 1: capture ---- */}
      {step === 'capture' && (
        <Card className="p-5">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line py-12 transition hover:border-brand hover:bg-brand/5"
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/10 text-brand">
              <Camera className="h-8 w-8" />
            </span>
            <span className="text-fluid-base font-semibold">Take a photo</span>
            <span className="text-fluid-xs text-muted">or choose one from your gallery</span>
          </button>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) void onPhoto(selected);
            }}
          />

          <button type="button" className="btn-ghost mt-4 w-full" onClick={() => setStep('location')}>
            Continue without a photo
          </button>
          <p className="mt-2 text-center text-fluid-xs text-faint">
            A photo lets the AI verify the report and speeds up dispatch.
          </p>
        </Card>
      )}

      {/* ---- Step 2: review the AI result ---- */}
      {step === 'review' && (
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="relative">
              <img src={preview} alt="Your report" className="aspect-[4/3] w-full object-cover" />
              {classifying && (
                <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-fluid-sm font-medium">Analysing the photo…</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="absolute bottom-3 right-3 btn-ghost btn-sm bg-elevated/90"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retake
              </button>
            </div>

            {ai && (
              <div className="space-y-3 p-4">
                {ai.degraded && <DegradedNotice reason={ai.degradedReason} />}

                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand" />
                  <p className="text-fluid-sm font-semibold">AI thinks this is</p>
                  {verdict && <Badge tone={verdict.tone}>{verdict.label}</Badge>}
                </div>

                <p className="text-fluid-lg font-bold">{t(`category.${ai.category}`)}</p>
                <Meter value={ai.confidence * 100} tone={verdict?.tone === 'ok' ? 'ok' : 'warn'} label="Confidence" />

                {ai.confidence < 0.7 && (
                  <p className="rounded-xl border border-warn/30 bg-warn/10 p-2.5 text-fluid-xs text-warn">
                    Below the automatic-approval threshold, so a ward officer will review this before dispatch.
                  </p>
                )}
                <p className="text-fluid-xs text-faint">Model {ai.modelVersion}</p>
              </div>
            )}
          </Card>

          <div>
            <label className="label">Category — change it if the AI got it wrong</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={`min-h-touch rounded-xl border px-3 py-2 text-left text-fluid-xs font-medium transition ${
                    category === id ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-elevated text-muted hover:bg-sunken'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="description">Anything else? (optional)</label>
            <textarea
              id="description"
              className="field min-h-[88px] resize-y py-2.5"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Beside the school gate, been there three days"
              maxLength={1000}
            />
          </div>

          <button className="btn-primary w-full" onClick={() => setStep('location')} disabled={classifying}>
            Next: confirm location
          </button>
        </div>
      )}

      {/* ---- Step 3: location ---- */}
      {step === 'location' && (
        <div className="space-y-4">
          {duplicate && (
            <Card className="border-info/30 bg-info/5 p-4">
              <div className="flex items-start gap-2.5">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                <div className="min-w-0">
                  <p className="text-fluid-sm font-semibold text-info">
                    {duplicate.alsoReportedBy} people already reported this
                  </p>
                  <p className="mt-0.5 text-fluid-xs text-muted">
                    {duplicate.code} · {formatDistance(duplicate.distanceMeters)} away · {duplicate.status.toLowerCase()}
                  </p>
                  <p className="mt-1.5 text-fluid-xs text-muted">
                    Submitting will add your confirmation to that report rather than creating a duplicate ticket.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="h-64 w-full sm:h-80">
              {position ? (
                <BaseMap center={[position.lat, position.lng]} zoom={17}>
                  <LocationPicker
                    latitude={position.lat}
                    longitude={position.lng}
                    onChange={(lat, lng) => setPosition({ lat, lng })}
                  />
                </BaseMap>
              ) : (
                <div className="grid h-full place-items-center bg-sunken text-fluid-sm text-muted">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-line p-3">
              <p className="min-w-0 flex-1 truncate text-fluid-xs text-muted">
                {position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'Finding you…'}
              </p>
              <button type="button" className="btn-ghost btn-sm" onClick={locate} disabled={locating}>
                {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                Use my location
              </button>
            </div>
          </Card>

          <p className="text-center text-fluid-xs text-muted">Tap the map to move the pin to the exact spot.</p>

          <button className="btn-primary w-full" onClick={submit} disabled={submitting || !position}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {duplicate ? 'Confirm this report' : 'Submit report'}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep(file ? 'review' : 'capture')}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}
