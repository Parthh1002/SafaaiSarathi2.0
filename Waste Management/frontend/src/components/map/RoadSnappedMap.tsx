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

  const centerPos: [number, number] = useMemo(() => {
    if (!activeDriver) return [23.2156, 72.6369];
    const lat = Number(activeDriver.currentLat);
    const lng = Number(activeDriver.currentLng);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 ? [lat, lng] : [23.2156, 72.6369];
  }, [activeDriver]);

  return (
    <div className={`relative overflow-hidden bg-slate-950 text-slate-100 ${className}`}>
      
      {/* ----------------- Clean Leaflet Road-Snapped Map Canvas ----------------- */}
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
        {activeDriver && activeDriver.route && activeDriver.route.coordinates && activeDriver.route.coordinates.length > 1 && (
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
            {activeDriver.destination && (
              <Marker
                position={[
                  Number(activeDriver.destination.lat ?? (activeDriver.destination as any).latitude ?? 23.2185),
                  Number(activeDriver.destination.lng ?? (activeDriver.destination as any).longitude ?? 72.6395),
                ]}
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
            )}
          </>
        )}

        {/* Multi-Driver Mode: Render Inactive Driver Polylines (semi-transparent) */}
        {mode === 'multi-driver' &&
          drivers.map((drv) => {
            if (drv.id === selectedId || !drv.route || !drv.route.coordinates) return null;
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
          const lat = Number(drv.currentLat ?? 23.2156);
          const lng = Number(drv.currentLng ?? 72.6369);
          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker
              key={drv.id}
              position={[lat, lng]}
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

      {/* ----------------- Clean Floating Auto-Follow Toggle ----------------- */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setFollow(!follow)}
          className={`grid h-10 w-10 place-items-center rounded-xl shadow-xl border transition cursor-pointer ${
            follow
              ? 'bg-emerald-600 text-white border-emerald-400/60 ring-2 ring-emerald-400/40'
              : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title={follow ? 'Auto-Following Vehicle' : 'Click to Auto-Follow'}
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

