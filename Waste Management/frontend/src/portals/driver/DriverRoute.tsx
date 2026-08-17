import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Navigation,
  MapPin,
  Route as RouteIcon,
  Fuel,
  Clock,
  CheckCircle2,
  ArrowRight,
  Truck,
  ShieldAlert,
  Compass,
  Phone,
  Layers,
  Sparkles,
  AlertTriangle,
  Check,
  Radio,
  Gauge,
  Wifi,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  Zap,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Badge, Card, EmptyState, ErrorState, Loading, toast } from '../../components/ui';
import RoadSnappedMap from '../../components/map/RoadSnappedMap';
import { realGpsTracker, RealGpsLocation, GpsStatus } from '../../lib/realGpsTracker';
import {
  optimizeMultiStopTour,
  AssignedStop,
  OptimizedTour,
} from '../../lib/tspRouteOptimizer';
import { useT } from '../../lib/i18n';

// Realistic 5 Mock Assigned Collection Complaints within 3km in Ward 6
const INITIAL_ASSIGNED_STOPS: AssignedStop[] = [
  {
    id: 'stop-01',
    code: 'SS-4081',
    name: 'Sector 6 Vegetable Market',
    address: 'Near GH-6 Circle, Sector 6 Market, Gandhinagar',
    category: 'Garbage Pile',
    latitude: 23.2185,
    longitude: 72.6395,
    urgency: 'HIGH',
    notes: 'Commercial vegetable waste accumulation outside main entrance.',
  },
  {
    id: 'stop-02',
    code: 'SS-4082',
    name: 'Sector 6 Community Bin A',
    address: 'Block A, Residential Complex 4, Sector 6',
    category: 'Overflowing Bin',
    latitude: 23.2142,
    longitude: 72.6341,
    urgency: 'NORMAL',
    notes: 'Green biodegradable community bin overflowing onto sidewalk.',
  },
  {
    id: 'stop-03',
    code: 'SS-4083',
    name: 'Sector 12 Hospital Gate 4',
    address: 'Gate 4, Civil Hospital Corridor, Sector 12',
    category: 'Medical Waste',
    latitude: 23.2248,
    longitude: 72.6482,
    urgency: 'EMERGENCY',
    notes: 'Biohazard syringe and disposable medical container found in open.',
  },
  {
    id: 'stop-04',
    code: 'SS-4084',
    name: 'Sector 6 School Crossing',
    address: 'Opposite Primary School No. 2, Sector 6',
    category: 'Plastic Waste',
    latitude: 23.2201,
    longitude: 72.6420,
    urgency: 'NORMAL',
    notes: 'Single-use plastic packets scattered on pedestrian path.',
  },
  {
    id: 'stop-05',
    code: 'SS-4085',
    name: 'Sector 11 Commercial Complex',
    address: 'Behind Shopping Plaza, Sector 11',
    category: 'Cardboard & Dry Waste',
    latitude: 23.2280,
    longitude: 72.6415,
    urgency: 'NORMAL',
    notes: 'Packaging boxes piled near back delivery alley.',
  },
];

