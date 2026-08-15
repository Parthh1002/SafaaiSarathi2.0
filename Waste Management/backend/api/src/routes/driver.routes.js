import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requirePortal, loadUser } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { upload, persist, fileFromRequest } from '../middleware/upload.js';
import { prisma } from '../lib/prisma.js';
import { PORTALS, SOCKET_EVENTS } from '../config/constants.js';
import { ingestLocation, serializeVehicle, locationHistory, today, startOfToday } from '../services/tracking.service.js';
import { transition, serializeComplaint } from '../services/complaint.service.js';
import { emitTo } from '../sockets/realtime.js';
import { notifyWardOfficers } from '../services/notification.service.js';
import { distanceKm } from '../lib/geo.js';

const router = Router();
router.use(requirePortal(PORTALS.DRIVER), loadUser);

async function myVehicle(userId) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { driverId: userId },
    include: { ward: true, driver: { select: { id: true, name: true, phone: true } } },
  });
  if (!vehicle) throw new HttpError(404, 'No vehicle is assigned to your account. Contact your ward officer.');
  return vehicle;
}

/** Today's route: stop sequence, polyline, assigned complaints, shift totals. */
router.get(
  '/shift',
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);

    const [route, assigned, resolvedToday, history] = await Promise.all([
      prisma.route.findFirst({ where: { vehicleId: vehicle.id, date: today() } }),
      prisma.complaint.findMany({
        where: { assignedVehicleId: vehicle.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        include: { ward: true },
        orderBy: [{ isEmergency: 'desc' }, { severity: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.complaint.count({
        where: { assignedVehicleId: vehicle.id, status: 'RESOLVED', resolvedAt: { gte: startOfToday() } },
      }),
      locationHistory(vehicle.id, {}),
    ]);

    const stops = route?.orderedStops ?? [];

    res.json({
      vehicle: serializeVehicle(vehicle, vehicle.ward),
      route: route
        ? {
            id: route.id,
            label: route.label,
            status: route.status,
            stops,
            polyline: route.polylineGeometry,
            distanceKm: route.distanceKm,
            baselineKm: route.baselineKm,
            savedKm: route.savedKm,
            durationMin: route.durationMin,
            done: stops.filter((s) => s.status === 'DONE').length,
            total: stops.length,
            solver: route.solver,
          }
        : null,
      nextStop: stops.find((s) => s.status !== 'DONE') ?? null,
      assignedComplaints: assigned.map((c) => serializeComplaint(c)),
      summary: {
        stopsDone: stops.filter((s) => s.status === 'DONE').length,
        stopsTotal: stops.length,
        resolvedToday,
        distanceKm: history.distanceKm,
        onShiftSince: history.firstAt,
      },
    });
  })
);

/**
 * GPS ingest over REST. The native app uses the socket channel; this exists so
 * the browser build and any offline queue replay share the same write path.
 */
router.post(
  '/location',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        heading: z.number().optional(),
        speed: z.number().optional(),
        accuracy: z.number().optional(),
        ts: z.union([z.string(), z.number()]).optional(),
      })
      .parse(req.body);

    const payload = await ingestLocation({ ...body, driverId: req.user.id });
    res.status(201).json(payload);
  })
);

/** Offline queue replay — the app posts everything it buffered while offline. */
router.post(
  '/location/batch',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        points: z
          .array(
            z.object({
              latitude: z.number(),
              longitude: z.number(),
              heading: z.number().optional(),
              speed: z.number().optional(),
              ts: z.union([z.string(), z.number()]).optional(),
            })
          )
          .max(500),
      })
      .parse(req.body);

    let accepted = 0;
    for (const point of body.points) {
      await ingestLocation({ ...point, driverId: req.user.id });
      accepted += 1;
    }
    res.json({ accepted });
  })
);

router.post(
  '/status',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(['IDLE', 'ON_ROUTE', 'OFFLINE', 'MAINTENANCE']) })
      .parse(req.body);

    const vehicle = await myVehicle(req.user.id);
    const updated = await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status } });

    emitTo([vehicle.wardId ? `ward:${vehicle.wardId}` : null, 'city'], SOCKET_EVENTS.TRUCK_UPDATE, serializeVehicle(updated, vehicle.ward));
    res.json(serializeVehicle(updated, vehicle.ward));
  })
);

/** Start work on a stop — moves the citizen's timeline to "In progress". */
router.post(
  '/complaints/:id/start',
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const complaint = await prisma.complaint.findFirst({
      where: { id: req.params.id, assignedVehicleId: vehicle.id },
    });
    if (!complaint) throw new HttpError(404, 'That complaint is not assigned to your vehicle');

    res.json(await transition({ complaintId: complaint.id, status: 'IN_PROGRESS', actorId: req.user.id, note: 'Crew is on site' }));
  })
);

