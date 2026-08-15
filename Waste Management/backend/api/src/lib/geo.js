/**
 * Geo maths in application code.
 *
 * PostGIS is unavailable on this deployment, so every spatial operation the
 * plan asks for lives here instead:
 *
 *   ST_DWithin(a, b, 30)        -> withinMeters(a, b, 30)
 *   ST_Contains(ward, point)    -> pointInPolygon(point, ward.boundary)
 *   ORDER BY location <-> point -> nearestBy(point, rows, accessor)
 *
 * Queries stay indexed by pre-filtering on a bounding box in SQL (cheap,
 * B-tree) and then running the exact test here on the small candidate set —
 * the same two-phase strategy a GiST index uses internally.
 */

const EARTH_RADIUS_M = 6_371_000;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Great-circle distance in metres. Points are {latitude, longitude} or [lng, lat]. */
export function distanceMeters(a, b) {
  const [lat1, lng1] = normalise(a);
  const [lat2, lng2] = normalise(b);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const distanceKm = (a, b) => distanceMeters(a, b) / 1000;
export const withinMeters = (a, b, metres) => distanceMeters(a, b) <= metres;

function normalise(p) {
  if (Array.isArray(p)) return [p[1], p[0]]; // [lng, lat] -> [lat, lng]
  return [Number(p.latitude ?? p.lat), Number(p.longitude ?? p.lng)];
}

/**
 * Road-distance approximation for routing. Straight-line distance understates
 * urban travel; 1.32 is the usual detour factor for Indian city grids. Swap for
 * an OSRM table request when ROUTING_SERVICE_URL is configured.
 */
export const ROAD_FACTOR = 1.32;
export const roadKm = (a, b) => distanceKm(a, b) * ROAD_FACTOR;

/** Initial bearing a -> b in degrees, used to rotate the truck icon. */
export function bearing(a, b) {
  const [lat1, lng1] = normalise(a);
  const [lat2, lng2] = normalise(b);
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Ray-casting point-in-polygon over a GeoJSON ring of [lng, lat] pairs. */
export function pointInRing(point, ring) {
  const [lat, lng] = normalise(point);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Handles a GeoJSON Polygon (outer ring plus holes). */
export function pointInPolygon(point, polygon) {
  const rings = polygon?.coordinates;
  if (!Array.isArray(rings) || !rings.length) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (pointInRing(point, rings[i])) return false; // inside a hole
  }
  return true;
}

/** Bounding box of a GeoJSON polygon — persisted on wards as a SQL pre-filter. */
export function polygonBBox(polygon) {
  const ring = polygon?.coordinates?.[0] || [];
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  for (const [lng, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function polygonCentroid(polygon) {
  const ring = (polygon?.coordinates?.[0] || []).slice(0, -1);
  if (!ring.length) return { latitude: 0, longitude: 0 };
  const sum = ring.reduce((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0]);
  return { longitude: sum[0] / ring.length, latitude: sum[1] / ring.length };
}

/**
 * Degrees of latitude/longitude covering `metres` at this latitude — used to
 * build the SQL bounding-box pre-filter before the exact distance test.
 */
export function boundsAround(point, metres) {
  const [lat, lng] = normalise(point);
  const dLat = (metres / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(0.01, Math.cos(toRad(lat)));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

/** Nearest row to a point. Replaces the PostGIS `<->` KNN operator. */
export function nearestBy(point, rows, accessor = (r) => r) {
  let best = null;
  let bestDistance = Infinity;
  for (const row of rows) {
    const target = accessor(row);
    if (target?.latitude == null && !Array.isArray(target)) continue;
    const d = distanceMeters(point, target);
    if (d < bestDistance) {
      bestDistance = d;
      best = row;
    }
  }
  return best ? { row: best, distanceMeters: bestDistance } : null;
}

/** Total length in km of a [[lng, lat], ...] polyline. */
export function pathLengthKm(path) {
  let km = 0;
  for (let i = 1; i < path.length; i += 1) km += distanceKm(path[i - 1], path[i]);
  return km;
}

export function lerpPoint(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Snap a live position onto a route polyline and return how far along it is.
 * Drives the "traversed vs remaining" colouring on the driver map (plan §4.4).
 */
export function snapToPath(point, path) {
  const [lat, lng] = normalise(point);
  let bestIndex = 0;
  let bestT = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < path.length - 1; i += 1) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq ? Math.max(0, Math.min(1, ((lng - ax) * dx + (lat - ay) * dy) / lenSq)) : 0;
    const projection = [ax + dx * t, ay + dy * t];
    const d = distanceMeters({ latitude: lat, longitude: lng }, projection);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
      bestT = t;
    }
  }

  const traversed = path.slice(0, bestIndex + 1);
  const [ax, ay] = path[bestIndex] || [lng, lat];
  const [bx, by] = path[bestIndex + 1] || [lng, lat];
  const snapped = [ax + (bx - ax) * bestT, ay + (by - ay) * bestT];

  return {
    index: bestIndex,
    t: bestT,
    snapped,
    offRouteMeters: bestDistance,
    traversed: [...traversed, snapped],
    remaining: [snapped, ...path.slice(bestIndex + 1)],
    progressPct: path.length > 1 ? Math.round(((bestIndex + bestT) / (path.length - 1)) * 100) : 0,
  };
}

export default {
  distanceMeters,
  distanceKm,
  withinMeters,
  roadKm,
  bearing,
  pointInPolygon,
  pointInRing,
  polygonBBox,
  polygonCentroid,
  boundsAround,
  nearestBy,
  pathLengthKm,
  snapToPath,
  lerpPoint,
  ROAD_FACTOR,
};
