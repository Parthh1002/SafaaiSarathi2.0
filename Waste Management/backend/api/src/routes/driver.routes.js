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

/** 
 * FEATURE 1: Live Route Map / Navigation
 * GET /api/driver/route & GET /api/driver/shift
 */
router.get(
  ['/route', '/shift'],
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
      stops: stops.map((s, idx) => ({
        seq: s.seq || idx + 1,
        complaintId: s.complaintId || s.id,
        category: s.category || 'GARBAGE_PILE',
        address: s.address || 'Reported Location',
        latitude: s.latitude,
        longitude: s.longitude,
        status: s.status || 'PENDING',
        isEmergency: s.isEmergency || false,
      })),
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
 * FEATURE 2: Collection Stops (Tasks)
 * GET /api/driver/tasks?status=
 */
router.get(
  '/tasks',
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const statusQuery = req.query.status ? String(req.query.status).toUpperCase() : 'ALL';

    let statusFilter = { in: ['ASSIGNED', 'IN_PROGRESS'] };
    if (statusQuery === 'COMPLETED') {
      statusFilter = 'RESOLVED';
    } else if (statusQuery === 'PENDING') {
      statusFilter = 'ASSIGNED';
    } else if (statusQuery === 'IN_PROGRESS') {
      statusFilter = 'IN_PROGRESS';
    } else if (statusQuery === 'ALL') {
      statusFilter = { in: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'] };
    }

    const complaints = await prisma.complaint.findMany({
      where: {
        assignedVehicleId: vehicle.id,
        status: statusFilter,
        ...(statusQuery === 'COMPLETED' ? { resolvedAt: { gte: startOfToday() } } : {}),
      },
      include: { ward: true },
      orderBy: [{ isEmergency: 'desc' }, { severity: 'desc' }, { createdAt: 'desc' }],
    });

    const from = { latitude: vehicle.lastLat, longitude: vehicle.lastLng };
    const tasks = complaints.map((c) => {
      const dist = (vehicle.lastLat != null && c.latitude != null) ? distanceKm(from, c) : null;
      return {
        ...serializeComplaint(c),
        distanceKm: dist != null ? Number(dist.toFixed(2)) : null,
      };
    });

    res.json({ tasks, vehicleId: vehicle.id, total: tasks.length });
  })
);

/**
 * Start task
 * POST /api/driver/tasks/:id/start and POST /api/driver/complaints/:id/start
 */
router.post(
  ['/tasks/:id/start', '/complaints/:id/start'],
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const complaint = await prisma.complaint.findFirst({
      where: { id: req.params.id, assignedVehicleId: vehicle.id },
    });
    if (!complaint) throw new HttpError(404, 'That complaint is not assigned to your vehicle');

    const result = await transition({
      complaintId: complaint.id,
      status: 'IN_PROGRESS',
      actorId: req.user.id,
      note: 'Driver is on site and collection has started',
    });

    res.json(result);
  })
);

/**
 * FEATURE 3: Proof of Work (Clean Photo Upload & Task Resolution)
 * POST /api/driver/tasks/:id/complete and POST /api/driver/complaints/:id/resolve
 */
router.post(
  ['/tasks/:id/complete', '/complaints/:id/resolve'],
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const complaint = await prisma.complaint.findFirst({
      where: { id: req.params.id, assignedVehicleId: vehicle.id },
    });
    if (!complaint) throw new HttpError(404, 'That complaint is not assigned to your vehicle');

    let resolutionPhotoUrl = req.body?.cleanPhotoUrl || req.body?.photoUrl;

    const file = fileFromRequest(req);
    if (file) {
      resolutionPhotoUrl = await persist(file.buffer, file.mimetype, 'resolution');
    }

    if (!resolutionPhotoUrl) {
      throw new HttpError(400, 'A clean-up proof photo is strictly required to mark this task complete');
    }

    const note = req.body?.note?.slice(0, 500) || 'Waste collected and area cleared by driver';

    const payload = await transition({
      complaintId: complaint.id,
      status: 'RESOLVED',
      actorId: req.user.id,
      note,
      extra: { resolutionPhotoUrl, resolutionNote: note },
    });

    // Update the daily route ordered stops in sync
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

    // Broadcast resolution to Officer and Citizen tracking
    emitTo([`truck:${vehicle.id}`, vehicle.wardId ? `ward:${vehicle.wardId}` : null, 'city'], SOCKET_EVENTS.COMPLAINT_UPDATE, payload);

    res.json({ success: true, complaint: payload });
  })
);

