import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';

/**
 * Leaflet + OpenStreetMap (plan §5) — free, no per-request billing, no API key.
 * The dark theme is achieved by filtering the tile layer in CSS rather than
 * paying for a second tile style.
 */

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const GANDHINAGAR: [number, number] = [23.2156, 72.6369];

export function BaseMap({
  center = GANDHINAGAR,
  zoom = 13,
  children,
  className = 'h-full w-full',
  scrollWheelZoom = true,
}: {
  center?: [number, number];
  zoom?: number;
  children?: ReactNode;
  className?: string;
  scrollWheelZoom?: boolean;
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={scrollWheelZoom}
      className={className}
      zoomControl={false}
      preferCanvas
    >
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      {children}
    </MapContainer>
  );
}

/**
 * The truck marker (plan §4.4).
 *
 * Raw GPS arrives every 2-4 s; jumping the marker looks broken. We interpolate
 * between the previous and next fix with requestAnimationFrame over ~2 s and
 * rotate the icon to the reported heading, which is what produces the
 * "Google Maps" feel of a vehicle actually driving.
 */
export function TruckMarker({
  latitude,
  longitude,
  heading = 0,
  label,
  active = true,
  onClick,
  children,
}: {
  latitude: number;
  longitude: number;
  heading?: number;
  label?: string;
  active?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const markerRef = useRef<L.Marker>(null);
  const animation = useRef<number>();
  const current = useRef<[number, number]>([latitude, longitude]);

  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'truck-marker',
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        html: `
          <div class="relative grid h-[38px] w-[38px] place-items-center">
            ${active ? '<span class="absolute inset-0 rounded-full bg-emerald-500/30 animate-pulse-ring"></span>' : ''}
            <span class="truck-marker__body grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-emerald-600 shadow-lg"
                  style="transform: rotate(${heading}deg)">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="white" stroke-width="2.1"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3 L12 17" />
                <path d="M7 8 L12 3 L17 8" />
              </svg>
            </span>
          </div>`,
      }),
    [heading, active]
  );

  // Glide to each new fix instead of teleporting.
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = current.current;
    const to: [number, number] = [latitude, longitude];
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);

    // A jump larger than ~2 km is a re-centre, not movement — snap instead.
    if (distance > 0.02 || distance === 0) {
      current.current = to;
      marker.setLatLng(to);
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      current.current = to;
      marker.setLatLng(to);
      return;
    }

    const start = performance.now();
    const duration = 1800;
    if (animation.current) cancelAnimationFrame(animation.current);

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t); // ease-out
      const lat = from[0] + (to[0] - from[0]) * eased;
      const lng = from[1] + (to[1] - from[1]) * eased;
      marker.setLatLng([lat, lng]);
      current.current = [lat, lng];
      if (t < 1) animation.current = requestAnimationFrame(step);
    };
    animation.current = requestAnimationFrame(step);

    return () => {
      if (animation.current) cancelAnimationFrame(animation.current);
    };
  }, [latitude, longitude]);

  return (
    <Marker ref={markerRef} position={current.current} icon={icon} eventHandlers={onClick ? { click: onClick } : undefined}>
      {(children || label) && <Popup>{children ?? label}</Popup>}
    </Marker>
  );
}

/**
 * Route progress: the traversed portion greys out and the remaining portion
 * stays green, which is the "progress" read the plan asks for.
 */
export function RouteLine({
  polyline,
  progressIndex = 0,
}: {
  polyline: [number, number][]; // [lng, lat] as stored
  progressIndex?: number;
}) {
  const latlngs = useMemo(() => polyline.map(([lng, lat]) => [lat, lng] as [number, number]), [polyline]);
  if (latlngs.length < 2) return null;

  const cut = Math.max(0, Math.min(latlngs.length - 1, progressIndex));
  const done = latlngs.slice(0, cut + 1);
  const remaining = latlngs.slice(cut);

  return (
    <>
      {done.length > 1 && <Polyline positions={done} pathOptions={{ color: '#94a3b8', weight: 5, opacity: 0.65 }} />}
      <Polyline positions={remaining} pathOptions={{ color: '#16a34a', weight: 5, opacity: 0.95 }} />
    </>
  );
}

