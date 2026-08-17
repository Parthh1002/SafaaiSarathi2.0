/**
 * Safaai Sarathi 2.0 - Reusable Road-Snapped Fleet & Navigation Map
 * =================================================================
 * Single source of truth for Road-Snapped Routing & Real-Time Tracking.
 *
 * Supported Modes:
 * 1. 'single-driver': Driver App turn-by-turn navigation with live auto-follow,
 *    maneuver banner, ETA countdown, and destination pin.
 * 2. 'multi-driver': Super Admin fleet command map showing all active trucks
 *    moving simultaneously with road-snapped polylines, status filters, and roaming alerts.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Navigation,
  MapPin,
  Truck,
  Compass,
  AlertTriangle,
  Clock,
  Gauge,
  Fuel,
  Phone,
  Layers,
  Crosshair,
  Volume2,
  VolumeX,
  CheckCircle2,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import { SimulatedDriver } from '../../lib/mockFleetEngine';
import { Badge, Card } from '../ui';

// ------------------------------------------------ Custom Leaflet Icons

/** Animated Truck Marker Icon with Heading Rotation & Status Color */
function createTruckIcon(heading: number, status: string, isSelected: boolean) {
  let bgColor = '#10b981'; // Emerald (en_route)
  let ringColor = 'rgba(16, 185, 129, 0.35)';

  if (status === 'delayed' || status === 'off_route') {
    bgColor = '#ef4444'; // Red
    ringColor = 'rgba(239, 68, 68, 0.45)';
  } else if (status === 'idle') {
    bgColor = '#f59e0b'; // Amber
    ringColor = 'rgba(245, 158, 11, 0.35)';
  } else if (status === 'at_destination') {
    bgColor = '#0ea5e9'; // Blue
    ringColor = 'rgba(14, 165, 233, 0.35)';
  }

  const borderClass = isSelected ? 'border-4 border-yellow-300 scale-110 shadow-2xl ring-4 ring-yellow-400/50' : 'border-2 border-white shadow-lg';

  return L.divIcon({
    className: 'road-truck-icon',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    html: `
      <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; inset: 0; border-radius: 9999px; background: ${ringColor}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div class="${borderClass}" style="
          position: relative;
          width: 34px;
          height: 34px;
          border-radius: 9999px;
          background: ${bgColor};
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${heading}deg);
          transition: transform 0.4s ease-out;
        ">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3 L12 17" />
            <path d="M7 8 L12 3 L17 8" />
          </svg>
        </div>
      </div>
    `,
  });
}

/** Destination Marker Icon */
const destinationIcon = L.divIcon({
  className: 'destination-point-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 34],
  html: `
    <div style="position: relative; width: 36px; height: 36px; display: flex; flex-direction: column; align-items: center;">
      <div style="width: 32px; height: 32px; border-radius: 9999px; background: #ef4444; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <div style="width: 4px; height: 6px; background: #ef4444; border-radius: 2px;"></div>
    </div>
  `,
});

// ------------------------------------------------ Leaflet Controller Hooks

function MapFollowCenter({ target, follow }: { target: [number, number]; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow && target[0] && target[1]) {
      map.panTo(target, { animate: true, duration: 1.2 });
    }
  }, [map, target, follow]);
  return null;
}

// ------------------------------------------------ Component Interface

export interface RoadSnappedMapProps {
  mode: 'single-driver' | 'multi-driver';
  drivers: SimulatedDriver[];
  activeDriverId?: string;
  onSelectDriver?: (driver: SimulatedDriver) => void;
  className?: string;
}