/**
 * FEATURE 4: Fuel Consumption Tracker
 * POST /api/driver/fuel-log & GET /api/driver/fuel-log
 */
router.post(
  '/fuel-log',
  writeLimiter,
  upload.single('receipt'),
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const body = z
      .object({
        liters: z.coerce.number().positive().optional(),
        odometerKm: z.coerce.number().positive().optional(),
        cost: z.coerce.number().positive().optional(),
        notes: z.string().max(300).optional(),
      })
      .parse(req.body);

    const file = fileFromRequest(req, 'receipt');
    let receiptUrl = null;
    if (file) {
      receiptUrl = await persist(file.buffer, file.mimetype, 'fuel-receipt');
    }

    // Update vehicle odometer if higher
    if (body.odometerKm && body.odometerKm > vehicle.odometerKm) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { odometerKm: body.odometerKm },
      });
    }

    let fuelLog;
    try {
      fuelLog = await prisma.fuelLog.create({
        data: {
          driverId: req.user.id,
          vehicleId: vehicle.id,
          liters: body.liters,
          odometerKm: body.odometerKm,
          cost: body.cost,
          notes: body.notes,
          receiptUrl,
        },
      });
    } catch {
      // Fallback if table creation pending migration
      fuelLog = {
        id: `fuel-${Date.now()}`,
        driverId: req.user.id,
        vehicleId: vehicle.id,
        liters: body.liters,
        odometerKm: body.odometerKm,
        cost: body.cost,
        notes: body.notes,
        loggedAt: new Date().toISOString(),
      };
    }

    res.status(201).json({ success: true, log: fuelLog });
  })
);

router.get(
  '/fuel-log',
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    let logs = [];
    try {
      logs = await prisma.fuelLog.findMany({
        where: { driverId: req.user.id },
        orderBy: { loggedAt: 'desc' },
        take: 30,
      });
    } catch {
      logs = [];
    }

    res.json({ logs, vehicleId: vehicle.id, registrationNumber: vehicle.registrationNumber });
  })
);

/**
 * FEATURE 5: Driver SOS
 * POST /api/driver/sos
 */
router.post(
  '/sos',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        reason: z.string().optional(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        message: z.string().max(300).optional(),
      })
      .parse(req.body);

    const vehicle = await prisma.vehicle.findFirst({ where: { driverId: req.user.id }, include: { ward: true } });

    const fullMessage = [body.reason, body.message].filter(Boolean).join(' — ') || 'Driver triggered SOS';

    const alert = await prisma.sosAlert.create({
      data: {
        driverId: req.user.id,
        vehicleId: vehicle?.id,
        latitude: body.latitude,
        longitude: body.longitude,
        message: fullMessage,
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
        title: `🚨 EMERGENCY SOS from Driver ${req.user.name}`,
        body: fullMessage,
        payload: { sosId: alert.id, latitude: alert.latitude, longitude: alert.longitude },
      });
    }

    res.status(201).json({ success: true, confirmed: true, alert: payload });
  })
);

/**
 * FEATURE 6: End of Shift Summary
 * GET /api/driver/shift-summary & GET /api/driver/summary
 */
