import { prisma } from '../lib/prisma.js';
import { emitTo, SOCKET_EVENTS } from '../sockets/realtime.js';
import { distanceKm, snapToPath } from '../lib/geo.js';
import { HttpError } from '../middleware/error.js';

/**
 * Live GPS ingest (plan §4.3).
 *
 * One path for every source — the driver app's socket emit and the REST
 * fallback both land here. On each ping we:
 *   (a) write history to vehicle_locations (replay, distance, future ETA models)
 *   (b) update the denormalised last-known position on vehicles
 *   (c) broadcast truck:update to the ward room, the city room and the truck room
 *
 * History writes are throttled: a ping every 3s per truck is plenty for replay,
 * and it keeps the table from exploding during a long demo.
 */

const HISTORY_MIN_INTERVAL_MS = 3000;
const HISTORY_MIN_DISTANCE_KM = 0.008; // 8 m
const lastWrite = new Map();

export async function ingestLocation({ vehicleId, driverId, latitude, longitude, heading, speed, accuracy, ts }) {
  const vehicle = await prisma.vehicle.findFirst({
    where: vehicleId ? { id: vehicleId } : { driverId },
    include: { ward: true },
  });
  if (!vehicle) throw new HttpError(404, 'No vehicle is assigned to this driver');

  // A driver may only move their own truck.
  if (driverId && vehicle.driverId && vehicle.driverId !== driverId) {
    throw new HttpError(403, 'This vehicle is assigned to a different driver');
  }

  const recordedAt = ts ? new Date(ts) : new Date();
  const previous = vehicle.lastLat != null ? { latitude: vehicle.lastLat, longitude: vehicle.lastLng } : null;
  const deltaKm = previous ? distanceKm(previous, { latitude, longitude }) : 0;

  const state = lastWrite.get(vehicle.id) || { at: 0 };
  const shouldPersist =
    recordedAt.getTime() - state.at > HISTORY_MIN_INTERVAL_MS && deltaKm >= HISTORY_MIN_DISTANCE_KM;

  if (shouldPersist) {
    lastWrite.set(vehicle.id, { at: recordedAt.getTime() });
    await prisma.vehicleLocation.create({
      data: { vehicleId: vehicle.id, latitude, longitude, heading, speed, accuracy, recordedAt },
    });
  }

  const updated = await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      lastLat: latitude,
      lastLng: longitude,
      lastHeading: heading ?? vehicle.lastHeading,
      lastSpeed: speed ?? vehicle.lastSpeed,
      lastPingAt: recordedAt,
      odometerKm: { increment: deltaKm },
      status: vehicle.status === 'OFFLINE' ? 'ON_ROUTE' : vehicle.status,
    },
  });

  const payload = serializeVehicle(updated, vehicle.ward);

  // Progress along the published route drives the traversed/remaining polyline.
  const route = await prisma.route.findFirst({
    where: { vehicleId: vehicle.id, date: today(), status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
    select: { id: true, polylineGeometry: true },
  });
  if (route?.polylineGeometry?.length > 1) {
    const snap = snapToPath({ latitude, longitude }, route.polylineGeometry);
    payload.routeProgress = {
      routeId: route.id,
      progressPct: snap.progressPct,
      offRouteMeters: Math.round(snap.offRouteMeters),
      index: snap.index,
    };
  }

  emitTo(
    [vehicle.wardId ? `ward:${vehicle.wardId}` : null, 'city', `truck:${vehicle.id}`],
    SOCKET_EVENTS.TRUCK_UPDATE,
    payload
  );

  return payload;
}

export function serializeVehicle(v, ward) {
  return {
    id: v.id,
    registrationNumber: v.registrationNumber,
    status: v.status,
    model: v.model,
    capacityKg: v.capacityKg,
    maintenanceFlag: v.maintenanceFlag,
    latitude: v.lastLat,
    longitude: v.lastLng,
    heading: v.lastHeading ?? 0,
    speed: v.lastSpeed ?? 0,
    lastPingAt: v.lastPingAt,
    wardId: v.wardId,
    ward: ward ? { id: ward.id, name: ward.name, code: ward.code } : undefined,
    driverId: v.driverId,
    driver: v.driver
      ? { id: v.driver.id, name: v.driver.name, phone: v.driver.phone }
      : undefined,
    odometerKm: Number((v.odometerKm || 0).toFixed(2)),
    online: v.lastPingAt ? Date.now() - new Date(v.lastPingAt).getTime() < 60_000 : false,
  };
}

/** Route replay + distance covered, straight from the ping history (§4.5). */
export async function locationHistory(vehicleId, { from, to, limit = 2000 } = {}) {
  const points = await prisma.vehicleLocation.findMany({
    where: {
      vehicleId,
      recordedAt: {
        gte: from ? new Date(from) : startOfToday(),
        ...(to ? { lte: new Date(to) } : {}),
      },
    },
    orderBy: { recordedAt: 'asc' },
    take: limit,
  });

  let km = 0;
  for (let i = 1; i < points.length; i += 1) km += distanceKm(points[i - 1], points[i]);

  return {
    vehicleId,
    points: points.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      heading: p.heading,
      speed: p.speed,
      recordedAt: p.recordedAt,
    })),
    distanceKm: Number(km.toFixed(2)),
    firstAt: points[0]?.recordedAt ?? null,
    lastAt: points[points.length - 1]?.recordedAt ?? null,
  };
}

export const today = () => new Date().toISOString().slice(0, 10);
export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default { ingestLocation, serializeVehicle, locationHistory, today, startOfToday };