export default function DriverRoute() {
  const t = useT();
  const { user } = useAuth();

  // Real Hardware GPS State
  const [driverPos, setDriverPos] = useState<[number, number]>([23.2156, 72.6369]);
  const [driverSpeed, setDriverSpeed] = useState<number>(0);
  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('CONNECTING');
  const [gpsFix, setGpsFix] = useState<RealGpsLocation | null>(null);

  // Multi-Stop Route State
  const [assignedStops, setAssignedStops] = useState<AssignedStop[]>(INITIAL_ASSIGNED_STOPS);
  const [tour, setTour] = useState<OptimizedTour | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);

  // 1. Connect Real Hardware GPS watchPosition stream
  useEffect(() => {
    realGpsTracker.startTracking(true);
    const unsubscribeGps = realGpsTracker.subscribe((loc, status) => {
      setGpsStatus(status);
      if (loc) {
        setGpsFix(loc);
        setDriverPos([loc.latitude, loc.longitude]);
        setDriverSpeed(loc.speed ?? 0);
        setDriverHeading(loc.heading ?? 0);
      }
    });

    return () => {
      unsubscribeGps();
      realGpsTracker.stopTracking();
    };
  }, []);

  // 2. Recompute 2-Opt TSP Optimized Tour whenever driver location or stops change
  useEffect(() => {
    let isCancelled = false;

    optimizeMultiStopTour(driverPos, assignedStops).then((computedTour) => {
      if (!isCancelled) {
        setTour(computedTour);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [driverPos, assignedStops]);

  // Handle Mark Stop as Done (Advances to the next stop in optimized sequence)
  const handleCompleteCurrentStop = () => {
    if (!tour?.nextStop) return;

    const completedId = tour.nextStop.id;
    const completedName = tour.nextStop.name;
    setIsCollecting(true);

    toast.success(`✓ Collected & Cleaned: ${completedName}!`);

    setTimeout(() => {
      setAssignedStops((prev) =>
        prev.map((s) => (s.id === completedId ? { ...s, isCompleted: true } : s))
      );
      setIsCollecting(false);
    }, 400);
  };

  // Convert current tour state to SimulatedDriver interface for RoadSnappedMap
  const driverForMap = useMemo(() => {
    const nextStop = tour?.nextStop || assignedStops[0];
    return [
      {
        id: user?.id || 'drv-real',
        name: user?.name || 'Parth Patel',
        vehicleNumber: 'GJ-18-GB-4012',
        model: 'Tata Ace Gold 2T',
        wardCode: 'W-06',
        wardName: 'Sector 6 Municipal Ward',
        phone: user?.phone || '9825144321',
        currentLat: driverPos[0],
        currentLng: driverPos[1],
        heading: driverHeading,
        speedKmh: driverSpeed,
        fuelPct: 78,
        status: (driverSpeed > 2 ? 'en_route' : 'idle') as 'en_route' | 'idle',
        destination: {
          name: nextStop?.name || 'Depot',
          address: nextStop?.address || 'Municipal Ward Office',
          lat: nextStop?.latitude || 23.2156,
          lng: nextStop?.longitude || 72.6369,
          urgency: (nextStop?.urgency === 'EMERGENCY' ? 'EMERGENCY' : 'NORMAL') as 'EMERGENCY' | 'NORMAL',
          category: nextStop?.category || 'Garbage Pile',
        },
        remainingDistanceKm: tour ? Number((tour.distanceToNextMeters / 1000).toFixed(2)) : 1.1,
        etaMinutes: tour ? Math.max(1, Math.round(tour.distanceToNextMeters / 400)) : 2,
        route: tour?.roadCoordinates?.length
          ? {
              coordinates: tour.roadCoordinates,
              steps: [{ instruction: tour.turnInstruction, distanceMeters: tour.distanceToNextMeters, durationSec: 120 }],
            }
          : undefined,
        lastUpdated: new Date().toISOString(),
      },
    ];
  }, [user, driverPos, driverHeading, driverSpeed, tour, assignedStops]);

  const nextStop = tour?.nextStop;
  const remainingCount = tour?.remainingStopsCount ?? 0;

  return (
    <div className="space-y-4">
      {/* Top Banner / Session Header (FIX 1: Profile Dropdown Removed Completely) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
              <Navigation className="h-4 w-4" />
            </span>
            <h1 className="text-fluid-lg font-extrabold text-ink tracking-tight">
              Live Navigation & TSP Route
            </h1>
          </div>
          <p className="text-fluid-xs text-muted">
            2-Opt TSP minimal-distance sequence · Road-snapped live turn guidance
          </p>
        </div>

        {/* Authenticated Driver Profile Badge & GPS Status */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Real Hardware GPS Stream Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border border-emerald-500/30 bg-emerald-50/10 text-emerald-600 shadow-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                gpsStatus === 'LIVE_GPS' ? 'bg-emerald-500 animate-ping' : 'bg-emerald-600'
              }`}
            />
            <span>
              {gpsStatus === 'LIVE_GPS'
                ? `GPS Live (±${gpsFix?.accuracy || 4}m)`
                : gpsStatus === 'STATIONARY'
                ? 'GPS: Stationary (0 km/h)'
                : gpsStatus === 'PERMISSION_DENIED'
                ? 'GPS: Permission Denied'
                : 'GPS: Connecting…'}
            </span>
          </div>

          {/* Authenticated Driver Tag (No dropdown, strictly from session) */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-surface border border-line text-ink font-semibold text-xs shadow-xs">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-600 text-white text-[10px] font-bold">
              {(user?.name || 'Parth Patel').charAt(0)}
            </span>
            <div className="leading-tight">
              <span className="font-bold block text-fluid-xs">{user?.name || 'Parth Patel'}</span>
              <span className="text-[10px] text-muted font-mono">GJ-18-GB-4012 (Ward W-06)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 70% / 30% SPLIT SCREEN LAYOUT: MAP (LEFT 70%) + FOCUSED STOPS HUD (RIGHT 30%) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-stretch">
        
        {/* LEFT SIDE (70% Width): Pristine, Clean Road-Snapped Map (FIX 2: Zero Overlays) */}
        <div className="lg:col-span-7 h-[68dvh] min-h-[440px] rounded-3xl border border-line overflow-hidden shadow-lg relative bg-slate-950">
          <RoadSnappedMap
            mode="single-driver"
            drivers={driverForMap}
            activeDriverId={driverForMap[0].id}
            className="h-full w-full"
          />
        </div>

        {/* RIGHT SIDE (30% Width): Driving-Safe Minimal Next-Stop Panel (FIX 4) */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-3 h-full">
          
          {/* Card 1: Immediate Next Maneuver in Plain Words */}
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-700 p-4 text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-800 border border-emerald-400/30 text-white font-bold shadow-inner">
                <Navigation className="h-6 w-6 rotate-45" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200 block">
                  Current Road Direction
                </span>
                <h3 className="text-fluid-sm font-extrabold leading-snug truncate">
                  {tour?.turnInstruction || 'Head forward onto collection route'}
                </h3>
                <p className="text-[11px] text-emerald-200 font-medium mt-0.5">
                  {tour ? `${tour.distanceToNextMeters} m away` : 'Calculating route…'} · Next turn
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: 2-Opt TSP Multi-Stop Optimization Metrics */}
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>2-Opt TSP Route Optimizer</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {tour?.savedDistancePct || 24}% Shorter Tour
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-sunken/50 border border-line/50">
                <span className="text-[10px] text-muted block">Optimized Total</span>
                <strong className="text-emerald-600 font-mono text-xs">
                  {tour?.totalDistanceKm || 3.4} km
                </strong>
              </div>
              <div className="p-2 rounded-xl bg-sunken/50 border border-line/50">
                <span className="text-[10px] text-muted block">Naive Baseline</span>
                <span className="text-muted line-through font-mono text-xs">
                  {tour?.baselineDistanceKm || 4.5} km
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Immediate Next Stop Card (High-Contrast & Glanceable) */}
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs space-y-3 flex-1 flex flex-col justify-between">
            {nextStop ? (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 block">
                      Immediate Next Stop ({remainingCount} Left)
                    </span>
                    <h3 className="text-fluid-base font-extrabold text-ink leading-tight mt-0.5">
                      {nextStop.name}
                    </h3>
                    <p className="text-[11px] text-muted mt-0.5">{nextStop.address}</p>
                  </div>
                  <Badge tone={nextStop.urgency === 'EMERGENCY' ? 'danger' : 'brand'}>
                    {nextStop.category}
                  </Badge>
                </div>

                {nextStop.notes && (
                  <p className="text-[11px] text-muted bg-sunken/60 p-2 rounded-xl border border-line/60">
                    "{nextStop.notes}"
                  </p>
                )}

                {/* Distance & ETA Countdown */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <MapPin className="h-4 w-4" />
                    <span>{tour?.distanceToNextMeters || 800} m away</span>
                  </div>
                  <span className="font-extrabold text-xs font-mono">
                    ~{Math.max(1, Math.round((tour?.distanceToNextMeters || 800) / 400))} min
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-1">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-ink text-fluid-sm">All Stops Completed!</h4>
                <p className="text-fluid-xs text-muted">All assigned complaints have been cleared.</p>
              </div>
            )}

            {/* Quick Actions & Collapsed Full Sequence List */}
            <div className="space-y-2 pt-2 border-t border-line/60">
              {nextStop && (
                <button
                  type="button"
                  onClick={handleCompleteCurrentStop}
                  disabled={isCollecting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-xs shadow-md bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark Stop Collected
                </button>
              )}

              {/* Collapsed/Expanded Stops Remaining Toggle */}
              {remainingCount > 1 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsListExpanded(!isListExpanded)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-line bg-sunken/40 text-fluid-xs font-semibold text-muted hover:text-ink transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <ListOrdered className="h-3.5 w-3.5 text-brand" />
                      <span>{remainingCount} stops remaining in tour</span>
                    </span>
                    {isListExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {isListExpanded && tour && (
                    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto no-scrollbar pt-1">
                      {tour.orderedStops.slice(1).map((s, idx) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line text-[11px]"
                        >
                          <div className="min-w-0 pr-2">
                            <strong className="text-ink font-semibold truncate block">
                              #{idx + 2}. {s.name}
                            </strong>
                            <span className="text-muted text-[10px] truncate block">{s.address}</span>
                          </div>
                          <Badge tone="neutral" className="text-[9px]">
                            {s.category}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
