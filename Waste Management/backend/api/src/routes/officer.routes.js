import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requirePortal, loadUser, officerWardIds } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { audited } from '../middleware/audit.js';
import { prisma } from '../lib/prisma.js';
import { PORTALS, SOCKET_EVENTS } from '../config/constants.js';
import analytics from '../services/analytics.service.js';
import { transition, serializeComplaint } from '../services/complaint.service.js';
import { escalate, slaCountdown } from '../services/escalation.service.js';
import { optimizeRoute, drivablePolyline } from '../services/routing.service.js';
import { serializeVehicle, today } from '../services/tracking.service.js';
import { emitTo } from '../sockets/realtime.js';
import { notify } from '../services/notification.service.js';
import { hashPassword } from '../lib/password.js';

const router = Router();
router.use(requirePortal(PORTALS.OFFICER), loadUser);

/** Every handler is scoped: an officer only ever sees their own wards. */
async function scope(req) {
  const ids = await officerWardIds(req.user);
  return { ids, where: ids === null ? {} : { wardId: { in: ids } } };
}

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const [kpis, status, categories] = await Promise.all([
      analytics.overview(ids),
      analytics.statusBreakdown(ids),
      analytics.categoryBreakdown(ids, 7),
    ]);
    res.json({ ...kpis, statusBreakdown: status, categoryBreakdown: categories, wardIds: ids });
  })
);

router.get(
  '/wards',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    res.json(await analytics.wardPerformance(ids));
  })
);

router.get(
  '/heatmap',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    res.json(
      await analytics.heatmapPoints(ids, {
        days: Number(req.query.days) || 14,
        status: req.query.status,
      })
    );
  })
);

/** Complaint queue — sortable, filterable, AI confidence surfaced per row. */
router.get(
  '/complaints',
  asyncHandler(async (req, res) => {
    const { where } = await scope(req);
    const q = z
      .object({
        status: z.string().optional(),
        category: z.string().optional(),
        severity: z.string().optional(),
        wardId: z.string().optional(),
        reviewNeeded: z.coerce.boolean().optional(),
        emergency: z.coerce.boolean().optional(),
        overdue: z.coerce.boolean().optional(),
        search: z.string().optional(),
        sort: z.enum(['newest', 'oldest', 'severity', 'confidence', 'due']).optional(),
        page: z.coerce.number().min(1).optional(),
        pageSize: z.coerce.number().min(5).max(100).optional(),
      })
      .parse(req.query);

    const page = q.page || 1;
    const pageSize = q.pageSize || 25;

    const filter = {
      ...where,
      ...(q.wardId ? { wardId: q.wardId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.severity ? { severity: q.severity } : {}),
      ...(q.reviewNeeded ? { reviewNeeded: true } : {}),
      ...(q.emergency ? { isEmergency: true } : {}),
      ...(q.overdue ? { dueAt: { lt: new Date() }, status: { notIn: ['RESOLVED', 'REJECTED'] } } : {}),
      ...(q.search
        ? { OR: [{ code: { contains: q.search, mode: 'insensitive' } }, { address: { contains: q.search, mode: 'insensitive' } }] }
        : {}),
    };

    const orderBy = {
      newest: { createdAt: 'desc' },
      oldest: { createdAt: 'asc' },
      severity: [{ isEmergency: 'desc' }, { severity: 'desc' }],
      confidence: { aiConfidence: 'asc' },
      due: { dueAt: 'asc' },
    }[q.sort || 'newest'];

    const [rows, total] = await Promise.all([
      prisma.complaint.findMany({
        where: filter,
        include: { ward: true, citizen: { select: { id: true, name: true } }, assignedVehicle: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.complaint.count({ where: filter }),
    ]);

    res.json({
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
      items: rows.map((c) => ({ ...serializeComplaint(c), sla: slaCountdown(c) })),
    });
  })
);

router.get(
  '/complaints/:id',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
      include: {
        ward: true,
        citizen: { select: { id: true, name: true, phone: true, greenCredits: true } },
        assignedVehicle: { include: { driver: { select: { id: true, name: true, phone: true } } } },
        events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true, role: true } } } },
        escalations: { orderBy: { escalatedAt: 'desc' } },
        duplicateLinks: { include: { duplicate: { select: { code: true, citizenId: true, createdAt: true } } } },
      },
    });
    if (!complaint) throw new HttpError(404, 'Complaint not found');
    if (ids !== null && complaint.wardId && !ids.includes(complaint.wardId)) {
      throw new HttpError(403, 'That complaint is outside your ward scope');
    }

    res.json({
      ...serializeComplaint(complaint),
      sla: slaCountdown(complaint),
      timeline: complaint.events.map((e) => ({
        status: e.status,
        note: e.note,
        at: e.createdAt,
        actor: e.actor ? { name: e.actor.name, role: e.actor.role } : null,
      })),
      escalations: complaint.escalations,
      duplicates: complaint.duplicateLinks.map((d) => ({
        code: d.duplicate.code,
        similarity: d.similarityScore,
        distanceMeters: d.distanceMeters,
        at: d.duplicate.createdAt,
      })),
      driver: complaint.assignedVehicle?.driver ?? null,
    });
  })
);

