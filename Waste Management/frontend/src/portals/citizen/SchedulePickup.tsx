import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  Check,
  Building2,
  Home,
  Layers,
  FileText,
  Loader2,
  Trash2,
  Boxes,
  Construction,
  Biohazard,
  Cpu,
  AlertTriangle,
  Crosshair,
  Navigation,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, toast } from '../../components/ui';
import { BaseMap, LocationPicker } from '../../components/map/Map';
import { useT } from '../../lib/i18n';

const geocodeCache = new Map<string, string>();
let geocodeReqId = 0;

async function reverseGeocodeLocation(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // 1. Try OpenStreetMap Nominatim (High detail: building, street, society, sector)
  try {
    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'SafaaiSarathi-CivicPlatform/2.0' },
        signal: AbortSignal.timeout(2500),
      }
    );
    if (osmRes.ok) {
      const data = await osmRes.json();
      if (data && data.address) {
        const addr = data.address;
        const place =
          addr.amenity ||
          addr.building ||
          addr.residential ||
          addr.neighbourhood ||
          addr.suburb ||
          addr.road ||
          addr.hamlet ||
          addr.village ||
          '';
        const locality = addr.suburb || addr.neighbourhood || addr.city_district || addr.county || addr.town || addr.city || '';
        const city = addr.city || addr.town || addr.state_district || addr.county || 'Gandhinagar';
        const state = addr.state || 'Gujarat';
        const postcode = addr.postcode ? ` ${addr.postcode}` : '';

        const parts = [
          place,
          locality && locality !== place ? locality : null,
          city && city !== locality && city !== place ? city : null,
          state + postcode,
        ].filter(Boolean);

        if (parts.length > 0) {
          const result = `${parts.join(', ')} (Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)})`;
          geocodeCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch {
    // Fallback to secondary provider
  }

  // 2. Secondary Provider: BigDataCloud Reverse Geocoding API
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (bdcRes.ok) {
      const bdc = await bdcRes.json();
      const loc = bdc.locality || bdc.city || bdc.principalSubdivision || '';
      const state = bdc.principalSubdivision || 'Gujarat';
      const postcode = bdc.postcode ? ` ${bdc.postcode}` : '';
      if (loc) {
        const result = `${loc}, ${state}${postcode} (Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)})`;
        geocodeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Fallback to coordinates
  }

  // 3. Fallback: Dynamic GPS pin coordinates
  const result = `Pinned Location on Map (Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)})`;
  geocodeCache.set(cacheKey, result);
  return result;
}

type Step = 'where' | 'what' | 'when' | 'review';

const WASTE_CATEGORIES_OPTIONS = [
  { id: 'Organic', label: 'Organic / Wet Waste', icon: Trash2, desc: 'Food waste, leaves, compostable' },
  { id: 'Plastic/Recyclable', label: 'Plastic & Dry Recyclable', icon: Layers, desc: 'Bottles, packaging, cartons' },
  { id: 'Construction Debris', label: 'Construction / Renovation', icon: Construction, desc: 'Rubble, tiles, plaster, bricks' },
  { id: 'E-waste', label: 'Electronic & E-Waste', icon: Cpu, desc: 'Old wires, appliances, gadgets' },
  { id: 'Hazardous', label: 'Hazardous / Chemical', icon: Biohazard, desc: 'Paints, chemicals, sanitaries' },
  { id: 'Mixed/General', label: 'Mixed / General Waste', icon: Boxes, desc: 'Mixed household or event debris' },
];

const QUANTITY_OPTIONS = [
  { id: 'SMALL', label: 'Small', desc: '1–3 bags or ~50 kg (Small home gathering)' },
  { id: 'MEDIUM', label: 'Medium', desc: '4–10 bags or ~200 kg (Society party / festival)' },
  { id: 'LARGE', label: 'Large', desc: 'Mini-truck load or >500 kg (Major renovation / wedding)' },
];

const TIME_SLOT_OPTIONS = [
  { id: 'MORNING', label: 'Morning Slot', time: '07:00 AM – 11:00 AM' },
  { id: 'AFTERNOON', label: 'Afternoon Slot', time: '11:00 AM – 03:00 PM' },
  { id: 'EVENING', label: 'Evening Slot', time: '03:00 PM – 07:00 PM' },
];

export default function SchedulePickup() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('where');
  const [locationType, setLocationType] = useState<'MY_HOME' | 'COMMON_PLOT_SOCIETY'>('MY_HOME');
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState<{ lat: number; lng: number }>({ lat: 23.2156, lng: 72.6369 });
  const [geocoding, setGeocoding] = useState(false);
  const [eventReason, setEventReason] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Organic', 'Plastic/Recyclable']);
  const [expectedQuantity, setExpectedQuantity] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('MEDIUM');

  // Tomorrow as min date
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [scheduledDate, setScheduledDate] = useState(tomorrow);
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState<'MORNING' | 'AFTERNOON' | 'EVENING'>('MORNING');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function updateCoordinates(lat: number, lng: number) {
    setPosition({ lat, lng });
    setGeocoding(true);

    const currentReq = ++geocodeReqId;
    try {
      const realAddress = await reverseGeocodeLocation(lat, lng);
      if (currentReq === geocodeReqId) {
        setAddress(realAddress);
      }
    } catch {
      if (currentReq === geocodeReqId) {
        setAddress(`Pinned Location (Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)})`);
      }
    } finally {
      if (currentReq === geocodeReqId) {
        setGeocoding(false);
      }
    }
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      toast.warn('Geolocation not supported on this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void updateCoordinates(pos.coords.latitude, pos.coords.longitude);
        toast.success('Location locked to your current GPS position!');
      },
      () => toast.error('Unable to fetch GPS position. Please tap manually on the map.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  useEffect(() => {
    // Auto-fill GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void updateCoordinates(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          if (!address) {
            void updateCoordinates(23.2156, 72.6369);
          }
        }
      );
    } else {
      void updateCoordinates(23.2156, 72.6369);
    }
  }, []);

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? (prev.length > 1 ? prev.filter((c) => c !== catId) : prev) : [...prev, catId]
    );
  };

  async function onSubmit() {
    if (!address.trim() || !eventReason.trim()) {
      toast.warn('Please complete the address and event description.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api('citizen').post('/citizen/scheduled-pickup', {
        locationType,
        address,
        latitude: position.lat,
        longitude: position.lng,
        eventReason,
        expectedCategories: selectedCategories,
        expectedQuantity,
        scheduledDate,
        scheduledTimeSlot,
        additionalNotes: additionalNotes || null,
      });

      toast.success('Scheduled pickup request created successfully!');
      queryClient.invalidateQueries({ queryKey: ['citizen'] });
      navigate('/app/scheduled-requests', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {step !== 'where' && (
              <button
                type="button"
                onClick={() => {
                  if (step === 'review') setStep('when');
                  else if (step === 'when') setStep('what');
                  else if (step === 'what') setStep('where');
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-elevated px-2 py-1 text-fluid-xs font-semibold text-muted hover:bg-sunken cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            <h1 className="text-fluid-xl font-bold tracking-tight text-ink">Schedule Event Waste Pickup</h1>
          </div>
          <p className="text-fluid-xs text-muted">
            Book a dedicated municipal waste pickup for marriages, society cleanups, or renovation debris.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 bg-elevated/70 p-1.5 rounded-2xl border border-line shadow-xs">
          {[
            { id: 'where', label: '1. Location' },
            { id: 'what', label: '2. Waste' },
            { id: 'when', label: '3. Schedule' },
            { id: 'review', label: '4. Review' },
          ].map((s, i) => {
            const current = step === s.id;
            const stepOrder = ['where', 'what', 'when', 'review'];
            const done = stepOrder.indexOf(step) > i;

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

      {/* ================= STEP 1: WHERE (50-50 Split Layout) ================= */}
      {step === 'where' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT SIDE (50% on lg): Big Interactive Map */}
          <div className="lg:col-span-6 flex flex-col">
            <Card className="p-4 sm:p-5 border border-line shadow-xs space-y-3 bg-surface flex-1 flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-fluid-sm font-bold text-ink flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-brand" /> Interactive Pickup Map
                  </h3>
                  <p className="text-[11px] text-muted">
                    Tap anywhere on the map or drag pin to lock the spot.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLocateMe}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand/10 hover:bg-brand/20 px-3 py-1.5 text-[11px] font-bold text-brand shadow-xs transition cursor-pointer shrink-0"
                >
                  <Navigation className="h-3.5 w-3.5" /> Use Current GPS
                </button>
              </div>

              {/* Leaflet Map Frame */}
              <div className="h-[340px] sm:h-[420px] w-full overflow-hidden rounded-2xl border border-line shadow-inner relative">
                <BaseMap center={[position.lat, position.lng]} zoom={15}>
                  <LocationPicker
                    latitude={position.lat}
                    longitude={position.lng}
                    onChange={(lat, lng) => void updateCoordinates(lat, lng)}
                  />
                </BaseMap>
              </div>

              {/* Coordinates HUD Banner */}
              <div className="flex items-center justify-between rounded-xl bg-sunken/80 border border-line p-2.5 text-[11px]">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Locked GPS Coordinates
                </span>
                <span className="font-mono text-muted">
                  {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                </span>
              </div>
            </Card>
          </div>

          {/* RIGHT SIDE (50% on lg): Address & Location Type Details */}
          <div className="lg:col-span-6 flex flex-col">
            <Card className="p-5 sm:p-6 border border-line shadow-xs space-y-5 bg-surface flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                <div>
                  <h2 className="text-fluid-base font-bold text-ink mb-1">Select Pickup Location</h2>
                  <p className="text-fluid-xs text-muted">
                    Choose location type and verify specific address for municipal pickup truck.
                  </p>
                </div>

                {/* Location Type Switcher */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLocationType('MY_HOME')}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border transition text-left cursor-pointer ${
                      locationType === 'MY_HOME'
                        ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20 shadow-xs'
                        : 'border-line bg-surface hover:bg-sunken'
                    }`}
                  >
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      locationType === 'MY_HOME' ? 'bg-brand text-brand-ink' : 'bg-sunken text-muted'
                    }`}>
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-fluid-sm text-ink">My Home</p>
                      <p className="text-[11px] text-muted">Residential household</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocationType('COMMON_PLOT_SOCIETY')}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border transition text-left cursor-pointer ${
                      locationType === 'COMMON_PLOT_SOCIETY'
                        ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20 shadow-xs'
                        : 'border-line bg-surface hover:bg-sunken'
                    }`}
                  >
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      locationType === 'COMMON_PLOT_SOCIETY' ? 'bg-brand text-brand-ink' : 'bg-sunken text-muted'
                    }`}>
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-fluid-sm text-ink">Common Plot</p>
                      <p className="text-[11px] text-muted">Society / Club gate</p>
                    </div>
                  </button>
                </div>

                {/* Address Input Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-fluid-xs font-bold text-ink">
                      Specific Address / Landmark <span className="text-danger">*</span>
                    </label>
                    {geocoding ? (
                      <span className="text-[11px] font-medium text-brand flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Resolving place...
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Auto-syncs with map pin
                      </span>
                    )}
                  </div>
                  <textarea
                    className="field w-full min-h-[90px] font-medium text-fluid-xs resize-y"
                    placeholder="e.g. Block C Common Garden, Shivalik Residency, Sector 7"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                {/* Visual Tip */}
                <div className="rounded-xl border border-line/70 bg-sunken/40 p-3 text-fluid-xs text-muted space-y-1">
                  <p className="font-semibold text-ink flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-brand" /> Smart Collection Route Dispatch
                  </p>
                  <p className="text-[11px]">
                    Our route optimization engine assigns the nearest municipal truck based on these exact coordinates.
                  </p>
                </div>
              </div>

              {/* Continue Button */}
              <button
                type="button"
                disabled={!address.trim()}
                onClick={() => setStep('what')}
                className="btn-primary w-full py-3.5 font-bold shadow-md shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer transition mt-4"
              >
                <span>Next: What Waste to Collect</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </Card>
          </div>
        </div>
      )}

      {/* ================= STEP 2: WHAT ================= */}
      {step === 'what' && (
        <Card className="p-6 border border-line shadow-xs space-y-6">
          <div>
            <h2 className="text-fluid-base font-bold text-ink mb-1">Occasion & Expected Waste</h2>
            <p className="text-fluid-xs text-muted">Describe the event reason and multi-select expected waste streams.</p>
          </div>

          {/* Event Reason */}
          <div className="space-y-1.5">
            <label className="block text-fluid-xs font-bold text-ink">
              Event / Occasion Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="field w-full"
              placeholder="e.g. Wedding Reception, Diwali Society Deep-Clean, Kitchen Renovation"
              value={eventReason}
              onChange={(e) => setEventReason(e.target.value)}
            />
          </div>

          {/* Expected Categories Multi-select */}
          <div className="space-y-2">
            <label className="block text-fluid-xs font-bold text-ink">
              Expected Waste Categories (Select All That Apply)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WASTE_CATEGORIES_OPTIONS.map((cat) => {
                const Icon = cat.icon;
                const selected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border transition text-left cursor-pointer ${
                      selected
                        ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20 shadow-xs'
                        : 'border-line bg-surface hover:bg-sunken text-ink'
                    }`}
                  >
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      selected ? 'bg-brand text-brand-ink' : 'bg-sunken text-muted'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-fluid-xs truncate">{cat.label}</p>
                      <p className="text-[11px] text-muted truncate mt-0.5">{cat.desc}</p>
                    </div>
                    {selected && <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estimated Quantity */}
          <div className="space-y-2">
            <label className="block text-fluid-xs font-bold text-ink">
              Estimated Waste Volume
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {QUANTITY_OPTIONS.map((q) => {
                const selected = expectedQuantity === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setExpectedQuantity(q.id as any)}
                    className={`p-3.5 rounded-2xl border transition text-left cursor-pointer ${
                      selected
                        ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20 shadow-xs'
                        : 'border-line bg-surface hover:bg-sunken text-ink'
                    }`}
                  >
                    <p className="font-bold text-fluid-sm">{q.label}</p>
                    <p className="text-[11px] text-muted mt-1 leading-snug">{q.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            disabled={!eventReason.trim() || selectedCategories.length === 0}
            onClick={() => setStep('when')}
            className="btn-primary w-full py-3 font-bold shadow-md shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Next: Target Date & Time Slot</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </Card>
      )}

      {/* ================= STEP 3: WHEN ================= */}
      {step === 'when' && (
        <Card className="p-6 border border-line shadow-xs space-y-6">
          <div>
            <h2 className="text-fluid-base font-bold text-ink mb-1">Target Date & Preferred Time Slot</h2>
            <p className="text-fluid-xs text-muted">
              Book at least 24 hours in advance so the ward officer can schedule a dedicated compactor.
            </p>
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="block text-fluid-xs font-bold text-ink">
              Scheduled Pickup Date (Min 24h Ahead) <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              min={tomorrow}
              max={maxDate}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="field w-full sm:w-80"
            />
          </div>

          {/* Time Slot Selection */}
          <div className="space-y-2">
            <label className="block text-fluid-xs font-bold text-ink">
              Preferred Collection Window
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIME_SLOT_OPTIONS.map((slot) => {
                const selected = scheduledTimeSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setScheduledTimeSlot(slot.id as any)}
                    className={`p-4 rounded-2xl border transition text-left cursor-pointer ${
                      selected
                        ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20 shadow-xs'
                        : 'border-line bg-surface hover:bg-sunken text-ink'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Clock className="h-4 w-4 text-brand" />
                      {selected && <Check className="h-4 w-4 text-brand" />}
                    </div>
                    <p className="font-bold text-fluid-sm">{slot.label}</p>
                    <p className="text-[11px] text-muted mt-0.5">{slot.time}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label className="block text-fluid-xs font-bold text-ink">
              Special Gate Instructions / Landmarks (Optional)
            </label>
            <textarea
              rows={2}
              className="field w-full text-fluid-xs"
              placeholder="e.g. Please enter from Gate #2, security guard will guide you to common plot"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              maxLength={500}
            />
          </div>

          <button
            type="button"
            onClick={() => setStep('review')}
            className="btn-primary w-full py-3 font-bold shadow-md shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Next: Review & Submit</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </Card>
      )}

      {/* ================= STEP 4: REVIEW & SUBMIT ================= */}
      {step === 'review' && (
        <Card className="p-6 border border-line shadow-xs space-y-6">
          <div className="border-b border-line pb-3">
            <h2 className="text-fluid-base font-bold text-ink mb-1">Confirm Scheduled Pickup Request</h2>
            <p className="text-fluid-xs text-muted">Review details before sending to the ward officer console.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-fluid-xs">
            <div className="p-4 rounded-2xl border border-line bg-sunken space-y-2">
              <p className="font-bold text-ink flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-brand" /> Location & Occasion
              </p>
              <p><span className="text-muted">Type:</span> {locationType === 'MY_HOME' ? 'My Home' : 'Common Plot'}</p>
              <p><span className="text-muted">Address:</span> {address}</p>
              <p><span className="text-muted">Reason:</span> <strong>{eventReason}</strong></p>
            </div>

            <div className="p-4 rounded-2xl border border-line bg-sunken space-y-2">
              <p className="font-bold text-ink flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-brand" /> Date, Slot & Quantity
              </p>
              <p><span className="text-muted">Target Date:</span> <strong>{new Date(scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong></p>
              <p><span className="text-muted">Time Slot:</span> {TIME_SLOT_OPTIONS.find((s) => s.id === scheduledTimeSlot)?.time}</p>
              <p><span className="text-muted">Estimated Load:</span> {expectedQuantity}</p>
              <p><span className="text-muted">Categories:</span> {selectedCategories.join(', ')}</p>
            </div>
          </div>

          {/* Green Credit Perk */}
          <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 text-fluid-xs text-brand space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Earn +25 Green Credits
            </p>
            <p className="text-[11px] text-muted">
              Pre-scheduling waste prevents illegal roadside dumping and earns you +25 Green Credits once collected by our driver.
            </p>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onSubmit}
            className="btn-primary w-full py-3.5 font-bold shadow-lg shadow-brand/25 flex items-center justify-center gap-2 cursor-pointer text-fluid-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Submitting Advance Request…</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Submit Advance Pickup Request</span>
              </>
            )}
          </button>
        </Card>
      )}
    </div>
  );
}