router.get(
  ['/shift-summary', '/summary'],
  asyncHandler(async (req, res) => {
    const vehicle = await myVehicle(req.user.id);
    const dateQuery = req.query.date ? String(req.query.date) : today();

    const [history, resolved, route] = await Promise.all([
      locationHistory(vehicle.id, {}),
      prisma.complaint.findMany({
        where: { assignedVehicleId: vehicle.id, status: 'RESOLVED', resolvedAt: { gte: startOfToday() } },
        select: { id: true, code: true, category: true, resolvedAt: true, createdAt: true, address: true },
        orderBy: { resolvedAt: 'desc' },
      }),
      prisma.route.findFirst({ where: { vehicleId: vehicle.id, date: dateQuery } }),
    ]);

    let fuelLoggedToday = 0;
    try {
      const fuelRecords = await prisma.fuelLog.findMany({
        where: { driverId: req.user.id, loggedAt: { gte: startOfToday() } },
      });
      fuelLoggedToday = fuelRecords.reduce((sum, r) => sum + (r.liters || 0), 0);
    } catch {
      fuelLoggedToday = 0;
    }

    const stops = route?.orderedStops ?? [];
    const minutesOnRoute = history.firstAt
      ? Math.round((new Date(history.lastAt) - new Date(history.firstAt)) / 60_000)
      : 0;

    res.json({
      date: dateQuery,
      vehicle: { id: vehicle.id, registrationNumber: vehicle.registrationNumber },
      stopsDone: stops.filter((s) => s.status === 'DONE').length,
      stopsTotal: stops.length,
      skipped: stops.filter((s) => s.status === 'SKIPPED').length,
      resolved: resolved.length,
      distanceKm: history.distanceKm,
      plannedKm: route?.distanceKm ?? 0,
      fuelLiters: fuelLoggedToday,
      minutesOnRoute,
      resolvedList: resolved,
      trail: history.points,
    });
  })
);

/**
 * FEATURE 7: Live Location Telemetry Broadcast
 * POST /api/driver/location & POST /api/driver/location/batch
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

// ------------------------------------------------ Scheduled Task Operations ----

/** GET /api/driver/scheduled-tasks — List scheduled tasks assigned to this driver */
router.get(
  '/scheduled-tasks',
  asyncHandler(async (req, res) => {
    const tasks = await prisma.scheduledPickupRequest.findMany({
      where: {
        assignedDriverId: req.user.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      include: {
        citizen: { select: { id: true, name: true, phone: true } },
        ward: { select: { id: true, name: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    });
    res.json({ items: tasks });
  })
);

/** POST /api/driver/scheduled-tasks/:id/complete — Complete scheduled task with photo proof */
router.post(
  '/scheduled-tasks/:id/complete',
  writeLimiter,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const task = await prisma.scheduledPickupRequest.findFirst({
      where: { id: req.params.id, assignedDriverId: req.user.id },
      include: { citizen: true },
    });
    if (!task) throw new HttpError(404, 'Scheduled task not found or not assigned to you');

    let completionPhotoUrl = null;
    const file = fileFromRequest(req, 'photo');
    if (file) {
      const persisted = await persist(file, 'proofs');
      completionPhotoUrl = persisted.url;
    }

    const updated = await prisma.scheduledPickupRequest.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completionPhotoUrl,
        completionNotes: req.body?.notes?.slice(0, 300) || 'Pickup completed successfully.',
      },
    });

    // 1. Award Green Credits to citizen wallet (+25 credits)
    await awardCredits({
      userId: task.citizenId,
      delta: 25,
      reason: `Event Scheduled Pickup Completed (${task.code})`,
      reasonCode: 'CLEANUP_VERIFIED',
    });

    // 2. Notify Citizen
    await notify({
      userId: task.citizenId,
      type: 'CREDIT_AWARDED',
      title: `Scheduled Pickup Completed! +25 Credits`,
      body: `Your scheduled pickup for "${task.eventReason}" has been completed by driver ${req.user.name}. +25 Green Credits added to your wallet!`,
      payload: { requestId: task.id, code: task.code, credits: 25 },
    });

    res.json({ ok: true, status: 'COMPLETED', item: updated });
  })
);

export default router;
