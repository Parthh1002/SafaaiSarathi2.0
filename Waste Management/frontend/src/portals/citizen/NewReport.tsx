import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Crosshair, Loader2, RefreshCw, Sparkles, Users, AlertTriangle, ArrowRight, MapPin, X } from 'lucide-react';
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

interface VisionClassification {
  status: 'success' | 'no_detection';
  predicted_category: string | null;
  confidence: number;
  needs_manual_review: boolean;
  remark: string;
}

export default function NewReport() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState<Step>('capture');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [classifying, setClassifying] = useState(false);
  const [visionAi, setVisionAi] = useState<VisionClassification | null>(null);
  const [category, setCategory] = useState<string>('');
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
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
      if (abortControllerRef.current) abortControllerRef.current.abort();
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

  // Safely compress image to speed up upload/inference without crashing backend
  async function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!file.type.match(/image\/(jpeg|png|webp)/i)) {
          return reject(new Error('Unsupported format for canvas compression'));
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
              if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Compression failed'));
            }, 'image/jpeg', 0.7);
          } catch(e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = event.target?.result as string;
      };
      reader.onerror = (error) => reject(error);
    });
  }

  async function onPhoto(selected: File) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const currentSignal = abortController.signal;
    
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
        isTimeout = true;
        if (!currentSignal.aborted) abortController.abort();
    }, 15000);

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setStep('review');
    setClassifying(true);
    setVisionAi(null);
    setCategoryConfirmed(false);

    try {
      let finalBlob: Blob = selected;
      let finalName = selected.name;
      
      try {
        finalBlob = await compressImage(selected);
        finalName = 'photo.jpg';
      } catch (err) {
        console.warn('Compression skipped, using original file:', err);
        if (!finalName.match(/\.(jpg|jpeg|png|webp)$/i)) {
           finalName = 'photo.jpg';
        }
      }
      
      if (currentSignal.aborted) return;
      
      const form = new FormData();
      form.append('file', finalBlob, finalName);
      
      let visionUrl = import.meta.env.VITE_VISION_API_URL || 'http://localhost:8100';
      if (visionUrl.endsWith('/')) {
        visionUrl = visionUrl.slice(0, -1);
      }
      
      const res = await fetch(`${visionUrl}/api/classify-waste`, {
        method: 'POST',
        body: form,
        signal: currentSignal
      });
      
      if (!res.ok) throw new Error('API failed');
      const data: VisionClassification = await res.json();
      if (currentSignal.aborted) return;
      
      setVisionAi(data);
      
      if (data.status === 'success' && data.predicted_category) {
         setCategory(data.predicted_category);
      } else {
         setCategory('');
      }
    } catch (err: any) {
      if (err.name === 'AbortError' && !isTimeout) {
         return; // User clicked Retake, so silent exit. The new request will handle UI state.
      }
      
      setVisionAi({
         status: 'no_detection',
         predicted_category: null,
         confidence: 0,
         needs_manual_review: true,
         remark: 'API call failed or timed out. Category detect nahi hui, manually select karein.'
      });
      setCategory('');
    } finally {
      clearTimeout(timeoutId);
      if (!currentSignal.aborted || isTimeout) {
        setClassifying(false);
      }
    }
  }

  // Warn about an existing nearby report before a duplicate is filed.
  useEffect(() => {
    if (step !== 'location' || !position || !category) return;
    api('citizen')
      .get('/citizen/complaints/check-duplicate', {
        params: { latitude: position.lat, longitude: position.lng, category },
      })
      .then((r) => setDuplicate(r.data.found ? r.data : null))
      .catch(() => setDuplicate(null));
  }, [step, position, category]);

  async function submit() {
    if (!position || !category) return;
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

  const verdict = visionAi ? confidenceLabel(visionAi.confidence / 100) : null;

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
            onClick={() => {
              if (fileInput.current) fileInput.current.value = '';
              fileInput.current?.click();
            }}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-brand/5 py-12 transition hover:border-brand hover:bg-brand/10 group shadow-inner"
          >
            <span className="grid h-20 w-20 place-items-center rounded-3xl bg-brand text-brand-ink shadow-lg shadow-brand/20 transition group-hover:scale-105">
              <Camera className="h-10 w-10" />
            </span>
            <div className="text-center">
              <span className="text-fluid-lg font-bold text-ink block">Capture Live Photo Proof</span>
              <span className="text-fluid-xs text-muted block mt-1">
                Point your phone camera directly at the waste site (Geotagged & Timestamped)
              </span>
            </div>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-bold text-brand">
              <Sparkles className="h-3 w-3" /> Real-Time AI Vision Classification Enabled
            </span>
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

          <div className="mt-4 rounded-xl border border-line/60 bg-sunken p-3 text-fluid-xs text-muted flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-brand" />
              {position ? `GPS Ready: ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'Acquiring GPS location...'}
            </span>
            {locating && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />}
          </div>
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
                    <p className="text-fluid-sm font-medium">{t('citizen.analyzing_photo') || 'Analysing photo...'}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (fileInput.current) fileInput.current.value = '';
                  fileInput.current?.click();
                }}
                className="absolute bottom-3 right-3 btn-ghost btn-sm bg-elevated/90 z-10"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retake
              </button>
            </div>

            {visionAi && visionAi.status === 'success' && (
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand" />
                  <p className="text-fluid-sm font-semibold">AI detected: {t(`category.${category}`)} ({visionAi.confidence}% confident)</p>
                  {verdict && <Badge tone={verdict.tone}>{verdict.label}</Badge>}
                </div>
                
                <p className="text-fluid-xs text-muted italic">{visionAi.remark}</p>

                {!visionAi.needs_manual_review && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 p-2.5 text-fluid-xs text-ok">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>Auto-approved by AI. You can proceed.</span>
                  </div>
                )}

                {visionAi.needs_manual_review && (
                  <p className="rounded-xl border border-warn/30 bg-warn/10 p-2.5 text-fluid-xs text-warn">
                    AI confidence kam hai, please confirm category below.
                  </p>
                )}
              </div>
            )}
            
            {visionAi && visionAi.status === 'no_detection' && (
              <div className="space-y-3 p-4">
                <p className="rounded-xl border border-warn/30 bg-warn/10 p-2.5 text-fluid-xs text-warn">
                  {visionAi.remark}
                </p>
              </div>
            )}
          </Card>

          {(!visionAi || visionAi.needs_manual_review || visionAi.status === 'no_detection' || !categoryConfirmed) && (
            <div>
              <label className="label">Category — select or confirm the correct one</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCategory(id);
                    setCategoryConfirmed(true);
                  }}
                  className={`min-h-touch rounded-xl border px-3 py-2 text-left text-fluid-xs font-medium transition ${
                    category === id ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-elevated text-muted hover:bg-sunken'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          )}

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

          <button 
            className="btn-primary w-full" 
            onClick={() => {
              setStep('location');
              locate(); // Fetch fresh GPS coordinates exactly when user is at the location step
            }} 
            disabled={classifying || !categoryConfirmed}
          >
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

          <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-fluid-xs text-warn flex items-start gap-2.5 shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 font-medium">
              <span className="block font-bold text-warn mb-1">STRICT REQUIREMENT FOR ACCURATE TRACKING</span>
              Please do not leave your current location until the complaint is successfully submitted. We are capturing live high-accuracy GPS coordinates to direct the collection vehicle to this exact spot.
            </div>
          </div>

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
