import { prisma } from '../lib/prisma.js';
import env from '../config/env.js';
import { ingestLocation, today } from './tracking.service.js';
import { distanceKm, lerpPoint, bearing } from '../lib/geo.js';

/**
 * Demo vehicle movement.
 *
 * It drives seeded trucks along their published polyline and pushes every
 * position through `ingestLocation` — the same function a real driver handset
 * hits. Nothing about the architecture is shortcut for the demo; turn it off
 * with SIMULATOR_ENABLED=false and real devices take over unchanged.
 */

const SPEED_KMPH = 24;

const state = {
  running: false,
  timer: null,
  ticks: 0,
  trucks: new Map(),
};

export function simulatorStatus() {
  return {
    enabled: env.simulator.enabled,
    running: state.running,
    intervalMs: env.simulator.intervalMs,
    trucks: state.trucks.size,
    ticks: state.ticks,
  };
}

export async function startSimulator() {
  if (!env.simulator.enabled || state.running) return simulatorStatus();

  await loadTrucks();
  if (!state.trucks.size) {
    console.log('[sim] no published routes for today — simulator idle (run `npm run seed`)');
    return simulatorStatus();
  }

  state.running = true;
  state.timer = setInterval(() => {
    tick().catch((err) => console.error('[sim]', err.message));
  }, env.simulator.intervalMs);
  state.timer.unref?.();
  console.log(`[sim] driving ${state.trucks.size} trucks every ${env.simulator.intervalMs}ms`);
  return simulatorStatus();
}

export function stopSimulator() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  state.running = false;
  return simulatorStatus();
}

async function loadTrucks() {
  const routes = await prisma.route.findMany({
    where: { date: today(), status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
    include: { vehicle: true },
  });

  for (const route of routes) {
    const path = route.polylineGeometry;
    if (!Array.isArray(path) || path.length < 2) continue;
    if (route.vehicle?.maintenanceFlag) continue;

    state.trucks.set(route.vehicleId, {
      vehicleId: route.vehicleId,
      driverId: route.driverId,
      path,
      leg: 0,
      progress: 0,
      pausedUntil: 0,
    });
  }
}

async function tick() {
  state.ticks += 1;
  const hours = env.simulator.intervalMs / 3_600_000;
  const stepKm = SPEED_KMPH * hours;

  for (const truck of state.trucks.values()) {
    if (state.ticks < truck.pausedUntil) continue;

    const moved = advance(truck, stepKm);
    if (!moved) {
      // Reached the depot — idle briefly, then run the beat again so a long
      // demo never goes static.
      truck.leg = 0;
      truck.progress = 0;
      truck.pausedUntil = state.ticks + 5;
      continue;
    }

    await ingestLocation({
      vehicleId: truck.vehicleId,
      latitude: moved.position[1],
      longitude: moved.position[0],
      heading: moved.heading,
      speed: SPEED_KMPH,
    });
  }
}

/** Walk the polyline by `km`, returning the interpolated position and heading. */
function advance(truck, km) {
  let remaining = km;

  while (remaining > 0) {
    const a = truck.path[truck.leg];
    const b = truck.path[truck.leg + 1];
    if (!b) return null;

    const legKm = Math.max(distanceKm(a, b), 1e-6);
    const leftOnLeg = legKm * (1 - truck.progress);

    if (remaining < leftOnLeg) {
      truck.progress += remaining / legKm;
      remaining = 0;
    } else {
      remaining -= leftOnLeg;
      truck.leg += 1;
      truck.progress = 0;
      if (!truck.path[truck.leg + 1]) {
        return { position: truck.path[truck.leg], heading: bearing(a, b) };
      }
    }
  }

  const a = truck.path[truck.leg];
  const b = truck.path[truck.leg + 1] || a;
  return { position: lerpPoint(a, b, truck.progress), heading: bearing(a, b) };
}

export default { startSimulator, stopSimulator, simulatorStatus };
