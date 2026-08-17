/**
 * Safaai Sarathi 2.0 - Road-Snapped Routing Service (OSRM Driving Engine)
 * =======================================================================
 * Fetches real turn-by-turn road geometry along actual street networks
 * using Open Source Routing Machine (OSRM) driving profile.
 */

export interface RouteStep {
  instruction: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier?: string;
  location: [number, number]; // [lat, lng]
}

export interface RoadRoute {
  coordinates: [number, number][]; // [lat, lng] road-snapped polyline
  distanceKm: number;
  durationMinutes: number;
  summary: string;
  steps: RouteStep[];
  isFallback?: boolean;
}

// In-memory LRU cache to avoid repeated network calls for identical coordinates
const routeCache = new Map<string, RoadRoute>();

/**
 * Fetch road-snapped driving directions from origin [lat1, lng1] to destination [lat2, lng2]
 */
export async function getRoadSnappedRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<RoadRoute> {
  const cacheKey = `${origin[0].toFixed(5)},${origin[1].toFixed(5)}->${destination[0].toFixed(5)},${destination[1].toFixed(5)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  // OSRM expects coordinates in lng,lat format
  const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primary = data.routes[0];
      // GeoJSON coordinates are [lng, lat], convert to Leaflet [lat, lng]
      const latLngCoordinates: [number, number][] = primary.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
      );

      // Parse step-by-step turn maneuvers
      const steps: RouteStep[] = [];
      if (primary.legs && primary.legs[0]?.steps) {
        for (const s of primary.legs[0].steps) {
          steps.push({
            instruction: formatManeuverInstruction(s.maneuver?.type, s.maneuver?.modifier, s.name),
            name: s.name || 'Unnamed Road',
            distanceMeters: s.distance || 0,
            durationSeconds: s.duration || 0,
            maneuverType: s.maneuver?.type || 'turn',
            maneuverModifier: s.maneuver?.modifier,
            location: [s.maneuver?.location[1], s.maneuver?.location[0]],
          });
        }
      }

      const result: RoadRoute = {
        coordinates: latLngCoordinates,
        distanceKm: Number((primary.distance / 1000).toFixed(2)),
        durationMinutes: Math.max(1, Math.round(primary.duration / 60)),
        summary: primary.legs?.[0]?.summary || 'Primary Road Corridor',
        steps,
        isFallback: false,
      };

      // Keep cache size bounded
      if (routeCache.size > 200) routeCache.clear();
      routeCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn('[Routing] OSRM service request failed, generating high-res curved fallback:', err);
  }

  // Graceful high-resolution curved road fallback if public demo server is throttled
  const fallback = generateCurvedRoadFallback(origin, destination);
  return fallback;
}

/**
 * Format human-readable turn instruction from OSRM maneuver
 */
function formatManeuverInstruction(type?: string, modifier?: string, roadName?: string): string {
  const road = roadName ? ` onto ${roadName}` : '';
  if (type === 'depart') return `Head ${modifier || 'forward'}${road}`;
  if (type === 'arrive') return 'Arrive at waste collection point';
  if (type === 'turn') {
    if (modifier?.includes('left')) return `Turn left${road}`;
    if (modifier?.includes('right')) return `Turn right${road}`;
    return `Continue straight${road}`;
  }
  if (type === 'new name' || type === 'continue') return `Continue${road}`;
  if (type === 'roundabout') return `Take roundabout exit${road}`;
  return `Head toward destination${road}`;
}

/**
 * Generates an interpolated multi-segment road curve between origin and destination
 */
function generateCurvedRoadFallback(origin: [number, number], destination: [number, number]): RoadRoute {
  const segments = 24;
  const coords: [number, number][] = [];
  const latDelta = destination[0] - origin[0];
  const lngDelta = destination[1] - origin[1];

  // Introduce a slight orthogonal curve mimicking real street grids
  const orthoLat = -lngDelta * 0.15;
  const orthoLng = latDelta * 0.15;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const arc = Math.sin(t * Math.PI); // parabolic hump
    const lat = origin[0] + latDelta * t + orthoLat * arc;
    const lng = origin[1] + lngDelta * t + orthoLng * arc;
    coords.push([lat, lng]);
  }

  const distKm = Math.hypot(latDelta * 111, lngDelta * 102);
  return {
    coordinates: coords,
    distanceKm: Number(distKm.toFixed(2)),
    durationMinutes: Math.max(2, Math.round(distKm * 2.8)),
    summary: 'City Arterial Corridor',
    steps: [
      {
        instruction: 'Head forward on Municipal Road',
        name: 'Sector Main Arterial',
        distanceMeters: distKm * 500,
        durationSeconds: distKm * 80,
        maneuverType: 'depart',
        location: origin,
      },
      {
        instruction: 'Turn toward Collection Ward',
        name: 'Ward Access Way',
        distanceMeters: distKm * 500,
        durationSeconds: distKm * 80,
        maneuverType: 'turn',
        location: destination,
      },
    ],
    isFallback: true,
  };
}
