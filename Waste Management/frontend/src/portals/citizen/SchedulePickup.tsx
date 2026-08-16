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
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, toast } from '../../components/ui';
import { BaseMap, LocationPicker } from '../../components/map/Map';
import { useT } from '../../lib/i18n';

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

  useEffect(() => {
    // Auto-fill GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (!address) {
            setAddress(`GPS Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)} (Gandhinagar)`);
          }
        },
        () => {
          if (!address) setAddress('Sector 6, Gandhinagar, Gujarat 382006');
        }
      );
    } else {
      setAddress('Sector 6, Gandhinagar, Gujarat 382006');
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
    <div className="space-y-6 max-w-4xl mx-auto">
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
            <h1 className="text-fluid-xl font-bold tracking-tight text-ink">
              Request Scheduled Waste Pickup
            </h1>
          </div>
          <p className="text-fluid-xs text-muted">
            Pre-schedule municipal collection for events, weddings, society functions, or renovations.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 bg-elevated/80 p-1.5 rounded-2xl border border-line shadow-xs">
          {[
            { id: 'where', label: '1. Where' },
            { id: 'what', label: '2. What' },
            { id: 'when', label: '3. When' },
            { id: 'review', label: '4. Confirm' },
          ].map((s, i) => {
            const steps: Step[] = ['where', 'what', 'when', 'review'];
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
                {done ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                <span>{s.label.split('. ')[1]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= STEP 1: WHERE ================= */}
      {step === 'where' && (
        <Card className="p-6 border border-line shadow-xs space-y-6">
          <div>
            <h2 className="text-fluid-base font-bold text-ink mb-1">Select Pickup Location</h2>
            <p className="text-fluid-xs text-muted">Choose whether waste will be collected from your home or a common plot.</p>
          </div>

          {/* Location Type Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLocationType('MY_HOME')}
              className={`flex items-center gap-3.5 p-4 rounded-2xl border transition text-left cursor-pointer ${
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
                <p className="font-bold text-fluid-sm text-ink">My Home / Residential</p>
                <p className="text-[11px] text-muted">Individual household address</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLocationType('COMMON_PLOT_SOCIETY')}
              className={`flex items-center gap-3.5 p-4 rounded-2xl border transition text-left cursor-pointer ${
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
                <p className="font-bold text-fluid-sm text-ink">Common Plot / Society Area</p>
                <p className="text-[11px] text-muted">Clubhouse, party plot, or society gate</p>
              </div>
            </button>
          </div>

          {/* Address Field */}
          <div className="space-y-1.5">
            <label className="block text-fluid-xs font-bold text-ink">
              Specific Address / Landmark <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="field w-full"
              placeholder="e.g. Block C Common Garden, Shivalik Residency, Sector 7"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* Map Location Pin */}
          <div className="space-y-1.5">
            <label className="block text-fluid-xs font-bold text-ink">
              Pin Exact Pickup Coordinates on Map
            </label>
            <div className="h-[280px] w-full overflow-hidden rounded-2xl border border-line">
              <BaseMap center={position} zoom={15} minHeight="280px">
                <LocationPicker position={position} onChange={setPosition} />
              </BaseMap>
            </div>
          </div>

          <button
            type="button"
            disabled={!address.trim()}
            onClick={() => setStep('what')}
            className="btn-primary w-full py-3 font-bold shadow-md shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Next: What Waste to Collect</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </Card>
      )}

      {/* ================= STEP 2: WHAT ================= */}
      {step === 'what' && (
        <Card className="p-6 border border-line shadow-xs space-y-6">
          <div>
            <h2 className="text-fluid-base font-bold text-ink mb-1">Event Details & Waste Categories</h2>
            <p className="text-fluid-xs text-muted">Describe the event reason and multi-select expected waste types.</p>
          </div>

          {/* Event Reason */}
          <div className="space-y-1.5">
            <label className="block text-fluid-xs font-bold text-ink">
              Occasion / Reason for Advance Pickup <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="field w-full"
              placeholder="e.g. Daughter's Wedding Reception / Diwali Society Cleanup"
              value={eventReason}
              onChange={(e) => setEventReason(e.target.value)}
            />
          </div>

          {/* Categories Multi-Select */}
          <div className="space-y-2">
            <label className="block text-fluid-xs font-bold text-ink">
              Expected Waste Categories (Select all that apply)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WASTE_CATEGORIES_OPTIONS.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20 shadow-xs'
                        : 'border-line bg-surface hover:bg-sunken'
                    }`}
                  >
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                      isSelected ? 'bg-brand text-brand-ink' : 'bg-sunken text-muted'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-fluid-xs text-ink truncate">{cat.label}</p>
                      <p className="text-[11px] text-muted truncate">{cat.desc}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expected Quantity */}
          <div className="space-y-2">
            <label className="block text-fluid-xs font-bold text-ink">Estimated Waste Quantity</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {QUANTITY_OPTIONS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setExpectedQuantity(q.id as any)}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                    expectedQuantity === q.id
                      ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20 shadow-xs'
                      : 'border-line bg-surface hover:bg-sunken'
                  }`}
                >
                  <p className="font-bold text-fluid-sm text-ink">{q.label}</p>
                  <p className="text-[11px] text-muted mt-1 leading-snug">{q.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!eventReason.trim() || selectedCategories.length === 0}
            onClick={() => setStep('when')}
            className="btn-primary w-full py-3 font-bold shadow-md shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Next: Target Date & Time</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </Card>
      )}

      {/* ================= STEP 3: WHEN ================= */}
      {step === 'when' && (
        <Card className="p-6 border border-line shadow-xs space-y-6">
          <div>
            <h2 className="text-fluid-base font-bold text-ink mb-1">Target Date & Time Slot</h2>
            <p className="text-fluid-xs text-muted">Schedule your pickup at least 24 hours in advance.</p>
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="block text-fluid-xs font-bold text-ink">
              Pickup Date (Min 24h lead time) <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              min={tomorrow}
              max={maxDate}
              className="field w-full font-mono text-fluid-sm"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          {/* Time Slot Picker */}
          <div className="space-y-2">
            <label className="block text-fluid-xs font-bold text-ink">Preferred Collection Time Window</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIME_SLOT_OPTIONS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setScheduledTimeSlot(slot.id as any)}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                    scheduledTimeSlot === slot.id
                      ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20 shadow-xs'
                      : 'border-line bg-surface hover:bg-sunken'
                  }`}
                >
                  <Clock className="h-4 w-4 text-brand mb-1.5" />
                  <p className="font-bold text-fluid-sm text-ink">{slot.label}</p>
                  <p className="text-[11px] text-muted mt-0.5">{slot.time}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label className="block text-fluid-xs font-bold text-ink">
              Gate Access or Special Instructions (Optional)
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
