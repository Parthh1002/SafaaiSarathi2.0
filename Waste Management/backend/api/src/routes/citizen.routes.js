import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requirePortal, loadUser } from '../middleware/auth.js';
import { reportLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { upload, persist, fileFromRequest } from '../middleware/upload.js';
import { prisma } from '../lib/prisma.js';
import { PORTALS, WASTE_CATEGORIES, EMERGENCY_TYPES, CREDIT_RULES } from '../config/constants.js';
import { createComplaint, serializeComplaint, findDuplicate, wardForPoint } from '../services/complaint.service.js';
import { classifyWaste } from '../services/ai.service.js';
import { distanceMeters, boundsAround } from '../lib/geo.js';

const router = Router();
router.use(requirePortal(PORTALS.CITIZEN), loadUser);

const coordinate = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

/** Home: credits, active reports, the truck heading their way. */
router.get(
  '/home',
  asyncHandler(async (req, res) => {
    const [active, resolvedCount, ward] = await Promise.all([
      prisma.complaint.findMany({
        where: { citizenId: req.user.id, status: { notIn: ['RESOLVED', 'REJECTED'] } },
        include: { ward: true, assignedVehicle: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.complaint.count({ where: { citizenId: req.user.id, status: 'RESOLVED' } }),
      req.user.wardId ? prisma.ward.findUnique({ where: { id: req.user.wardId } }) : null,
    ]);

    const trackable = active.find((c) => c.assignedVehicleId);
    let truck = null;
    if (trackable?.assignedVehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: trackable.assignedVehicleId },
        select: { id: true, registrationNumber: true, lastLat: true, lastLng: true, lastHeading: true, status: true },
      });
      if (vehicle?.lastLat != null) {
        const metres = distanceMeters(
          { latitude: trackable.latitude, longitude: trackable.longitude },
          { latitude: vehicle.lastLat, longitude: vehicle.lastLng }
        );
        truck = {
          ...vehicle,
          complaintCode: trackable.code,
          distanceMeters: Math.round(metres),
          // 20 km/h average city speed, floor of one minute.
          etaMinutes: Math.max(1, Math.round((metres / 1000 / 20) * 60)),
          room: `truck:${vehicle.id}`,
        };
      }
    }

    res.json({
      user: {
        name: req.user.name,
        greenCredits: req.user.greenCredits,
        language: req.user.language,
        ward: ward ? { id: ward.id, name: ward.name, code: ward.code } : null,
      },
      stats: {
        active: active.length,
        resolved: resolvedCount,
        credits: req.user.greenCredits,
      },
      activeComplaints: active.map((c) => serializeComplaint(c)),
      truck,
      creditRules: CREDIT_RULES,
    });
  })
);

/** Nearby reports feed — what else is happening around me. */
router.get(
  '/feed',
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = coordinate.parse(req.query);
    const radius = Math.min(5000, Number(req.query.radius) || 1500);
    const bounds = boundsAround({ latitude, longitude }, radius);

    const complaints = await prisma.complaint.findMany({
      where: {
        latitude: { gte: bounds.minLat, lte: bounds.maxLat },
        longitude: { gte: bounds.minLng, lte: bounds.maxLng },
        duplicateOfId: null,
        createdAt: { gte: new Date(Date.now() - 14 * 864e5) },
      },
      include: { ward: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    const nearby = complaints
      .map((c) => ({ complaint: c, metres: distanceMeters({ latitude, longitude }, c) }))
      .filter((x) => x.metres <= radius)
      .sort((a, b) => a.metres - b.metres)
      .map(({ complaint, metres }) => ({
        ...serializeComplaint(complaint),
        distanceMeters: Math.round(metres),
        // Other people's reports are anonymised in the public feed.
        citizen: undefined,
      }));

    res.json(nearby);
  })
);

/**
 * Pre-flight classification: the citizen sees the AI's guess before submitting,
 * so the category is confirmed by a human rather than silently assumed.
 */
router.post(
  '/classify',
  writeLimiter,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const file = fileFromRequest(req);
    if (!file) throw new HttpError(400, 'A photo is required');

    const ai = await classifyWaste({ ...file, hint: req.body.hint });
    res.json({
      category: ai.category,
      confidence: ai.confidence,
      alternatives: ai.alternatives ?? [],
      detections: ai.detections ?? [],
      modelVersion: ai.modelVersion,
      degraded: ai.degraded,
      degradedReason: ai.degradedReason,
      capture: ai.capture,
    });
  })
);