/** Verify / reject after review — the human decision the AI defers to. */
router.post(
  '/complaints/:id/verify',
  writeLimiter,
  audited('complaint_verify', 'complaints'),
  asyncHandler(async (req, res) => {
    const { decision, note } = z
      .object({ decision: z.enum(['VERIFIED', 'REJECTED']), note: z.string().max(500).optional() })
      .parse(req.body);

    res.json(
      await transition({
        complaintId: req.params.id,
        status: decision,
        actorId: req.user.id,
        note: note || (decision === 'VERIFIED' ? 'Verified by officer' : 'Rejected after review'),
        extra: { reviewNeeded: false },
      })
    );
  })
);

/** Assign a complaint (or a cluster) to a truck. */
router.post(
  '/complaints/assign',
  writeLimiter,
  audited('complaint_assign', 'complaints'),
  asyncHandler(async (req, res) => {
    const { complaintIds, vehicleId } = z
      .object({ complaintIds: z.array(z.string()).min(1).max(50), vehicleId: z.string() })
      .parse(req.body);

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { driver: { select: { id: true, name: true } }, ward: true },
    });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');

    const assigned = [];
    for (const id of complaintIds) {
      const payload = await transition({
        complaintId: id,
        status: 'ASSIGNED',
        actorId: req.user.id,
        note: `Assigned to ${vehicle.registrationNumber}`,
        extra: { assignedVehicleId: vehicleId },
      });
      assigned.push(payload);
    }

    if (vehicle.driverId) {
      await notify({
        userId: vehicle.driverId,
        type: 'ASSIGNMENT',
        title: `${assigned.length} new stop${assigned.length === 1 ? '' : 's'} assigned`,
        body: `${vehicle.registrationNumber} — open your route to see them.`,
        payload: { complaintIds },
      });
      emitTo([`truck:${vehicle.id}`, `user:${vehicle.driverId}`, `driver_${vehicle.driverId}`], SOCKET_EVENTS.ASSIGNMENT_NEW, { vehicleId, complaints: assigned });
      emitTo([`truck:${vehicle.id}`, `user:${vehicle.driverId}`, `driver_${vehicle.driverId}`], 'new_task_assigned', { vehicleId, complaints: assigned });
    }

    res.json({ assigned: assigned.length, vehicle: { id: vehicle.id, registrationNumber: vehicle.registrationNumber }, complaints: assigned });
  })
);

router.post(
  '/complaints/:id/escalate',
  writeLimiter,
  audited('complaint_escalate', 'complaints'),
  asyncHandler(async (req, res) => {
    const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (!complaint) throw new HttpError(404, 'Complaint not found');
    const reason = req.body?.reason?.slice(0, 300) || 'Escalated manually by officer';
    res.json(await escalate(complaint, Math.min(2, complaint.escalationCount + 1), reason));
  })
);