export default function RoadSnappedMap({
  mode,
  drivers,
  activeDriverId,
  onSelectDriver,
  className = 'h-full w-full',
}: RoadSnappedMapProps) {
  const [selectedId, setSelectedId] = useState<string>(activeDriverId || drivers[0]?.id || '');
  const [follow, setFollow] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (activeDriverId) setSelectedId(activeDriverId);
  }, [activeDriverId]);

  const activeDriver = useMemo(() => {
    return drivers.find((d) => d.id === selectedId) || drivers[0];
  }, [drivers, selectedId]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.wardName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [drivers, searchQuery, statusFilter]);

  const delayedDrivers = useMemo(() => {
    return drivers.filter((d) => d.status === 'delayed' || d.isOffRoute);
  }, [drivers]);

  const centerPos: [number, number] = activeDriver
    ? [activeDriver.currentLat, activeDriver.currentLng]
    : [23.2156, 72.6369];

  return (
    <div className={`relative overflow-hidden bg-slate-950 text-slate-100 ${className}`}>
      
      {/* ----------------- SUPER ADMIN: Multi-Driver Alert Bar ----------------- */}
      {mode === 'multi-driver' && delayedDrivers.length > 0 && (
        <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md z-[1000] animate-bounce-short">
          <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-red-500/50 bg-red-950/90 p-3 text-red-200 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-xs font-bold text-white">
                  {delayedDrivers.length} Vehicle{delayedDrivers.length > 1 ? 's' : ''} Delayed / Off-Route
                </p>
                <p className="text-[11px] text-red-300 truncate">
                  {delayedDrivers[0].name} ({delayedDrivers[0].vehicleNumber}) stopped
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(delayedDrivers[0].id);
                if (onSelectDriver) onSelectDriver(delayedDrivers[0]);
              }}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition cursor-pointer"
            >
              Focus
            </button>
          </div>
        </div>
      )}

      {/* ----------------- DRIVER MODE: Top Navigation Maneuver Banner ----------------- */}
      {mode === 'single-driver' && activeDriver && activeDriver.route && (
        <div className="absolute top-4 left-4 right-4 z-[1000] max-w-lg mx-auto animate-fade-in">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-700 p-4 text-white shadow-2xl border border-emerald-500/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-800 border border-emerald-400/30 text-white font-bold shadow-inner">
                <Navigation className="h-7 w-7 rotate-45" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-200 block">
                  Next Maneuver
                </span>
                <p className="text-fluid-base font-extrabold leading-snug truncate">
                  {activeDriver.route.steps?.[0]?.instruction || `Continue on ${activeDriver.destination.name}`}
                </p>
                <p className="text-xs text-emerald-200 font-medium">
                  {activeDriver.remainingDistanceKm} km · In {activeDriver.etaMinutes} min
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-800 text-emerald-200 transition cursor-pointer"
              title="Toggle Navigation Voice"
            >
              {soundEnabled ? <Volume2 className="h-5 w-5 text-white" /> : <VolumeX className="h-5 w-5 text-emerald-400" />}
            </button>
          </div>
        </div>
      )}

      {/* ----------------- Leaflet Road-Snapped Map ----------------- */}
      <MapContainer
        center={centerPos}
        zoom={mode === 'single-driver' ? 15 : 13}
        scrollWheelZoom={true}
        className="h-full w-full"
        zoomControl={false}
        preferCanvas
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {/* Render Road-Snapped Polylines for Active Driver */}
        {activeDriver && activeDriver.route && activeDriver.route.coordinates.length > 1 && (
          <>
            {/* Dark contrast casing behind road polyline for Google Maps feel */}
            <Polyline
              positions={activeDriver.route.coordinates}
              pathOptions={{
                color: '#064e3b',
                weight: 8,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Vibrant primary road polyline */}
            <Polyline
              positions={activeDriver.route.coordinates}
              pathOptions={{
                color: activeDriver.status === 'delayed' ? '#ef4444' : '#10b981',
                weight: 5,
                opacity: 1.0,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />

            {/* Destination Point Marker */}
            <Marker
              position={[activeDriver.destination.latitude, activeDriver.destination.longitude]}
              icon={destinationIcon}
            >
              <Popup className="road-snapped-popup">
                <div className="p-1 space-y-1">
                  <p className="font-bold text-xs text-ink">{activeDriver.destination.name}</p>
                  <p className="text-[10px] text-muted">{activeDriver.destination.address}</p>
                  <Badge tone="brand" className="text-[10px]">
                    {activeDriver.destination.category}
                  </Badge>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Multi-Driver Mode: Render Inactive Driver Polylines (semi-transparent) */}
        {mode === 'multi-driver' &&
          drivers.map((drv) => {
            if (drv.id === selectedId || !drv.route) return null;
            return (
              <Polyline
                key={`route-${drv.id}`}
                positions={drv.route.coordinates}
                pathOptions={{
                  color: '#64748b',
                  weight: 3,
                  opacity: 0.45,
                  dashArray: '4, 8',
                }}
              />
            );
          })}

        {/* Live Truck Markers for All Drivers */}
        {drivers.map((drv) => {
          const isSelected = drv.id === selectedId;
          return (
            <Marker
              key={drv.id}
              position={[drv.currentLat, drv.currentLng]}
              icon={createTruckIcon(drv.heading, drv.status, isSelected)}
              eventHandlers={{
                click: () => {
                  setSelectedId(drv.id);
                  if (onSelectDriver) onSelectDriver(drv);
                },
              }}
            >
              <Popup className="road-snapped-popup">
                <div className="p-2 space-y-1.5 min-w-[180px]">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-xs text-ink">{drv.name}</p>
                    <span className="text-[10px] font-bold text-brand">{drv.vehicleNumber}</span>
                  </div>
                  <p className="text-[11px] text-muted">{drv.wardName}</p>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-line">
                    <span className="font-bold text-ok">{drv.speedKmh} km/h</span>
                    <span className="text-muted">ETA: {drv.etaMinutes} min</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <MapFollowCenter target={centerPos} follow={follow} />
      </MapContainer>

      {/* ----------------- Floating Map Control Buttons ----------------- */}
      <div className="absolute bottom-24 right-4 z-[1000] flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setFollow(!follow)}
          className={`grid h-12 w-12 place-items-center rounded-2xl shadow-xl border transition cursor-pointer ${
            follow
              ? 'bg-emerald-600 text-white border-emerald-400/60 ring-2 ring-emerald-400/40'
              : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title={follow ? 'Auto-Following Vehicle' : 'Click to Auto-Follow'}
        >
          <Crosshair className="h-5 w-5" />
        </button>
      </div>

      {/* ----------------- DRIVER MODE: Bottom Navigation HUD Sheet ----------------- */}
      {mode === 'single-driver' && activeDriver && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] max-w-lg mx-auto">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl text-slate-100 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-fluid-xl font-extrabold text-emerald-400 tracking-tight">
                    {activeDriver.etaMinutes} min
                  </span>
                  <span className="text-sm text-slate-400">({activeDriver.remainingDistanceKm} km)</span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Assigned Point: <strong className="text-slate-100">{activeDriver.destination.name}</strong>
                </p>
              </div>

              <div className="text-right">
                <Badge tone={activeDriver.status === 'en_route' ? 'ok' : 'warn'} className="font-bold">
                  {activeDriver.status.toUpperCase()}
                </Badge>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">{activeDriver.speedKmh} km/h</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-800/60 p-2 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block">Vehicle</span>
                <strong className="text-slate-200 font-mono text-[11px] truncate block">
                  {activeDriver.vehicleNumber}
                </strong>
              </div>
              <div className="rounded-xl bg-slate-800/60 p-2 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block">Fuel Level</span>
                <strong className="text-emerald-400 font-mono text-[11px] block">{activeDriver.fuelPct}%</strong>
              </div>
              <div className="rounded-xl bg-slate-800/60 p-2 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block">Ward Zone</span>
                <strong className="text-slate-200 text-[11px] truncate block">{activeDriver.wardCode}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SUPER ADMIN MODE: Floating Fleet Inspector Drawer ----------------- */}
      {mode === 'multi-driver' && activeDriver && (
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 z-[1000] animate-sheet-up">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl text-slate-100 space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-fluid-sm font-bold text-white">{activeDriver.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">{activeDriver.vehicleNumber} · {activeDriver.model}</p>
                </div>
              </div>

              <Badge
                tone={activeDriver.status === 'en_route' ? 'ok' : activeDriver.status === 'delayed' ? 'danger' : 'warn'}
                className="font-bold"
              >
                {activeDriver.status.toUpperCase()}
              </Badge>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Destination:</span>
                <strong className="text-white truncate max-w-[200px]">{activeDriver.destination.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Road Distance Left:</span>
                <span className="font-mono text-emerald-400 font-bold">{activeDriver.remainingDistanceKm} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated Transit ETA:</span>
                <span className="font-mono text-white font-bold">{activeDriver.etaMinutes} mins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Speed:</span>
                <span className="font-mono text-slate-200">{activeDriver.speedKmh} km/h</span>
              </div>
            </div>

            {/* Quick action button */}
            <a
              href={`tel:${activeDriver.phone}`}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer"
            >
              <Phone className="h-3.5 w-3.5 text-emerald-400" /> Contact Driver ({activeDriver.phone})
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
