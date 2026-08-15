import axios from 'axios';
import env from '../config/env.js';
import { roadKm, distanceKm } from '../lib/geo.js';

/**
 * Route optimisation (plan §7 — "a solver, not a learned model").
 *
 * With ROUTING_SERVICE_URL set, OSRM/OR-Tools does the work. Without it, this
 * built-in solver runs nearest-neighbour → 2-opt → Or-opt, which is fast enough
 * to re-solve live in front of judges and good enough to show a real saving
 * against the baseline "visit them in the order they were reported" route.
 *
 * Output shape is what Leaflet needs directly: an ordered stop list plus a
 * [[lng,lat], ...] polyline.
 */

const DEFAULTS = {
  speedKmph: 20,
  serviceMin: 6,
  startTime: '07:00',
  kmPerLitre: 5.5,
  fuelCostPerLitre: 96,
  co2KgPerLitre: 2.68,
};

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
};
const fmt = (mins) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const r2 = (n) => Number(n.toFixed(2));

export async function optimizeRoute(payload) {
  const started = Date.now();

  if (env.routingServiceUrl) {
    try {
      const { data } = await axios.post(`${env.routingServiceUrl}/optimize`, payload, { timeout: 20000 });
      return { ...data, solver: data.solver || 'osrm+ortools', solveMs: Date.now() - started };
    } catch (err) {
      console.warn('[routing] external solver unavailable, using built-in:', err.message);
    }
  }

  return { ...solveLocal(payload), solveMs: Date.now() - started };
}

export function solveLocal({ stops = [], depot, options = {} } = {}) {
  const opts = { ...DEFAULTS, ...options };
  const origin = depot?.coordinates || (stops[0] ? [stops[0].longitude, stops[0].latitude] : [0, 0]);

  const points = stops.map((s, i) => ({
    ...s,
    order: i,
    coordinates: s.coordinates || [s.longitude, s.latitude],
    serviceMin: s.serviceMin ?? opts.serviceMin,
  }));

  if (!points.length) {
    return {
      solver: 'safaai-node-2opt',
      stops: [],
      polyline: [],
      distanceKm: 0,
      baselineKm: 0,
      savedKm: 0,
      savedPct: 0,
      durationMin: 0,
      fuelSaved: 0,
      co2SavedKg: 0,
      options: opts,
    };
  }

  // Baseline: serve complaints in the order they were reported.
  const baselineKm = tourKm(origin, points);

  let order = nearestNeighbour(origin, points);
  order = twoOpt(origin, order);
  order = orOpt(origin, order);

  const distance = tourKm(origin, order);

  let clock = toMin(opts.startTime);
  const scheduled = order.map((stop, i) => {
    const from = i === 0 ? origin : order[i - 1].coordinates;
    const travelMin = (roadKm(from, stop.coordinates) / opts.speedKmph) * 60;
    clock += travelMin;
    const arrival = clock;
    clock += stop.serviceMin;

    return {
      seq: i + 1,
      complaintId: stop.complaintId ?? stop.id ?? null,
      code: stop.code ?? null,
      label: stop.label || stop.address || `Stop ${i + 1}`,
      category: stop.category ?? null,
      severity: stop.severity ?? null,
      isEmergency: Boolean(stop.isEmergency),
      latitude: stop.coordinates[1],
      longitude: stop.coordinates[0],
      serviceMin: stop.serviceMin,
      etaMin: Math.round(arrival - toMin(opts.startTime)),
      eta: fmt(arrival),
      status: 'PENDING',
      legKm: r2(roadKm(from, stop.coordinates)),
    };
  });

  const returnMin = (roadKm(order[order.length - 1].coordinates, origin) / opts.speedKmph) * 60;
  const durationMin = Math.round(clock + returnMin - toMin(opts.startTime));

  const litresSaved = (baselineKm - distance) / opts.kmPerLitre;

  return {
    solver: 'safaai-node-2opt',
    stops: scheduled,
    polyline: [origin, ...order.map((s) => s.coordinates), origin],
    distanceKm: r2(distance),
    baselineKm: r2(baselineKm),
    savedKm: r2(baselineKm - distance),
    savedPct: baselineKm ? r2(((baselineKm - distance) / baselineKm) * 100) : 0,
    durationMin,
    endsAt: fmt(toMin(opts.startTime) + durationMin),
    fuelSaved: r2(litresSaved * opts.fuelCostPerLitre),
    litresSaved: r2(litresSaved),
    co2SavedKg: r2(litresSaved * opts.co2KgPerLitre),
    options: opts,
  };
}

