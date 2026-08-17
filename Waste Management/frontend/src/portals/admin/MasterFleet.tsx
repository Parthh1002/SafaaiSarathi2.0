import { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Phone,
  Search,
  MapPin,
  Clock,
  Compass,
  Zap,
  Radio,
  Fuel,
  Navigation2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Badge, Card, Loading } from '../../components/ui';
import RoadSnappedMap from '../../components/map/RoadSnappedMap';
import { mockFleetEngine, SimulatedDriver } from '../../lib/mockFleetEngine';

export default function MasterFleet() {
  const [drivers, setDrivers] = useState<SimulatedDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('drv-parth-real');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Connect to shared real road-snapped fleet engine
  useEffect(() => {
    const unsubscribe = mockFleetEngine.subscribe((list) => {
      setDrivers([...list]);
      if (!selectedDriverId && list.length > 0) {
        setSelectedDriverId(list[0].id);
      }
    });
    return () => unsubscribe();
  }, [selectedDriverId]);

  const selectedDriver = useMemo(() => {
    return drivers.find((d) => d.id === selectedDriverId) || drivers[0] || null;
  }, [drivers, selectedDriverId]);

  const filteredDrivers = drivers.filter((d) => {
    const matchSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.wardName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = drivers.filter((d) => d.status === 'en_route').length;
  const delayedCount = drivers.filter((d) => d.status === 'delayed' || d.isOffRoute).length;
  const idleCount = drivers.filter((d) => d.status === 'idle').length;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
              <Truck className="h-5 w-5" />
            </div>
            <h1 className="text-fluid-xl font-extrabold tracking-tight text-ink">Super Admin Master Fleet</h1>
          </div>
          <p className="mt-0.5 text-fluid-xs text-muted">
            Real-time road-snapped fleet tracking · 1 Physical GPS Driver (parthh1002@gmail.com) + 2 Municipal Demo Vehicles
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="ok" className="font-bold py-1 px-2.5 text-xs">
            {activeCount} En Route
          </Badge>
          {delayedCount > 0 && (
            <Badge tone="danger" className="font-bold py-1 px-2.5 text-xs">
              {delayedCount} Delayed
            </Badge>
          )}
        </div>
      </div>

      {/* Fleet Stats Bar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-3 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Assigned Fleet</span>
          <p className="mt-0.5 text-fluid-lg font-extrabold text-ink">{drivers.length} Vehicles</p>
          <p className="text-[11px] text-emerald-600 font-semibold">1 Real GPS + 2 Ward Units</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-3 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">En Route Collecting</span>
          <p className="mt-0.5 text-fluid-lg font-extrabold text-emerald-600">{activeCount} Vehicles</p>
          <p className="text-[11px] text-muted">Active on road routes</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-3 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Idle / Stationary</span>
          <p className="mt-0.5 text-fluid-lg font-extrabold text-amber-500">{idleCount} Vehicles</p>
          <p className="text-[11px] text-muted">Zero artificial drift</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-3 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Delayed / Flagged</span>
          <p className="mt-0.5 text-fluid-lg font-extrabold text-red-500">{delayedCount} Vehicles</p>
          <p className="text-[11px] text-red-500 font-semibold">{delayedCount > 0 ? 'Requires attention' : 'All clear'}</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 70% / 30% SPLIT: LEFT MAP (70%) + RIGHT TELEMETRY & FLEET SELECTOR (30%) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-start">
        
        {/* Left Column (70% Width): 100% Clean Road-Snapped Map Canvas */}
        <div className="lg:col-span-7 relative h-[68dvh] min-h-[540px] w-full overflow-hidden rounded-3xl border border-line shadow-xl bg-slate-950">
          {drivers.length > 0 ? (
            <RoadSnappedMap
              mode="multi-driver"
              drivers={drivers}
              activeDriverId={selectedDriverId}
              onSelectDriver={(drv) => setSelectedDriverId(drv.id)}
            />
          ) : (
            <Loading label="Connecting to GPS fleet stream…" />
          )}
        </div>

        {/* Right Column (30% Width): Dedicated Driver Telemetry & Fleet Inspector */}
        <div className="lg:col-span-3 space-y-3">
          
          {/* Selected Vehicle Detailed Telemetry Card */}
          {selectedDriver ? (
            <div className="rounded-3xl border border-line bg-surface p-4 shadow-md space-y-3.5">
              
              {/* Header: Driver Info & GPS Source Badge */}
              <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 font-extrabold">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-fluid-sm font-extrabold text-ink leading-tight">
                      {selectedDriver.name}
                    </h3>
                    <p className="text-[11px] font-mono text-muted">
                      {selectedDriver.vehicleNumber} · {selectedDriver.model}
                    </p>
                  </div>
                </div>

                <Badge
                  tone={
                    selectedDriver.status === 'en_route'
                      ? 'ok'
                      : selectedDriver.status === 'delayed'
                      ? 'danger'
                      : 'warn'
                  }
                  className="font-bold text-[10px] uppercase"
                >
                  {selectedDriver.status}
                </Badge>
              </div>

              {/* Hardware Real GPS Indicator */}
              {selectedDriver.isRealGps ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  <Radio className="h-4 w-4 shrink-0 text-emerald-600 animate-pulse" />
                  <span>Physical GPS Device Synced (parthh1002@gmail.com)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-slate-500/10 border border-line px-3 py-1.5 text-muted text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Municipal Demo Fleet Unit</span>
                </div>
              )}

              {/* Live Metric Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-line bg-sunken/40 p-2.5 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted block flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" /> Current Speed
                  </span>
                  <strong className="text-fluid-sm font-mono text-ink">
                    {selectedDriver.speedKmh} km/h
                  </strong>
                </div>

                <div className="rounded-xl border border-line bg-sunken/40 p-2.5 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted block flex items-center gap-1">
                    <Clock className="h-3 w-3 text-blue-500" /> Est. Transit ETA
                  </span>
                  <strong className="text-fluid-sm font-mono text-emerald-600">
                    {selectedDriver.etaMinutes} min
                  </strong>
                </div>

                <div className="rounded-xl border border-line bg-sunken/40 p-2.5 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted block flex items-center gap-1">
                    <Navigation2 className="h-3 w-3 text-emerald-500" /> Road Remaining
                  </span>
                  <strong className="text-fluid-sm font-mono text-ink">
                    {selectedDriver.remainingDistanceKm} km
                  </strong>
                </div>

                <div className="rounded-xl border border-line bg-sunken/40 p-2.5 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted block flex items-center gap-1">
                    <Fuel className="h-3 w-3 text-purple-500" /> Fuel Level
                  </span>
                  <strong className="text-fluid-sm font-mono text-ink">
                    {selectedDriver.fuelPct}%
                  </strong>
                </div>
              </div>

              {/* Destination Point & Ward Section */}
              <div className="rounded-2xl border border-line bg-sunken/30 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-muted">Assigned Target</span>
                  <Badge
                    tone={selectedDriver.destination.urgency === 'EMERGENCY' ? 'danger' : 'brand'}
                    className="text-[9px] font-bold"
                  >
                    {selectedDriver.destination.category}
                  </Badge>
                </div>
                <p className="font-extrabold text-ink text-fluid-xs">
                  {selectedDriver.destination.name}
                </p>
                <p className="text-[11px] text-muted truncate">
                  {selectedDriver.destination.address}
                </p>
                <div className="pt-1 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
                  <span>Ward Section:</span>
                  <strong className="text-ink">{selectedDriver.wardName}</strong>
                </div>
              </div>

              {/* Action: Direct Phone Call */}
              <a
                href={`tel:${selectedDriver.phone}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Phone className="h-3.5 w-3.5" /> Call Driver ({selectedDriver.phone})
              </a>
            </div>
          ) : (
            <Card className="p-5 text-center text-muted">
              Select a vehicle from below to inspect live telemetry.
            </Card>
          )}

          {/* Fleet Vehicle Selector (All 3 Vehicles) */}
          <div className="rounded-3xl border border-line bg-surface p-3.5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                Active Fleet Units ({drivers.length})
              </h4>
              <span className="text-[10px] text-emerald-600 font-bold">100% Road-Snapped</span>
            </div>

            <div className="space-y-2">
              {drivers.map((drv) => {
                const isSelected = drv.id === selectedDriverId;
                return (
                  <button
                    key={drv.id}
                    type="button"
                    onClick={() => setSelectedDriverId(drv.id)}
                    className={`w-full text-left p-2.5 rounded-2xl border transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-500/10 shadow-sm ring-2 ring-emerald-500/30'
                        : 'border-line bg-surface hover:border-emerald-500/40 hover:bg-sunken/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-bold ${
                          isSelected ? 'bg-emerald-600 text-white' : 'bg-sunken text-muted'
                        }`}
                      >
                        <Truck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-fluid-xs font-bold text-ink truncate leading-tight">
                            {drv.name}
                          </p>
                          {drv.isRealGps && (
                            <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded-md">
                              GPS
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-muted truncate">
                          {drv.vehicleNumber} · {drv.wardCode}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[10px] font-bold block ${
                          drv.status === 'en_route'
                            ? 'text-emerald-600'
                            : drv.status === 'delayed'
                            ? 'text-red-500'
                            : 'text-amber-500'
                        }`}
                      >
                        {drv.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-muted font-mono">{drv.speedKmh} km/h</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