/** New report (plan §2.1) — photo, AI category, confirm location, submit. */
router.post(
  '/complaints',
  reportLimiter,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        latitude: z.coerce.number().min(-90).max(90),
        longitude: z.coerce.number().min(-180).max(180),
        category: z.string().optional(),
        description: z.string().max(1000).optional(),
        address: z.string().max(255).optional(),
        isEmergency: z.coerce.boolean().optional(),
        channel: z.enum(['APP', 'WEB', 'WHATSAPP', 'IVR']).optional(),
      })
      .parse(req.body);

    const file = fileFromRequest(req);
    const photoUrl = file ? persist(file.buffer, file.mimetype) : null;

    const result = await createComplaint({
      citizenId: req.user.id,
      photo: file,
      photoUrl,
      latitude: body.latitude,
      longitude: body.longitude,
      address: body.address,
      description: body.description,
      declaredCategory: body.category,
      isEmergency: body.isEmergency,
      channel: body.channel || 'WEB',
      req,
    });

    res.status(201).json(result);
  })
);

/** The red emergency button — always high severity, always fast-pathed. */
router.post(
  '/emergency',
  reportLimiter,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        latitude: z.coerce.number(),
        longitude: z.coerce.number(),
        category: z.enum(EMERGENCY_TYPES),
        description: z.string().max(1000).optional(),
        address: z.string().max(255).optional(),
      })
      .parse(req.body);

    const file = fileFromRequest(req);
    const result = await createComplaint({
      citizenId: req.user.id,
      photo: file,
      photoUrl: file ? persist(file.buffer, file.mimetype, 'emergency') : null,
      latitude: body.latitude,
      longitude: body.longitude,
      address: body.address,
      description: body.description,
      declaredCategory: body.category,
      isEmergency: true,
      channel: 'WEB',
      req,
    });

    res.status(201).json(result);
  })
);

/** Duplicate pre-check so the UI can say "5 people already reported this". */
router.get(
  '/complaints/check-duplicate',
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = coordinate.parse(req.query);
    const category = String(req.query.category || 'GARBAGE_PILE');
    const ward = await wardForPoint({ latitude, longitude });
    const duplicate = await findDuplicate({ latitude, longitude, category, wardId: ward?.id });

    res.json(
      duplicate
        ? {
            found: true,
            code: duplicate.complaint.code,
            id: duplicate.complaint.id,
            alsoReportedBy: duplicate.complaint.upvotes + 1,
            distanceMeters: Math.round(duplicate.distanceMeters),
            status: duplicate.complaint.status,
            createdAt: duplicate.complaint.createdAt,
          }
        : { found: false }
    );
  })
);

router.get(
  '/complaints',
  asyncHandler(async (req, res) => {
    const complaints = await prisma.complaint.findMany({
      where: { citizenId: req.user.id },
      include: { ward: true, assignedVehicle: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Number(req.query.limit) || 30),
    });
    res.json(complaints.map((c) => serializeComplaint(c)));
  })
);

/** Status timeline (Pending -> Verified -> Assigned -> In progress -> Resolved). */
router.get(
  '/complaints/:id',
  asyncHandler(async (req, res) => {
    const complaint = await prisma.complaint.findFirst({
      where: { id: req.params.id, citizenId: req.user.id },
      include: {
        ward: true,
        assignedVehicle: { select: { id: true, registrationNumber: true, lastLat: true, lastLng: true, status: true } },
        events: { orderBy: { createdAt: 'asc' } },
        duplicateLinks: true,
      },
    });
    if (!complaint) throw new HttpError(404, 'Report not found');

    res.json({
      ...serializeComplaint(complaint),
      timeline: complaint.events.map((e) => ({
        status: e.status,
        note: e.note,
        at: e.createdAt,
      })),
      alsoReportedBy: complaint.upvotes,
      trackRoom: complaint.assignedVehicleId ? `truck:${complaint.assignedVehicleId}` : null,
    });
  })
);

