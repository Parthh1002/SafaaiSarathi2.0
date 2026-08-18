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
  FolderUp,
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
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
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

  // In-Place Live Camera Stream State (No separate popups)
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraActive(false);
    setIsCameraStarting(false);
  };

  const startLiveCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    stopLiveCamera();
    setIsLiveCameraActive(true);
    setIsCameraStarting(true);
    setCameraFacing(facing);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.warn('Direct stream not supported. Opening device camera app.');
      stopLiveCamera();
      if (cameraInput.current) {
        cameraInput.current.value = '';
        cameraInput.current.click();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraStarting(false);
    } catch (err: any) {
      console.warn('getUserMedia environment error, trying fallback:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
        setIsCameraStarting(false);
      } catch (fallbackErr) {
        toast.warn('Camera access denied or unavailable. Opening native camera.');
        stopLiveCamera();
        if (cameraInput.current) {
          cameraInput.current.value = '';
          cameraInput.current.click();
        }
      }
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    void startLiveCamera(nextFacing);
  };

  const snapLivePhotoFromViewfinder = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      toast.warn('Camera feed is still initializing…');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame onto off-screen canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const snappedFile = new File([blob], `waste_spot_${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopLiveCamera();
        void onPhoto(snappedFile);
      },
      'image/jpeg',
      0.92
    );
  };

  useEffect(() => {
    locate();
    return () => {
      stopLiveCamera();
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
      form.append('userCategory', category);
      form.append('latitude', String(position.lat));
      form.append('longitude', String(position.lng));
      if (description) form.append('description', description);

      const { data } = await api('citizen').post('/citizen/report', form);
      toast.success(t('citizen.reported_success') || 'Complaint filed successfully!');
      queryClient.invalidateQueries({ queryKey: ['citizen'] });
      navigate(data?.id ? `/app/complaints/${data.id}` : '/app', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Inputs — Live Camera vs Gallery */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) void onPhoto(selected);
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
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
                className="inline-flex items-center gap-1 rounded-lg bg-elevated px-2 py-1 text-fluid-xs font-semibold text-muted hover:bg-sunken cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            <h1 className="text-fluid-xl font-bold tracking-tight text-ink">
              {step === 'capture' && (t('citizen.report.title') || 'Report Civic Waste')}
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
            <Card className="p-4 sm:p-6 border border-line bg-surface shadow-xs space-y-4 overflow-hidden">
              {!isLiveCameraActive ? (
                <>
                  <div className="text-center space-y-2 py-2">
                    <h3 className="text-fluid-lg font-bold text-ink">
                      {t('citizen.report.select_photo')}
                    </h3>
                    <p className="text-fluid-xs text-muted max-w-md mx-auto">
                      {t('citizen.report.photo_desc')}
                    </p>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1 text-[11px] font-bold text-brand shadow-xs">
                      <Sparkles className="h-3.5 w-3.5" /> YOLOv8 Deep Learning Recognition Active
                    </div>
                  </div>

                  {/* Two Action Options: Live Camera vs Storage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Option 1: Live Camera (Direct In-place Viewfinder) */}
                    <button
                      type="button"
                      onClick={() => void startLiveCamera('environment')}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] hover:border-emerald-500 transition group cursor-pointer text-center"
                    >
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 group-hover:scale-105 transition">
                        <Camera className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="font-extrabold text-ink text-fluid-sm">
                          {t('citizen.report.live_camera')}
                        </p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {t('citizen.report.live_camera_sub')}
                        </p>
                      </div>
                    </button>

                    {/* Option 2: Device Storage / Gallery */}
                    <button
                      type="button"
                      onClick={() => {
                        if (galleryInput.current) {
                          galleryInput.current.value = '';
                          galleryInput.current.click();
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-line hover:border-brand/70 bg-sunken/40 hover:bg-sunken transition group cursor-pointer text-center"
                    >
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/15 text-brand shadow-md shadow-brand/10 group-hover:scale-105 transition">
                        <FolderUp className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="font-extrabold text-ink text-fluid-sm">
                          {t('citizen.report.from_storage')}
                        </p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {t('citizen.report.from_storage_sub')}
                        </p>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                /* In-Place Real-Time Live Viewfinder (No popup, directly embedded in the card) */
                <div className="relative w-full rounded-2xl overflow-hidden bg-black flex flex-col items-center justify-center min-h-[380px] sm:min-h-[460px] shadow-2xl border border-emerald-500/40">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-[380px] sm:h-[460px] object-cover bg-black"
                  />

                  {/* Viewfinder Reticle & HUD Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                    {/* Top HUD */}
                    <div className="flex items-center justify-between pointer-events-auto">
                      <div className="flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/30 shadow-md">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>LIVE AI SENSOR · YOLOv8 READY</span>
                      </div>
                      <button
                        type="button"
                        onClick={stopLiveCamera}
                        title="Close Camera"
                        className="grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition cursor-pointer border border-white/20 shadow-md"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Target Reticle Frame */}
                    <div className="my-auto mx-auto w-56 h-56 sm:w-72 sm:h-72 border-2 border-dashed border-emerald-400/70 rounded-3xl relative flex items-center justify-center">
                      <span className="absolute -top-1 -left-1 h-5 w-5 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg" />
                      <span className="absolute -top-1 -right-1 h-5 w-5 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg" />
                      <span className="absolute -bottom-1 -left-1 h-5 w-5 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg" />
                      <span className="absolute -bottom-1 -right-1 h-5 w-5 border-b-3 border-r-3 border-emerald-400 rounded-br-lg" />
                      {isCameraStarting && (
                        <div className="flex items-center gap-2 rounded-xl bg-black/70 px-3 py-1.5 text-xs text-white">
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                          <span>Starting Camera…</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom HUD: Flip camera & Shutter button */}
                    <div className="flex items-center justify-between w-full max-w-xs mx-auto pointer-events-auto pb-2">
                      {/* Flip Front/Rear Camera */}
                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        title="Switch Front/Rear Camera"
                        className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition cursor-pointer border border-white/20 shadow-md active:scale-95"
                      >
                        <RefreshCw className="h-5 w-5" />
                      </button>

                      {/* Primary Shutter Button */}
                      <button
                        type="button"
                        onClick={snapLivePhotoFromViewfinder}
                        title="Capture Waste Spot Photo"
                        className="relative grid h-18 w-18 place-items-center rounded-full bg-white text-emerald-700 shadow-[0_0_30px_rgba(16,185,129,0.7)] transition active:scale-90 cursor-pointer ring-4 ring-emerald-500/50 hover:scale-105"
                      >
                        <div className="h-14 w-14 rounded-full border-2 border-emerald-700 grid place-items-center bg-emerald-50">
                          <Camera className="h-7 w-7 text-emerald-700" />
                        </div>
                      </button>

                      {/* Switch to File Storage */}
                      <button
                        type="button"
                        onClick={() => {
                          stopLiveCamera();
                          if (galleryInput.current) {
                            galleryInput.current.value = '';
                            galleryInput.current.click();
                          }
                        }}
                        title="Upload from Storage"
                        className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition cursor-pointer border border-white/20 shadow-md active:scale-95"
                      >
                        <FolderUp className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
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

                {/* Retake Photo Buttons — Camera or Gallery */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (cameraInput.current) {
                        cameraInput.current.value = '';
                        cameraInput.current.click();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/80 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur shadow-md hover:bg-black transition cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" /> Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (galleryInput.current) {
                        galleryInput.current.value = '';
                        galleryInput.current.click();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/80 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur shadow-md hover:bg-black transition cursor-pointer"
                  >
                    <FolderUp className="h-3.5 w-3.5" /> Storage
                  </button>
                </div>
              </div>

              {/* AI Inference Telemetry Box */}
              <div className="p-4 space-y-3 bg-surface">
                {visionAi && visionAi.status === 'success' && visionAi.predicted_category ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 text-fluid-xs font-bold text-brand">
                        <Sparkles className="h-4 w-4 text-brand animate-pulse" /> AI Detected:{' '}
                        {CATEGORY_META[visionAi.predicted_category]?.label || visionAi.predicted_category.replace(/_/g, ' ')} ({visionAi.confidence}%)
                      </span>
                      <Badge tone={visionAi.confidence >= 65 ? 'ok' : 'warn'}>
                        {visionAi.confidence >= 65 ? '✓ AI Auto-Verified' : 'Needs Review'}
                      </Badge>
                    </div>
                    <p className="text-fluid-xs text-muted italic leading-relaxed">
                      "{visionAi.remark || 'Multi-class visual features classified by YOLOv8 deep learning model.'}"
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
                <BaseMap center={position ? [position.lat, position.lng] : [23.2156, 72.6369]} zoom={16} minHeight="360px">
                  <LocationPicker
                    position={position ?? { lat: 23.2156, lng: 72.6369 }}
                    latitude={position?.lat ?? 23.2156}
                    longitude={position?.lng ?? 72.6369}
                    onChange={(latOrObj: any, lngVal?: number) => {
                      const nextPos =
                        typeof latOrObj === 'object' && latOrObj !== null && 'lat' in latOrObj
                          ? latOrObj
                          : { lat: Number(latOrObj), lng: Number(lngVal ?? 72.6369) };
                      setPosition(nextPos);
                      void checkForDuplicates(nextPos);
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