export function WardLayer({
  wards,
  colorFor,
  onSelect,
}: {
  wards: Array<{ id: string; name: string; code: string; boundary: any; load?: number; openComplaints?: number }>;
  colorFor?: (ward: any) => string;
  onSelect?: (wardId: string) => void;
}) {
  return (
    <>
      {wards.map((ward) => {
        const ring: [number, number][] = (ward.boundary?.coordinates?.[0] ?? []).map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );
        if (!ring.length) return null;
        const color = colorFor?.(ward) ?? '#16a34a';

        return (
          <Polygon
            key={ward.id}
            positions={ring}
            pathOptions={{ color, weight: 1.5, fillColor: color, fillOpacity: 0.16 }}
            eventHandlers={onSelect ? { click: () => onSelect(ward.id) } : undefined}
          >
            <Popup>
              <div className="space-y-0.5">
                <p className="font-semibold">{ward.name}</p>
                <p className="text-xs text-muted">{ward.code}</p>
                {ward.openComplaints != null && <p className="text-xs">{ward.openComplaints} open complaints</p>}
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}

/**
 * Complaint density. Leaflet.heat would add another dependency for one screen;
 * weighted translucent circles read the same at city zoom and stay clickable,
 * which a heat canvas is not.
 */
export function ComplaintLayer({
  points,
  onSelect,
}: {
  points: Array<{
    id: string;
    code?: string;
    latitude: number;
    longitude: number;
    weight?: number;
    severity?: string;
    isEmergency?: boolean;
    category?: string;
    status?: string;
  }>;
  onSelect?: (id: string) => void;
}) {
  return (
    <>
      {points.map((p) => {
        const color = p.isEmergency ? '#dc2626' : p.severity === 'HIGH' ? '#f59e0b' : p.status === 'RESOLVED' ? '#16a34a' : '#2563eb';
        return (
          <CircleMarker
            key={p.id}
            center={[p.latitude, p.longitude]}
            radius={5 + Math.min(9, (p.weight ?? 1) * 2)}
            pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.42 }}
            eventHandlers={onSelect ? { click: () => onSelect(p.id) } : undefined}
          >
            <Popup>
              <div className="space-y-0.5">
                <p className="font-semibold">{p.code ?? 'Complaint'}</p>
                {p.category && <p className="text-xs">{p.category.replace(/_/g, ' ').toLowerCase()}</p>}
                {p.status && <p className="text-xs text-muted">{p.status}</p>}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

/** A single pin — the complaint being reported or tracked. */
export function PinMarker({ latitude, longitude, tone = 'brand', label }: { latitude: number; longitude: number; tone?: 'brand' | 'danger'; label?: string }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: '',
        iconSize: [26, 34],
        iconAnchor: [13, 32],
        html: `<svg viewBox="0 0 26 34" width="26" height="34" aria-hidden="true">
                 <path d="M13 33C13 33 24 21.4 24 13A11 11 0 1 0 2 13c0 8.4 11 20 11 20Z"
                       fill="${tone === 'danger' ? '#dc2626' : '#15803d'}" stroke="white" stroke-width="2"/>
                 <circle cx="13" cy="13" r="4.2" fill="white"/>
               </svg>`,
      }),
    [tone]
  );

  return (
    <Marker position={[latitude, longitude]} icon={icon}>
      {label && <Popup>{label}</Popup>}
    </Marker>
  );
}

/** Keeps the viewport on a moving target without fighting the user's panning. */
export function FollowTarget({ latitude, longitude, enabled = true, zoom }: { latitude?: number | null; longitude?: number | null; enabled?: boolean; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || latitude == null || longitude == null) return;
    map.setView([latitude, longitude], zoom ?? map.getZoom(), { animate: true, duration: 0.8 });
  }, [map, latitude, longitude, enabled, zoom]);
  return null;
}

/** Fits the map to everything it has been given, once. */
export function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
    done.current = true;
  }, [map, points]);
  return null;
}

/** Lets the citizen drag a pin to correct the reported location. */
export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => onChange(e.latlng.lat, e.latlng.lng);
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [map, onChange]);

  return <PinMarker latitude={latitude} longitude={longitude} label="Drag or tap the map to adjust" />;
}

export { Polygon, Polyline, CircleMarker, Marker, Popup, useMap };