/** Mark resolved — photo proof is mandatory (plan §2.2). */
router.post(
  '/complaints/:id/resolve',
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const complaint = await prisma.complaint.findFirst({
      where: { id: req.params.id, assignedVehicleId: vehicle.id },
    });
    if (!complaint) throw new HttpError(404, 'That complaint is not assigned to your vehicle');

    const file = fileFromRequest(req);
    if (!file) throw new HttpError(400, 'A resolution photo is required to close a complaint');

    const resolutionPhotoUrl = persist(file.buffer, file.mimetype, 'resolution');
    const note = req.body?.note?.slice(0, 500);

    const payload = await transition({
      complaintId: complaint.id,
      status: 'RESOLVED',
      actorId: req.user.id,
      note: note || 'Cleared by crew, photo proof attached',
      extra: { resolutionPhotoUrl, resolutionNote: note },
    });

    // Keep the route's stop list in step with the complaint.
    const route = await prisma.route.findFirst({ where: { vehicleId: vehicle.id, date: today() } });
    if (route) {
      const stops = (route.orderedStops || []).map((s) =>
        s.complaintId === complaint.id ? { ...s, status: 'DONE', doneAt: new Date().toISOString() } : s
      );
      const done = stops.filter((s) => s.status === 'DONE').length;
      await prisma.route.update({
        where: { id: route.id },
        data: {
          orderedStops: stops,
          status: done === stops.length ? 'COMPLETED' : 'IN_PROGRESS',
          ...(done === stops.length ? { completedAt: new Date() } : {}),
        },
      });
    }

    res.json(payload);
  })
);

router.post(
  '/stops/:seq/skip',
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const route = await prisma.route.findFirst({ where: { vehicleId: vehicle.id, date: today() } });
    if (!route) throw new HttpError(404, 'No route published for today');

    const seq = Number(req.params.seq);
    const reason = req.body?.reason?.slice(0, 200) || 'Skipped by driver';
    const stops = (route.orderedStops || []).map((s) => (s.seq === seq ? { ...s, status: 'SKIPPED', reason } : s));

    await prisma.route.update({ where: { id: route.id }, data: { orderedStops: stops } });
    res.json({ seq, status: 'SKIPPED', reason });
  })
);

/** SOS — alerts every officer on the ward plus admins, with live location. */
router.post(
  '/sos',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        message: z.string().max(300).optional(),
      })
      .parse(req.body);

    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id }, include: { ward: true } });

    const alert = await prisma.sosAlert.create({
      data: {
        driverId: req.user.id,
        vehicleId: vehicle?.id,
        latitude: body.latitude,
        longitude: body.longitude,
        message: body.message,
      },
    });

    const payload = {
      id: alert.id,
      driver: { id: req.user.id, name: req.user.name, phone: req.user.phone },
      vehicle: vehicle ? { id: vehicle.id, registrationNumber: vehicle.registrationNumber } : null,
      latitude: alert.latitude,
      longitude: alert.longitude,
      message: alert.message,
      status: alert.status,
      createdAt: alert.createdAt,
    };

    emitTo([vehicle?.wardId ? `ward:${vehicle.wardId}` : null, 'city'], SOCKET_EVENTS.SOS_NEW, payload);
    if (vehicle?.wardId) {
      await notifyWardOfficers(vehicle.wardId, {
        type: 'EMERGENCY',
        title: `SOS from ${req.user.name}`,
        body: body.message || 'Driver triggered an SOS alert.',
        payload: { sosId: alert.id, latitude: alert.latitude, longitude: alert.longitude },
      });
    }

    res.status(201).json(payload);
  })
);

/** Shift summary — stops completed, distance covered, time on route. */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const [history, resolved, route] = await Promise.all([
      locationHistory(vehicle.id, {}),
      prisma.complaint.findMany({
        where: { assignedVehicleId: vehicle.id, status: 'RESOLVED', resolvedAt: { gte: startOfToday() } },
        select: { code: true, category: true, resolvedAt: true, createdAt: true },
        orderBy: { resolvedAt: 'desc' },
      }),
      prisma.route.findFirst({ where: { vehicleId: vehicle.id, date: today() } }),
    ]);

    const stops = route?.orderedStops ?? [];
    const minutesOnRoute = history.firstAt
      ? Math.round((new Date(history.lastAt) - new Date(history.firstAt)) / 60_000)
      : 0;

    res.json({
      date: today(),
      vehicle: { id: vehicle.id, registrationNumber: vehicle.registrationNumber },
      stopsDone: stops.filter((s) => s.status === 'DONE').length,
      stopsTotal: stops.length,
      skipped: stops.filter((s) => s.status === 'SKIPPED').length,
      resolved: resolved.length,
      distanceKm: history.distanceKm,
      plannedKm: route?.distanceKm ?? 0,
      minutesOnRoute,
      resolvedList: resolved,
      trail: history.points,
    });
  })
);

/** Turn-by-turn helper: distance to the next stop from the current position. */
router.get(
  '/next-stop',
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const route = await prisma.route.findFirst({ where: { vehicleId: vehicle.id, date: today() } });
    const next = (route?.orderedStops ?? []).find((s) => s.status !== 'DONE');
    if (!next) return res.json({ done: true });

    const from = { latitude: vehicle.lastLat, longitude: vehicle.lastLng };
    const km = vehicle.lastLat != null ? distanceKm(from, next) : null;

    return res.json({
      done: false,
      stop: next,
      distanceKm: km != null ? Number(km.toFixed(2)) : null,
      etaMinutes: km != null ? Math.max(1, Math.round((km / 20) * 60)) : null,
    });
  })
);

export default router;
