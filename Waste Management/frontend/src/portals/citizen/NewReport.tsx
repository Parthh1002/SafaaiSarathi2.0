import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Check,
  Crosshair,
  Loader2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  MapPin,
  X,
  Trash2,
  Biohazard,
  Construction,
  Flame,
  Droplets,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  Layers,
  FileText,
  ChevronLeft,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, Meter, toast } from '../../components/ui';
import { BaseMap, LocationPicker } from '../../components/map/Map';
import { CATEGORY_LABELS, confidenceLabel, formatDistance } from '../../lib/format';
import { useT } from '../../lib/i18n';

type Step = 'capture' | 'review' | 'location';

interface VisionClassification {
  status: 'success' | 'no_detection';
  predicted_category: string | null;
  confidence: number;
  needs_manual_review: boolean;
  remark: string;
}

const CATEGORY_META: Record<string, { label: string; icon: any; emergency?: boolean; desc: string }> = {
  garbage_pile: { label: 'Garbage Pile', icon: Trash2, desc: 'Accumulated mixed waste' },
  overflowing_bin: { label: 'Overflowing Bin', icon: Layers, desc: 'Public dustbin spill' },
  dead_animal: { label: 'Dead Animal', icon: ShieldAlert, emergency: true, desc: 'Urgent sanitary removal' },
  construction_debris: { label: 'Construction Debris', icon: Construction, desc: 'Rubble & renovation waste' },
  medical_waste: { label: 'Medical Waste', icon: Biohazard, emergency: true, desc: 'Biohazard & syringes' },
  illegal_dumping: { label: 'Illegal Dumping', icon: AlertTriangle, desc: 'Commercial dumping' },
  sewage_overflow: { label: 'Sewage Overflow', icon: Droplets, emergency: true, desc: 'Open drain / sewage leak' },
  burning_waste: { label: 'Burning Waste', icon: Flame, emergency: true, desc: 'Open garbage burning' },
  other: { label: 'Other Waste', icon: HelpCircle, desc: 'Unclassified civic issue' },
};

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
  const [category, setCategory] = useState<string>('garbage_pile');
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  const [description, setDescription] = useState('');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [duplicate, setDuplicate] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    locate();
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchIpLocation() {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          return { lat: Number(data.latitude), lng: Number(data.longitude) };
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  async function locate() {
    if (!navigator.geolocation) {
      toast.warn('Browser GPS not supported. Fetching approximate city location.');
      const ipPos = await fetchIpLocation();
      setPosition(ipPos || { lat: 23.2156, lng: 72.6369 });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoDenied(false);
        setLocating(false);
      },
      async (err) => {
        setLocating(false);
        if (err.code === 1) {
          setGeoDenied(true);
          toast.warn('Browser Location Blocked! Please allow location permission in URL bar.');
        } else {
          toast.warn('Location fix delayed — using city approximate location.');
        }
        const ipPos = await fetchIpLocation();
        if (ipPos) {
          setPosition(ipPos);
        } else if (!position) {
          setPosition({ lat: 23.2156, lng: 72.6369 });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

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
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas to Blob compression failed'));
              },
              'image/jpeg',
              0.82
            );
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error('Image decode error'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File reader error'));
    });
  }

  async function onPhoto(selected: File) {
    setFile(selected);
    const objectUrl = URL.createObjectURL(selected);
    setPreview(objectUrl);
    setStep('review');
    setClassifying(true);
    setVisionAi(null);

    const formData = new FormData();
    try {
      const compressedBlob = await compressImage(selected);
      formData.append('file', compressedBlob, selected.name.replace(/\.[^/.]+$/, '.jpg'));
    } catch {
      formData.append('file', selected);
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 15000);

    try {
      const { data } = await api('citizen').post('/citizen/classify-waste', formData, {
        signal: abortControllerRef.current.signal,
      });
      clearTimeout(timeoutId);

      if (data && data.status === 'success' && data.predicted_category) {
        setVisionAi(data);
        setCategory(data.predicted_category);
        setCategoryConfirmed(true);
      } else if (data && data.status === 'no_detection') {
        setVisionAi(data);
        setCategory('garbage_pile');
        setCategoryConfirmed(false);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setVisionAi(null);
      setCategory('garbage_pile');
      setCategoryConfirmed(false);
    } finally {
      setClassifying(false);
    }
  }

  function triggerPhotoCapture() {
    if (fileInput.current) {
      fileInput.current.value = '';
      fileInput.current.click();
    }
  }

  async function checkForDuplicates(pos: { lat: number; lng: number }) {
    try {
      const { data } = await api('citizen').get('/citizen/complaints/nearby', {
        params: { lat: pos.lat, lng: pos.lng, radiusMeters: 100 },
      });
      const openOne = (data.items || []).find((c: any) =>
        ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'].includes(c.status)
      );
      setDuplicate(openOne || null);
    } catch {
      // Non-critical
    }
  }

  async function onSubmit() {
    if (!file || !position || !category) {
      toast.warn('Please complete photo, category, and location.');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      try {
        const compressedBlob = await compressImage(file);
        form.append('photo', compressedBlob, file.name.replace(/\.[^/.]+$/, '.jpg'));
      } catch {
        form.append('photo', file);
      }
      form.append('category', category);
      form.append('latitude', String(position.lat));
      form.append('longitude', String(position.lng));
      if (description) form.append('description', description);

      const { data } = await api('citizen').post('/citizen/complaints', form);
      toast.success(t('citizen.reported_success') || 'Complaint filed successfully!');
      queryClient.invalidateQueries({ queryKey: ['citizen'] });
      navigate(`/app/complaints/${data.id}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Input — Always mounted in DOM across all steps so Retake Photo works reliably */}
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

      {/* Top Header & Step Tracker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {step !== 'capture' && (
              <button
                type="button"
                onClick={() => setStep(step === 'location' ? 'review' : 'capture')}
                className="inline-flex items-center gap-1 rounded-lg bg-elevated px-2 py-1 text-fluid-xs font-semibold text-muted hover:bg-sunken"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            <h1 className="text-fluid-xl font-bold tracking-tight text-ink">
              {step === 'capture' && 'Report Civic Waste'}
              {step === 'review' && 'AI Waste Verification'}
              {step === 'location' && 'Confirm Coordinates & Submit'}
            </h1>
          </div>
          <p className="text-fluid-xs text-muted">
            {step === 'capture' && 'Capture live photo proof with instant AI deep learning recognition.'}
            {step === 'review' && 'Verify detected category and add optional landmark details.'}
            {step === 'location' && 'Ensure accurate GPS pin for municipal collection truck dispatch.'}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 bg-elevated/70 p-1.5 rounded-2xl border border-line shadow-xs">
          {[
            { id: 'capture', label: '1. Photo' },
            { id: 'review', label: '2. AI Review' },
            { id: 'location', label: '3. Location' },
          ].map((s, i) => {
            const steps: Step[] = ['capture', 'review', 'location'];
            const done = steps.indexOf(step) > i;
            const current = step === s.id;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold transition ${
                  current
                    ? 'bg-brand text-brand-ink shadow-xs'
                    : done
                    ? 'bg-brand/10 text-brand'
                    : 'text-muted'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
                <span>{s.label.split('. ')[1]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= STEP 1: CAPTURE ================= */}
      {step === 'capture' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main Upload Box */}
          <div className="lg:col-span-8">
            <Card className="p-6 sm:p-10 border-2 border-dashed border-brand/30 hover:border-brand bg-brand/[0.02] transition">
              <button
                type="button"
                onClick={triggerPhotoCapture}
                className="flex w-full flex-col items-center gap-4 py-8 text-center group cursor-pointer"
              >
                <div className="grid h-24 w-24 place-items-center rounded-3xl bg-brand text-brand-ink shadow-xl shadow-brand/20 transition group-hover:scale-105">
                  <Camera className="h-12 w-12" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-fluid-lg font-bold text-ink">Take Live Photo / Upload</h3>
                  <p className="text-fluid-xs text-muted max-w-md">
                    Point camera at the waste spot. Our YOLOv8 Deep Learning model automatically detects waste type.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-fluid-xs font-bold text-brand shadow-xs">
                  <Sparkles className="h-4 w-4" /> AI Auto-Classification Active
                </div>
              </button>
            </Card>
          </div>

          {/* Guidelines & GPS Side Card */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-5 border border-line bg-surface shadow-xs">
              <h4 className="text-fluid-sm font-bold text-ink mb-3 flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-brand" /> GPS Fix Status
              </h4>
              <div className="rounded-xl border border-line/60 bg-sunken p-3 text-fluid-xs text-muted">
                {position ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-ok flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-ok animate-pulse" /> Coordinates Locked
                    </p>
                    <p className="font-mono text-[11px]">
                      {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                    </p>
                  </div>
                ) : (
                  <p className="text-warn flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Acquiring GPS satellite lock...
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-5 border border-line bg-surface shadow-xs space-y-3">
              <h4 className="text-fluid-sm font-bold text-ink">Photo Guidelines</h4>
              <ul className="text-fluid-xs text-muted space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                  <span>Ensure good lighting and direct view of the garbage.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                  <span>Biohazard & dead animals are automatically prioritized for 30m SLA dispatch.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                  <span>Earn <strong>+20 Green Credits</strong> upon successful cleanup verification.</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* ================= STEP 2: AI REVIEW ================= */}
      {step === 'review' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Image HUD & AI Telemetry (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="overflow-hidden p-0 border border-line shadow-sm relative group">
              <div className="relative aspect-[4/3] w-full bg-black/90">
                <img src={preview} alt="Uploaded waste proof" className="h-full w-full object-cover" />

                {classifying && (
                  <div className="absolute inset-0 grid place-items-center bg-black/65 backdrop-blur-xs">
                    <div className="flex flex-col items-center gap-2.5 text-white">
                      <Loader2 className="h-9 w-9 animate-spin text-brand" />
                      <p className="text-fluid-sm font-bold tracking-wide">YOLOv8 Neural Network Scanning…</p>
                    </div>
                  </div>
                )}

                {/* Retake Photo Button — Triggers File Picker directly */}
                <button
                  type="button"
                  onClick={triggerPhotoCapture}
                  className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/75 px-3 py-1.5 text-fluid-xs font-semibold text-white backdrop-blur shadow-md hover:bg-black/95 transition cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retake Photo
                </button>
              </div>

              {/* AI Inference Telemetry Box */}
              <div className="p-4 space-y-3 bg-surface">
                {visionAi && visionAi.status === 'success' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-fluid-xs font-bold text-brand">
                        <Sparkles className="h-4 w-4" /> AI Confidence: {visionAi.confidence}%
                      </span>
                      <Badge tone={visionAi.confidence >= 70 ? 'ok' : 'warn'}>
                        {visionAi.confidence >= 70 ? 'Auto-Approve Ready' : 'Officer Review Flag'}
                      </Badge>
                    </div>
                    <p className="text-fluid-xs text-muted italic leading-relaxed">
                      "{visionAi.remark || 'Multi-class visual cues verified.'}"
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-line bg-sunken p-3 text-fluid-xs text-muted flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand shrink-0" />
                    <span>Select or confirm the waste category on the right to proceed.</span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Category Selection & Description (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <Card className="p-5 border border-line shadow-xs space-y-4">
              <div>
                <label className="block text-fluid-sm font-bold text-ink">
                  Select or Confirm Waste Category
                </label>
                <p className="text-fluid-xs text-muted">
                  Click to select the most accurate description for the collection team.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries(CATEGORY_META).map(([id, meta]) => {
                  const Icon = meta.icon;
                  const isSelected = category === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setCategory(id);
                        setCategoryConfirmed(true);
                      }}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20 shadow-xs'
                          : 'border-line bg-surface text-ink hover:bg-sunken hover:border-line/80'
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${
                          isSelected ? 'bg-brand text-brand-ink' : 'bg-sunken text-muted'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-fluid-xs font-bold truncate">{meta.label}</span>
                          {meta.emergency && (
                            <span className="rounded bg-danger/10 px-1.5 py-0.2 text-[9px] font-bold text-danger uppercase">
                              30m SLA
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted truncate mt-0.5">{meta.desc}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-brand shrink-0 mt-1" />}
                    </button>
                  );
                })}
              </div>

              {/* Additional Context Note */}
              <div className="space-y-1.5 pt-2">
                <label htmlFor="description" className="block text-fluid-xs font-bold text-ink">
                  Landmark or Additional Notes (Optional)
                </label>
                <textarea
                  id="description"
                  rows={2}
                  className="field w-full py-2 text-fluid-xs"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Near Sector 7 primary school gate, behind tea stall"
                  maxLength={500}
                />
              </div>

              {/* Next Step Action Button */}
              <button
                type="button"
                onClick={() => {
                  if (position) void checkForDuplicates(position);
                  setStep('location');
                }}
                className="btn-primary w-full py-3 text-fluid-sm font-bold shadow-md shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Next: Confirm Location</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </Card>
          </div>
        </div>
      )}

      {/* ================= STEP 3: LOCATION & SUBMIT ================= */}
      {step === 'location' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Interactive Map (7 cols) */}
          <div className="lg:col-span-7">
            <Card className="p-4 border border-line shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-fluid-sm font-bold text-ink flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-brand" /> Drag Pin to Adjust Position
                  </h3>
                  <p className="text-[11px] text-muted">Ensure the pin directly matches the garbage site.</p>
                </div>
                <button
                  type="button"
                  onClick={locate}
                  className="inline-flex items-center gap-1 rounded-xl border border-line bg-elevated px-3 py-1.5 text-fluid-xs font-semibold text-ink hover:bg-sunken shadow-xs cursor-pointer"
                >
                  <Crosshair className="h-3.5 w-3.5 text-brand" /> Recenter GPS
                </button>
              </div>

              <div className="h-[360px] w-full overflow-hidden rounded-2xl border border-line">
                <BaseMap center={position ?? { lat: 23.2156, lng: 72.6369 }} zoom={16} minHeight="360px">
                  <LocationPicker
                    position={position}
                    onChange={(next) => {
                      setPosition(next);
                      void checkForDuplicates(next);
                    }}
                  />
                </BaseMap>
              </div>
            </Card>
          </div>

          {/* Right Column: Confirmation Summary & Submit (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-5 border border-line shadow-xs space-y-4">
              <h3 className="text-fluid-sm font-bold text-ink border-b border-line pb-2">
                Report Summary
              </h3>

              <div className="flex items-center gap-3">
                <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover border border-line shrink-0" />
                <div className="min-w-0 flex-1">
                  <Badge tone="ok" className="font-bold text-[10px]">
                    {CATEGORY_META[category]?.label || category}
                  </Badge>
                  <p className="text-fluid-xs text-muted truncate mt-1">
                    {description || 'No additional note added'}
                  </p>
                  {position && (
                    <p className="text-[11px] font-mono text-faint">
                      {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

              {/* Duplicate Notice */}
              {duplicate && (
                <div className="rounded-2xl border border-warn/30 bg-warn/10 p-3 text-fluid-xs text-warn flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Nearby Active Ticket #{duplicate.ticketNumber || duplicate.id.slice(0, 6)}</p>
                    <p className="text-[11px] text-muted">
                      Another citizen already reported an issue ~{Math.round(duplicate.distanceMeters || 20)}m away. Your report will reinforce collection priority.
                    </p>
                  </div>
                </div>
              )}

              {/* Green Credit Perk */}
              <div className="rounded-2xl border border-brand/20 bg-brand/5 p-3 text-fluid-xs text-brand space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Earn +20 Green Credits
                </p>
                <p className="text-[11px] text-muted">
                  Credits are automatically credited to your wallet once the driver submits clean-up proof.
                </p>
              </div>

              {/* Final Submit Button */}
              <button
                type="button"
                disabled={submitting}
                onClick={onSubmit}
                className="btn-primary w-full py-3 text-fluid-sm font-bold shadow-lg shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting to Municipal Queue…</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Submit Official Complaint</span>
                  </>
                )}
              </button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
