import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Plus,
  Truck,
  Wifi,
  WifiOff,
  Wrench,
  MapPin,
  Filter,
  Search,
  AlertTriangle,
  RefreshCw,
  Phone,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Badge, Card, ErrorState, Loading, Modal, SectionTitle, toast } from '../../components/ui';
import RoadSnappedMap from '../../components/map/RoadSnappedMap';
import { mockFleetEngine, SimulatedDriver } from '../../lib/mockFleetEngine';

export default function MasterFleet() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [drivers, setDrivers] = useState<SimulatedDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Connect to shared real road-snapped fleet simulation (or WebSocket)
  useEffect(() => {
    const unsubscribe = mockFleetEngine.subscribe((list) => {
      setDrivers([...list]);
      if (!selectedDriverId && list.length > 0) {
        setSelectedDriverId(list[0].id);
      }
    });
    return () => unsubscribe();
  }, []);

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
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
              <Truck className="h-5 w-5" />
            </div>
            <h1 className="text-fluid-xl font-extrabold tracking-tight text-ink">City-Wide Fleet Command</h1>
          </div>
          <p className="mt-1 text-fluid-xs text-muted">
            Real-time road-snapped fleet tracking, OSRM routing, live speeds, and off-route roaming detection
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="ok" className="font-bold py-1.5 px-3">
            {activeCount} Trucks En Route
          </Badge>
          {delayedCount > 0 && (
            <Badge tone="danger" className="font-bold py-1.5 px-3">
              {delayedCount} Delayed
            </Badge>
          )}
        </div>
      </div>

      {/* Fleet Stats Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Total Fleet Active</span>
          <p className="mt-1 text-fluid-lg font-extrabold text-ink">{drivers.length} Vehicles</p>
          <p className="text-[11px] text-ok font-semibold">100% GPS Connected</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">En Route Collecting</span>
          <p className="mt-1 text-fluid-lg font-extrabold text-emerald-600">{activeCount} Vehicles</p>
          <p className="text-[11px] text-muted">Moving along road routes</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Idle / Processing</span>
          <p className="mt-1 text-fluid-lg font-extrabold text-amber-500">{idleCount} Vehicles</p>
          <p className="text-[11px] text-muted">At collection wards</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Delayed / Off-Route</span>
          <p className="mt-1 text-fluid-lg font-extrabold text-red-500">{delayedCount} Vehicles</p>
          <p className="text-[11px] text-red-500 font-semibold">{delayedCount > 0 ? 'Action required' : 'All on schedule'}</p>
        </div>
      </div>

      {/* Main Multi-Driver Road-Snapped Fleet Map */}
      <div className="relative h-[55dvh] min-h-[400px] w-full overflow-hidden rounded-3xl border border-line shadow-lg">
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

      {/* Fleet Filter Bar & Driver Cards Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search driver, vehicle or ward…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field pl-9 py-2 text-fluid-xs rounded-xl border border-line bg-surface w-full"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['all', 'en_route', 'idle', 'delayed'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition capitalize cursor-pointer ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-surface border border-line text-muted hover:text-ink'
                }`}
              >
                {st === 'en_route' ? 'En Route' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDrivers.map((drv) => {
            const isSelected = drv.id === selectedDriverId;
            return (
              <div
                key={drv.id}
                onClick={() => setSelectedDriverId(drv.id)}
                className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/10 shadow-md ring-2 ring-emerald-500/30'
                    : 'border-line bg-surface hover:border-emerald-500/40 hover:shadow-xs'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
                        <Truck className="h-5 w-5" />
                      </span>
                      <div>
                        <h4 className="text-fluid-sm font-bold text-ink leading-tight">{drv.name}</h4>
                        <p className="text-[11px] font-mono text-muted">{drv.vehicleNumber}</p>
                      </div>
                    </div>

                    <Badge
                      tone={drv.status === 'en_route' ? 'ok' : drv.status === 'delayed' ? 'danger' : 'warn'}
                      className="font-bold text-[10px]"
                    >
                      {drv.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-line bg-sunken/40 p-2.5 space-y-1 text-fluid-xs">
                    <div className="flex justify-between">
                      <span className="text-muted text-[11px]">Ward:</span>
                      <strong className="text-ink text-[11px]">{drv.wardName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted text-[11px]">Destination:</span>
                      <span className="text-ink text-[11px] truncate max-w-[170px] font-medium">
                        {drv.destination.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted text-[11px]">Road Distance / ETA:</span>
                      <strong className="text-emerald-600 text-[11px] font-mono">
                        {drv.remainingDistanceKm} km · {drv.etaMinutes} min
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-line/60 text-[11px]">
                  <span className="text-muted font-mono">{drv.speedKmh} km/h</span>
                  <a
                    href={`tel:${drv.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 font-bold text-brand hover:underline"
                  >
                    <Phone className="h-3 w-3" /> Call Driver
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
