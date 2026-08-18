import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, Loader2, Siren, FolderUp } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Card, toast } from '../../components/ui';
import { BackLink } from '../../components/shells';

/**
 * The red button (plan §2.1). These four categories bypass the normal queue and
 * page the ward officer directly with a 30-minute escalation clock — the
 * differentiator against every form-only civic portal.
 */
const EMERGENCIES = [
  { id: 'DEAD_ANIMAL', label: 'Dead animal', hint: 'Carcass on a road, drain or public space' },
  { id: 'MEDICAL_WASTE', label: 'Medical / biomedical waste', hint: 'Syringes, dressings, hospital waste dumped openly' },
  { id: 'BURNING_WASTE', label: 'Waste being burned', hint: 'Open burning producing smoke' },
  { id: 'SEWAGE_OVERFLOW', label: 'Sewage overflow', hint: 'Drain or manhole overflowing' },
];

export default function EmergencyReport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPosition({ lat: 23.2156, lng: 72.6369 }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  async function submit() {
    if (!category || !position) return;
    setBusy(true);
    try {
      const form = new FormData();
      if (file) form.append('photo', file);
      form.append('category', category);
      form.append('latitude', String(position.lat));
      form.append('longitude', String(position.lng));
      if (description) form.append('description', description);

      const { data } = await api('citizen').post('/citizen/emergency', form);
      await queryClient.invalidateQueries({ queryKey: ['citizen'] });
      toast.success(`Emergency ${data.complaint.code} raised — the ward officer has been paged`);
      navigate(`/app/complaints/${data.complaint.id}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not raise the emergency'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <BackLink to="/app" />

      <Card className="border-danger/30 bg-danger/5 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white">
            <Siren className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-fluid-lg font-bold text-danger">Emergency report</h1>
            <p className="mt-1 text-fluid-sm text-muted">
              This skips the normal queue and alerts the ward officer immediately, with a 30-minute escalation timer.
            </p>
          </div>
        </div>
      </Card>

      <div>
        <label className="label">What is the emergency?</label>
        <div className="space-y-2">
          {EMERGENCIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                category === item.id ? 'border-danger bg-danger/10' : 'border-line bg-elevated hover:bg-sunken'
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  category === item.id ? 'border-danger bg-danger' : 'border-line'
                }`}
              >
                {category === item.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className="min-w-0">
                <span className="block text-fluid-sm font-semibold">{item.label}</span>
                <span className="block text-fluid-xs text-muted">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Photo Proof (strongly recommended)</label>
        
        {preview ? (
          <div className="relative rounded-2xl overflow-hidden border border-line aspect-video bg-slate-950">
            <img src={preview} alt="Emergency Proof" className="h-full w-full object-cover" />
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (cameraInput.current) {
                    cameraInput.current.value = '';
                    cameraInput.current.click();
                  }
                }}
                className="btn-ghost btn-sm bg-black/75 text-white hover:bg-black font-bold flex items-center gap-1 cursor-pointer"
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
                className="btn-ghost btn-sm bg-black/75 text-white hover:bg-black font-bold flex items-center gap-1 cursor-pointer"
              >
                <FolderUp className="h-3.5 w-3.5" /> Storage
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (cameraInput.current) {
                  cameraInput.current.value = '';
                  cameraInput.current.click();
                }
              }}
              className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-red-500/30 bg-red-500/[0.03] hover:bg-red-500/[0.08] hover:border-red-500 p-3.5 text-left transition cursor-pointer"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white shadow-md shadow-red-500/20">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-ink text-fluid-xs">Live Camera</p>
                <p className="text-[11px] text-muted">Capture instant photo</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (galleryInput.current) {
                  galleryInput.current.value = '';
                  galleryInput.current.click();
                }
              }}
              className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line hover:border-brand/70 bg-sunken/40 hover:bg-sunken p-3.5 text-left transition cursor-pointer"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand shadow-xs">
                <FolderUp className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-ink text-fluid-xs">Device Storage</p>
                <p className="text-[11px] text-muted">Pick from gallery/files</p>
              </div>
            </button>
          </div>
        )}

        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) {
              setFile(selected);
              setPreview(URL.createObjectURL(selected));
            }
          }}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) {
              setFile(selected);
              setPreview(URL.createObjectURL(selected));
            }
          }}
        />
      </div>

      <div>
        <label className="label" htmlFor="desc">Describe it briefly</label>
        <textarea
          id="desc"
          className="field min-h-[80px] resize-y py-2.5"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Where exactly, and how bad is it?"
          maxLength={1000}
        />
      </div>

      {!position && (
        <p className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-fluid-xs text-warn">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Waiting for your location — the officer needs it to dispatch a crew.
        </p>
      )}

      <button className="btn-danger w-full" onClick={submit} disabled={busy || !category || !position}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />}
        Raise emergency alert
      </button>
    </div>
  );
}