/** Emergency panel — unacknowledged emergencies with their countdowns. */
router.get(
  '/emergencies',
  asyncHandler(async (req, res) => {
    const { where } = await scope(req);
    const rows = await prisma.complaint.findMany({
      where: { ...where, isEmergency: true, status: { notIn: ['RESOLVED', 'REJECTED'] } },
      include: { ward: true, citizen: { select: { id: true, name: true, phone: true } }, assignedVehicle: true },
      orderBy: [{ dueAt: 'asc' }],
    });
    res.json(rows.map((c) => ({ ...serializeComplaint(c), sla: slaCountdown(c) })));
  })
);

/** Fleet & driver registry for the ward (plan §2.3). */
router.get(
  '/fleet',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const vehicles = await prisma.vehicle.findMany({
      where: ids === null ? {} : { wardId: { in: ids } },
      include: { ward: true, driver: { select: { id: true, name: true, phone: true, isActive: true } } },
      orderBy: { registrationNumber: 'asc' },
    });

    const withLoad = await Promise.all(
      vehicles.map(async (v) => ({
        ...serializeVehicle(v, v.ward),
        driver: v.driver,
        assignedOpen: await prisma.complaint.count({
          where: { assignedVehicleId: v.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        }),
      }))
    );
    res.json(withLoad);
  })
);

router.get(
  '/hotspots',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    res.json(await analytics.hotspotForecast(ids, req.query.date));
  })
);

router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const [trends, categories, wards, status] = await Promise.all([
      analytics.trends(ids, Number(req.query.days) || 14),
      analytics.categoryBreakdown(ids, Number(req.query.days) || 14),
      analytics.wardPerformance(ids),
      analytics.statusBreakdown(ids),
    ]);
    res.json({ trends, categories, wards, status });
  })
);

router.get(
  '/escalations',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const rows = await prisma.escalation.findMany({
      where: ids === null ? {} : { complaint: { wardId: { in: ids } } },
      include: {
        complaint: { select: { id: true, code: true, category: true, status: true, wardId: true } },
        escalatedTo: { select: { name: true, role: true } },
      },
      orderBy: { escalatedAt: 'desc' },
      take: 100,
    });
    res.json(rows);
  })
);

/** Build an optimised route from the ward's open complaints. */
router.post(
  '/routes/optimize',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { vehicleId, complaintIds, wardId } = z
      .object({
        vehicleId: z.string(),
        complaintIds: z.array(z.string()).optional(),
        wardId: z.string().optional(),
      })
      .parse(req.body);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { ward: true } });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');

    const complaints = await prisma.complaint.findMany({
      where: complaintIds?.length
        ? { id: { in: complaintIds } }
        : {
            wardId: wardId || vehicle.wardId,
            status: { in: ['VERIFIED', 'ASSIGNED'] },
            duplicateOfId: null,
          },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });
    if (!complaints.length) throw new HttpError(400, 'No open complaints to route');

    const depot =
      vehicle.lastLat != null
        ? { coordinates: [vehicle.lastLng, vehicle.lastLat] }
        : { coordinates: [vehicle.ward?.centerLng ?? complaints[0].longitude, vehicle.ward?.centerLat ?? complaints[0].latitude] };

    const solved = await optimizeRoute({
      depot,
      stops: complaints.map((c) => ({
        complaintId: c.id,
        code: c.code,
        label: c.address || c.code,
        category: c.category,
        severity: c.severity,
        isEmergency: c.isEmergency,
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    });

    res.json({ ...solved, polyline: drivablePolyline(solved.polyline), vehicleId, complaintIds: complaints.map((c) => c.id) });
  })
);

