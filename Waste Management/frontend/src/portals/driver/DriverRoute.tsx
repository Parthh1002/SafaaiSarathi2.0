import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Card, EmptyState, ErrorState, Loading, toast } from '../../components/ui';
import RoadSnappedMap from '../../components/map/RoadSnappedMap';
import { mockFleetEngine, SimulatedDriver } from '../../lib/mockFleetEngine';
import { useT } from '../../lib/i18n';

export default function DriverRoute() {
  const t = useT();
  const [drivers, setDrivers] = useState<SimulatedDriver[]>([]);
  const [myDriverId, setMyDriverId] = useState<string>('drv-01');
  const [isCollected, setIsCollected] = useState(false);

  // Connect to the shared fleet engine (or WebSocket GPS feed)
  useEffect(() => {
    const unsubscribe = mockFleetEngine.subscribe((updatedList) => {
      setDrivers([...updatedList]);
    });
    return () => unsubscribe();
  }, []);

  const currentDriver = drivers.find((d) => d.id === myDriverId) || drivers[0];

  const handleMarkCollected = () => {
    setIsCollected(true);
    toast.success(`Waste collected from ${currentDriver?.destination.name}!`);
    setTimeout(() => {
      setIsCollected(false);
    }, 4000);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Route Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
              <Navigation className="h-4 w-4" />
            </span>
            <h1 className="text-fluid-lg font-extrabold text-ink tracking-tight">
              Live Road Navigation
            </h1>
          </div>
          <p className="text-fluid-xs text-muted">
            OSRM road-snapped turn-by-turn routing with real-time street tracking
          </p>
        </div>

        {/* Driver Selector for Testing Multiple Vehicle Routes */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-muted uppercase">Active Vehicle:</span>
          <select
            value={myDriverId}
            onChange={(e) => setMyDriverId(e.target.value)}
            className="field py-1.5 px-3 text-fluid-xs font-semibold rounded-xl border border-line bg-surface cursor-pointer"
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.vehicleNumber}) - {d.wardCode}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 70% / 30% SPLIT SCREEN LAYOUT: MAP (LEFT 70%) + DETAILS SIDEBAR (RIGHT 30%) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-stretch">
        
        {/* LEFT SIDE (70% Width): Road-Snapped Live Map */}
        <div className="lg:col-span-7 h-[68dvh] min-h-[440px] rounded-3xl border border-line overflow-hidden shadow-lg relative bg-slate-950">
          {drivers.length > 0 ? (
            <RoadSnappedMap
              mode="single-driver"
              drivers={drivers}
              activeDriverId={myDriverId}
              className="h-full w-full"
            />
          ) : (
            <Loading label="Snapping route to road network…" />
          )}
        </div>

        {/* RIGHT SIDE (30% Width): Live Navigation & Assignment Sidebar Panel */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-3 h-full">
          
          {/* Card 1: Next Turn Maneuver Header */}
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-700 p-4 text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-800 border border-emerald-400/30 text-white font-bold shadow-inner">
                <Navigation className="h-6 w-6 rotate-45" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200 block">
                  Next Step
                </span>
                <h3 className="text-fluid-sm font-extrabold leading-snug truncate">
                  {currentDriver?.route?.steps?.[0]?.instruction || `Head forward onto ${currentDriver?.destination.name}`}
                </h3>
                <p className="text-[11px] text-emerald-200 font-medium">
                  {currentDriver?.remainingDistanceKm} km · In {currentDriver?.etaMinutes} min
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Live Navigation Telemetry & ETA */}
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  Estimated Arrival
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-fluid-xl font-extrabold text-emerald-600 tracking-tight">
                    {currentDriver?.etaMinutes} min
                  </span>
                  <span className="text-xs text-muted font-medium">
                    ({currentDriver?.remainingDistanceKm} km left)
                  </span>
                </div>
              </div>

              <div className="text-right">
                <Badge
                  tone={currentDriver?.status === 'en_route' ? 'ok' : currentDriver?.status === 'delayed' ? 'danger' : 'warn'}
                  className="font-bold text-[10px]"
                >
                  {currentDriver?.status.toUpperCase()}
                </Badge>
                <p className="text-[11px] text-muted mt-1 font-mono font-bold">
                  {currentDriver?.speedKmh} km/h
                </p>
              </div>
            </div>

            {/* Vehicle & Fuel row */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-xl bg-sunken/60 p-2 border border-line/50">
                <span className="text-[10px] text-muted block">Vehicle</span>
                <strong className="text-ink font-mono text-[11px] truncate block">
                  {currentDriver?.vehicleNumber}
                </strong>
              </div>
              <div className="rounded-xl bg-sunken/60 p-2 border border-line/50">
                <span className="text-[10px] text-muted block">Fuel Status</span>
                <strong className="text-emerald-600 font-mono text-[11px] block">
                  {currentDriver?.fuelPct}%
                </strong>
              </div>
            </div>
          </div>

          {/* Card 3: Destination Assignment & Stop Details */}
          {currentDriver && (
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Collection Point
                  </span>
                  <h4 className="text-fluid-sm font-bold text-ink leading-tight mt-0.5">
                    {currentDriver.destination.name}
                  </h4>
                  <p className="text-[11px] text-muted mt-0.5">{currentDriver.destination.address}</p>
                </div>
                <Badge tone={currentDriver.destination.urgency === 'EMERGENCY' ? 'danger' : 'brand'}>
                  {currentDriver.destination.category}
                </Badge>
              </div>

              <div className="rounded-xl border border-line bg-sunken/40 p-2 flex justify-between text-fluid-xs">
                <span className="text-muted text-[11px]">Ward Zone:</span>
                <strong className="text-ink text-[11px] font-mono">{currentDriver.wardName} ({currentDriver.wardCode})</strong>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleMarkCollected}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs shadow-xs transition cursor-pointer ${
                    isCollected
                      ? 'bg-ok text-white'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                >
                  {isCollected ? (
                    <>
                      <Check className="h-4 w-4" /> Picked Up & Logged!
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Mark Waste Collected
                    </>
                  )}
                </button>

                <a
                  href={`tel:${currentDriver.phone}`}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line bg-surface hover:bg-sunken text-xs font-semibold text-ink transition cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-brand" /> Call Ward Officer
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