/** Live truck tracker for one complaint — the citizen joins a single room. */
router.get(
  '/complaints/:id/track',
  asyncHandler(async (req, res) => {
    const complaint = await prisma.complaint.findFirst({
      where: { id: req.params.id, citizenId: req.user.id },
      include: { assignedVehicle: true },
    });
    if (!complaint) throw new HttpError(404, 'Report not found');
    if (!complaint.assignedVehicle) {
      return res.json({ tracking: false, reason: 'No vehicle assigned yet' });
    }

    const v = complaint.assignedVehicle;
    const metres =
      v.lastLat != null
        ? distanceMeters({ latitude: complaint.latitude, longitude: complaint.longitude }, { latitude: v.lastLat, longitude: v.lastLng })
        : null;

    return res.json({
      tracking: true,
      room: `truck:${v.id}`,
      vehicle: {
        id: v.id,
        registrationNumber: v.registrationNumber,
        status: v.status,
        latitude: v.lastLat,
        longitude: v.lastLng,
        heading: v.lastHeading,
        lastPingAt: v.lastPingAt,
      },
      target: { latitude: complaint.latitude, longitude: complaint.longitude },
      distanceMeters: metres != null ? Math.round(metres) : null,
      etaMinutes: metres != null ? Math.max(1, Math.round((metres / 1000 / 20) * 60)) : null,
    });
  })
);

/** Green credits ledger + ward leaderboard. */
router.get(
  '/credits',
  asyncHandler(async (req, res) => {
    const entries = await prisma.greenCredit.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { complaint: { select: { code: true } } },
    });
    res.json({
      balance: req.user.greenCredits,
      rules: CREDIT_RULES,
      entries: entries.map((e) => ({
        id: e.id,
        delta: e.delta,
        balanceAfter: e.balanceAfter,
        reason: e.reason,
        reasonCode: e.reasonCode,
        complaintCode: e.complaint?.code ?? null,
        createdAt: e.createdAt,
      })),
    });
  })
);

router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const where = req.user.wardId ? { wardId: req.user.wardId, role: 'CITIZEN' } : { role: 'CITIZEN' };
    const [top, ahead, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, greenCredits: true },
        orderBy: { greenCredits: 'desc' },
        take: 10,
      }),
      prisma.user.count({ where: { ...where, greenCredits: { gt: req.user.greenCredits } } }),
      prisma.user.count({ where }),
    ]);

    res.json({
      rank: ahead + 1,
      total,
      me: { id: req.user.id, name: req.user.name, greenCredits: req.user.greenCredits },
      top: top.map((u, i) => ({
        position: i + 1,
        // Only the signed-in citizen sees their own full name.
        name: u.id === req.user.id ? u.name : maskName(u.name),
        greenCredits: u.greenCredits,
        isMe: u.id === req.user.id,
      })),
    });
  })
);

const maskName = (name) => {
  const parts = String(name).trim().split(/\s+/);
  return parts.map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(' ');
};

/** Community directory — cached offline by the client. */
router.get(
  '/directory',
  asyncHandler(async (req, res) => {
    const contacts = await prisma.emergencyContact.findMany({
      where: req.user.wardId ? { OR: [{ isCityWide: true }, { wardId: req.user.wardId }] } : { isCityWide: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(contacts);
  })
);

router.get('/categories', (_req, res) => res.json(WASTE_CATEGORIES));

router.patch(
  '/profile',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(80).optional(),
        language: z.enum(['en', 'hi', 'gu']).optional(),
        wardId: z.string().optional(),
      })
      .parse(req.body);

    const user = await prisma.user.update({ where: { id: req.user.id }, data: body, include: { ward: true } });
    res.json({
      name: user.name,
      language: user.language,
      ward: user.ward ? { id: user.ward.id, name: user.ward.name } : null,
    });
  })
);

router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const rows = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(rows);
  })
);

router.post(
  '/notifications/read',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  })
);

export default router;