function tourKm(origin, order) {
  if (!order.length) return 0;
  let km = roadKm(origin, order[0].coordinates);
  for (let i = 1; i < order.length; i += 1) km += roadKm(order[i - 1].coordinates, order[i].coordinates);
  return km + roadKm(order[order.length - 1].coordinates, origin);
}

/**
 * Emergencies are pulled to the front regardless of geography — a dead animal
 * report does not wait because it is on the far side of the ward.
 */
function nearestNeighbour(origin, stops) {
  const urgent = stops.filter((s) => s.isEmergency);
  const normal = stops.filter((s) => !s.isEmergency);

  const walk = (pool, from) => {
    const remaining = [...pool];
    const out = [];
    let current = from;
    while (remaining.length) {
      let best = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < remaining.length; i += 1) {
        const d = roadKm(current, remaining[i].coordinates);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      }
      const [next] = remaining.splice(best, 1);
      out.push(next);
      current = next.coordinates;
    }
    return out;
  };

  const urgentOrder = walk(urgent, origin);
  const start = urgentOrder.length ? urgentOrder[urgentOrder.length - 1].coordinates : origin;
  return [...urgentOrder, ...walk(normal, start)];
}

/** 2-opt over the non-emergency tail so urgent stops keep their priority. */
function twoOpt(origin, order) {
  const lockedCount = order.filter((s) => s.isEmergency).length;
  if (order.length - lockedCount < 4) return order;

  const head = order.slice(0, lockedCount);
  let tail = order.slice(lockedCount);
  const anchor = head.length ? head[head.length - 1].coordinates : origin;
  const cost = (r) => tourKm(anchor, r);

  let best = cost(tail);
  let improved = true;
  let guard = 0;

  while (improved && guard < 60) {
    improved = false;
    guard += 1;
    for (let i = 0; i < tail.length - 1; i += 1) {
      for (let k = i + 1; k < tail.length; k += 1) {
        const candidate = [...tail.slice(0, i), ...tail.slice(i, k + 1).reverse(), ...tail.slice(k + 1)];
        const c = cost(candidate);
        if (c + 1e-9 < best) {
          tail = candidate;
          best = c;
          improved = true;
        }
      }
    }
  }
  return [...head, ...tail];
}

/** Or-opt relocation — cleans up the detours 2-opt leaves behind. */
function orOpt(origin, order) {
  const lockedCount = order.filter((s) => s.isEmergency).length;
  if (order.length - lockedCount < 4) return order;

  const head = order.slice(0, lockedCount);
  let tail = order.slice(lockedCount);
  const anchor = head.length ? head[head.length - 1].coordinates : origin;
  const cost = (r) => tourKm(anchor, r);

  let best = cost(tail);
  let improved = true;
  let guard = 0;

  while (improved && guard < 40) {
    improved = false;
    guard += 1;
    for (let i = 0; i < tail.length; i += 1) {
      for (let j = 0; j < tail.length; j += 1) {
        if (i === j) continue;
        const candidate = [...tail];
        const [moved] = candidate.splice(i, 1);
        candidate.splice(j, 0, moved);
        const c = cost(candidate);
        if (c + 1e-9 < best) {
          tail = candidate;
          best = c;
          improved = true;
        }
      }
    }
  }
  return [...head, ...tail];
}

/**
 * Straight-line legs are fine for the solver, but the drawn polyline should
 * look like driving. Without OSRM we insert an L-shaped waypoint per leg, which
 * reads as street movement instead of a diagonal across buildings.
 */
export function drivablePolyline(points) {
  const out = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    if (i === 0) out.push([ax, ay]);
    // Alternate the corner so consecutive legs do not all bend the same way.
    out.push(i % 2 === 0 ? [bx, ay] : [ax, by]);
    out.push([bx, by]);
  }
  return out;
}

export { DEFAULTS, distanceKm };
export default { optimizeRoute, solveLocal, drivablePolyline };