/** Publish the plan — the driver sees it immediately. */
router.post(
  '/routes/publish',
  writeLimiter,
  audited('route_publish', 'routes'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        vehicleId: z.string(),
        stops: z.array(z.any()).min(1),
        polyline: z.array(z.array(z.number())),
        distanceKm: z.number().optional(),
        baselineKm: z.number().optional(),
        savedKm: z.number().optional(),
        durationMin: z.number().optional(),
        fuelSaved: z.number().optional(),
        co2SavedKg: z.number().optional(),
        solver: z.string().optional(),
        solveMs: z.number().optional(),
        label: z.string().optional(),
      })
      .parse(req.body);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: body.vehicleId }, include: { ward: true } });
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');

    const route = await prisma.route.upsert({
      where: { vehicleId_date: { vehicleId: body.vehicleId, date: today() } },
      create: {
        vehicleId: body.vehicleId,
        driverId: vehicle.driverId,
        wardId: vehicle.wardId,
        date: today(),
        status: 'PUBLISHED',
        label: body.label || `${vehicle.registrationNumber} · ${today()}`,
        orderedStops: body.stops,
        polylineGeometry: body.polyline,
        distanceKm: body.distanceKm ?? 0,
        baselineKm: body.baselineKm ?? 0,
        savedKm: body.savedKm ?? 0,
        durationMin: body.durationMin ?? 0,
        fuelSaved: body.fuelSaved ?? 0,
        co2SavedKg: body.co2SavedKg ?? 0,
        solver: body.solver || 'safaai-node-2opt',
        solveMs: body.solveMs ?? 0,
      },
      update: {
        status: 'PUBLISHED',
        orderedStops: body.stops,
        polylineGeometry: body.polyline,
        distanceKm: body.distanceKm ?? 0,
        baselineKm: body.baselineKm ?? 0,
        savedKm: body.savedKm ?? 0,
        durationMin: body.durationMin ?? 0,
        fuelSaved: body.fuelSaved ?? 0,
        co2SavedKg: body.co2SavedKg ?? 0,
        driverId: vehicle.driverId,
      },
    });

    // Assign every routed complaint to this vehicle in one pass.
    const complaintIds = body.stops.map((s) => s.complaintId).filter(Boolean);
    if (complaintIds.length) {
      await prisma.complaint.updateMany({
        where: { id: { in: complaintIds }, status: { in: ['PENDING', 'VERIFIED'] } },
        data: { assignedVehicleId: body.vehicleId, status: 'ASSIGNED', assignedAt: new Date(), assignedById: req.user.id },
      });
    }

    if (vehicle.driverId) {
      await notify({
        userId: vehicle.driverId,
        type: 'ASSIGNMENT',
        title: 'New route published',
        body: `${body.stops.length} stops · ${body.distanceKm ?? 0} km`,
        payload: { routeId: route.id },
      });
    }
    emitTo([vehicle.wardId ? `ward:${vehicle.wardId}` : null, `truck:${vehicle.id}`, 'city'], SOCKET_EVENTS.ASSIGNMENT_NEW, {
      routeId: route.id,
      vehicleId: vehicle.id,
      stops: body.stops.length,
    });

    res.status(201).json({ id: route.id, status: route.status, stops: body.stops.length, distanceKm: route.distanceKm });
  })
);

router.get(
  '/sos',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const rows = await prisma.sosAlert.findMany({
      where: {
        status: { not: 'RESOLVED' },
        ...(ids === null ? {} : { vehicle: { wardId: { in: ids } } }),
      },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { id: true, registrationNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  })
);

router.post(
  '/sos/:id/acknowledge',
  audited('sos_acknowledge', 'sos_alerts'),
  asyncHandler(async (req, res) => {
    const alert = await prisma.sosAlert.update({
      where: { id: req.params.id },
      data: { status: 'ACKNOWLEDGED', acknowledgedById: req.user.id, acknowledgedAt: new Date() },
    });
    await notify({
      userId: alert.driverId,
      type: 'EMERGENCY',
      title: 'SOS acknowledged',
      body: `${req.user.name} is responding.`,
      payload: { sosId: alert.id },
    });
    res.json(alert);
  })
);

router.post(
  '/drivers',
  writeLimiter,
  audited('driver_create', 'users'),
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const body = z
      .object({
        name: z.string().min(2).max(80),
        email: z.string().email(),
        phone: z.string().min(8).max(15),
        password: z.string().min(8),
        wardId: z.string(),
      })
      .parse(req.body);

    if (ids !== null && !ids.includes(body.wardId)) {
      throw new HttpError(403, 'You can only create drivers for your own wards');
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: body.email.toLowerCase() }, { phone: body.phone }] }
    });
    if (existing) throw new HttpError(409, 'An account with that email or phone already exists');

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        phone: body.phone,
        role: 'DRIVER',
        passwordHash: await hashPassword(body.password),
        wardId: body.wardId,
        emailVerifiedAt: null, // Force first login flow
      },
    });

    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  })
);

export default router;
