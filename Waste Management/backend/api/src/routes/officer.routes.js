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
import { serializeVehicle, today, startOfToday } from '../services/tracking.service.js';
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

/**
 * FEATURE 1: Main Ward Dashboard
 * GET /api/officer/dashboard & GET /api/officer/overview
 */
router.get(
  ['/dashboard', '/overview'],
  asyncHandler(async (req, res) => {
    const { ids, where } = await scope(req);
    const wardWhere = ids === null ? {} : { id: { in: ids } };

    const [
      kpis,
      statusBreakdown,
      categoryBreakdown,
      activeTrucksCount,
      pendingComplaintsCount,
      todayResolvedCount,
      resolvedWithinSlaCount,
      totalResolvedCount,
    ] = await Promise.all([
      analytics.overview(ids),
      analytics.statusBreakdown(ids),
      analytics.categoryBreakdown(ids, 7),
      prisma.vehicle.count({
        where: {
          ...(ids === null ? {} : { wardId: { in: ids } }),
          status: { in: ['IDLE', 'ON_ROUTE'] },
        },
      }),
      prisma.complaint.count({
        where: {
          ...where,
          status: { in: ['PENDING', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'] },
        },
      }),
      prisma.complaint.count({
        where: {
          ...where,
          status: 'RESOLVED',
          resolvedAt: { gte: startOfToday() },
        },
      }),
      prisma.complaint.count({
        where: {
          ...where,
          status: 'RESOLVED',
          resolvedAt: { lte: prisma.complaint.fields?.dueAt || new Date() },
        },
      }),
      prisma.complaint.count({
        where: { ...where, status: 'RESOLVED' },
      }),
    ]);

    // Compute SLA compliance percentage server-side
    const slaCompliancePercent =
      totalResolvedCount > 0
        ? Math.round((resolvedWithinSlaCount / totalResolvedCount) * 100)
        : (kpis?.slaCompliancePercent ?? 92);

    res.json({
      slaCompliancePercent,
      activeTrucksCount,
      pendingComplaintsCount,
      todayResolvedCount,
      kpis,
      statusBreakdown,
      categoryBreakdown,
      wardIds: ids,
    });
  })
);

/**
 * FEATURE 2: AI Complaint Queue
 * GET /api/officer/queue & GET /api/officer/complaints
 */
router.get(
  ['/queue', '/complaints'],
  asyncHandler(async (req, res) => {
    const { where } = await scope(req);
    const q = z
      .object({
        status: z.string().optional(),
        minConfidence: z.coerce.number().min(0).max(1).optional(),
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

    let statusConstraint = undefined;
    if (q.status) {
      if (q.status.toLowerCase() === 'ai_verifying') statusConstraint = 'PENDING';
      else if (q.status.toLowerCase() === 'verified') statusConstraint = 'VERIFIED';
      else if (q.status.toLowerCase() === 'flagged') statusConstraint = 'REJECTED';
      else statusConstraint = q.status.toUpperCase();
    }

    const filter = {
      ...where,
      ...(q.wardId ? { wardId: q.wardId } : {}),
      ...(statusConstraint ? { status: statusConstraint } : {}),
      ...(q.minConfidence != null ? { aiConfidence: { gte: q.minConfidence } } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.severity ? { severity: q.severity } : {}),
      ...(q.reviewNeeded ? { reviewNeeded: true } : {}),
      ...(q.emergency ? { isEmergency: true } : {}),
      ...(q.overdue ? { dueAt: { lt: new Date() }, status: { notIn: ['RESOLVED', 'REJECTED'] } } : {}),
      ...(q.search
        ? {
            OR: [
              { code: { contains: q.search, mode: 'insensitive' } },
              { address: { contains: q.search, mode: 'insensitive' } },
            ],
          }
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
        include: {
          ward: true,
          citizen: { select: { id: true, name: true, reliabilityScore: true } },
          assignedVehicle: { include: { driver: { select: { id: true, name: true } } } },
        },
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
      items: rows.map((c) => ({
        ...serializeComplaint(c),
        sla: slaCountdown(c),
        isLowConfidence: (c.aiConfidence != null && c.aiConfidence < 0.70),
        reliabilityBadge: c.citizen?.reliabilityScore != null ? (c.citizen.reliabilityScore > 80 ? 'HIGH' : c.citizen.reliabilityScore < 40 ? 'LOW' : 'NORMAL') : 'NORMAL',
      })),
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
        citizen: { select: { id: true, name: true, phone: true, greenCredits: true, reliabilityScore: true } },
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

/**
 * Rejection / Flag as False Positive
 * PATCH /api/officer/complaints/:id/reject & POST /api/officer/complaints/:id/reject
 */
router.all(
  '/complaints/:id/reject',
  writeLimiter,
  audited('complaint_reject', 'complaints'),
  asyncHandler(async (req, res) => {
    const { reason, note } = z
      .object({
        reason: z.string().min(1).max(300).optional(),
        note: z.string().max(500).optional(),
      })
      .parse(req.body);

    const rejectReason = reason || note || 'Flagged as false positive by officer';

    const result = await transition({
      complaintId: req.params.id,
      status: 'REJECTED',
      actorId: req.user.id,
      note: rejectReason,
      extra: { reviewNeeded: false, rejectionReason: rejectReason },
    });

    res.json({ success: true, complaint: result });
  })
);

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

/**
 * FEATURE 3: Assign to Driver (Officer -> Driver Real-time Link)
 * POST /api/officer/assign & POST /api/officer/complaints/assign
 */
router.post(
  ['/assign', '/complaints/assign'],
  writeLimiter,
  audited('complaint_assign', 'complaints'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        complaintId: z.string().optional(),
        complaintIds: z.array(z.string()).optional(),
        driverId: z.string().optional(),
        vehicleId: z.string().optional(),
      })
      .parse(req.body);

    const targetComplaintIds = body.complaintIds || (body.complaintId ? [body.complaintId] : []);
    if (!targetComplaintIds.length) throw new HttpError(400, 'At least one complaintId is required');

    let vehicle = null;
    if (body.vehicleId) {
      vehicle = await prisma.vehicle.findUnique({
        where: { id: body.vehicleId },
        include: { driver: { select: { id: true, name: true, phone: true } }, ward: true },
      });
    } else if (body.driverId) {
      vehicle = await prisma.vehicle.findFirst({
        where: { driverId: body.driverId },
        include: { driver: { select: { id: true, name: true, phone: true } }, ward: true },
      });
    }

    if (!vehicle) {
      throw new HttpError(404, 'No active vehicle found for this driver or vehicle ID.');
    }

    const assigned = [];
    for (const id of targetComplaintIds) {
      const payload = await transition({
        complaintId: id,
        status: 'ASSIGNED',
        actorId: req.user.id,
        note: `Assigned to ${vehicle.registrationNumber} (Driver: ${vehicle.driver?.name || 'Assigned Crew'})`,
        extra: { assignedVehicleId: vehicle.id },
      });
      assigned.push(payload);

      // Emit status-update event to complaint room for Citizen live tracking
      emitTo([`complaint:${id}`, `complaint_${id}`], SOCKET_EVENTS.COMPLAINT_UPDATE, payload);
    }

    if (vehicle.driverId) {
      await notify({
        userId: vehicle.driverId,
        type: 'ASSIGNMENT',
        title: `${assigned.length} new stop${assigned.length === 1 ? '' : 's'} assigned`,
        body: `${vehicle.registrationNumber} — open your route to see them.`,
        payload: { complaintIds: targetComplaintIds },
      });

      // Real-time dispatch to Driver Portal room
      const driverRooms = [`truck:${vehicle.id}`, `user:${vehicle.driverId}`, `driver_${vehicle.driverId}`];
      emitTo(driverRooms, SOCKET_EVENTS.ASSIGNMENT_NEW, { vehicleId: vehicle.id, complaints: assigned });
      emitTo(driverRooms, 'new_task_assigned', { vehicleId: vehicle.id, complaints: assigned });
    }

    res.json({
      success: true,
      assignedCount: assigned.length,
      vehicle: { id: vehicle.id, registrationNumber: vehicle.registrationNumber },
      driver: vehicle.driver,
      complaints: assigned,
    });
  })
);

/**
 * FEATURE 4: Live Fleet Tracking
 * GET /api/officer/fleet
 */
router.get(
  '/fleet',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const vehicles = await prisma.vehicle.findMany({
      where: ids === null ? {} : { wardId: { in: ids } },
      include: { ward: true, driver: { select: { id: true, name: true, phone: true, isActive: true } } },
      orderBy: { registrationNumber: 'asc' },
    });

    const now = Date.now();
    const withLoad = await Promise.all(
      vehicles.map(async (v) => {
        const activeComplaints = await prisma.complaint.findMany({
          where: { assignedVehicleId: v.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
          select: { id: true, code: true, category: true, status: true, address: true, latitude: true, longitude: true },
          orderBy: { createdAt: 'asc' },
        });

        const isStale = v.lastPingAt ? (now - new Date(v.lastPingAt).getTime() > 120_000) : true;

        return {
          ...serializeVehicle(v, v.ward),
          driver: v.driver,
          assignedOpen: activeComplaints.length,
          currentTask: activeComplaints[0] || null,
          activeTasks: activeComplaints,
          isOffline: v.status === 'OFFLINE' || isStale,
          lastPingAgeSec: v.lastPingAt ? Math.round((now - new Date(v.lastPingAt).getTime()) / 1000) : null,
        };
      })
    );
    res.json(withLoad);
  })
);

/**
 * FEATURE 5: Garbage Hotspots (Heatmap)
 * GET /api/officer/hotspots & GET /api/officer/heatmap
 */
router.get(
  ['/hotspots', '/heatmap'],
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const days = Number(req.query.days) || 30;

    const [points, forecast] = await Promise.all([
      analytics.heatmapPoints(ids, { days, status: req.query.status }),
      analytics.hotspotForecast(ids, req.query.date),
    ]);

    res.json({ points, forecast, days });
  })
);

/**
 * FEATURE 6: AI Recommendation Cards
 * GET /api/officer/recommendations
 */
router.get(
  '/recommendations',
  asyncHandler(async (req, res) => {
    const { ids, where } = await scope(req);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);

    const [frequentCategories, highDensityAreas, overdueCount] = await Promise.all([
      prisma.complaint.groupBy({
        by: ['category'],
        where: { ...where, createdAt: { gte: sevenDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 3,
      }),
      prisma.complaint.groupBy({
        by: ['address'],
        where: { ...where, createdAt: { gte: sevenDaysAgo }, address: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 3,
      }),
      prisma.complaint.count({
        where: { ...where, dueAt: { lt: new Date() }, status: { notIn: ['RESOLVED', 'REJECTED'] } },
      }),
    ]);

    const cards = [];

    // 1. High density area recommendation
    if (highDensityAreas.length > 0 && highDensityAreas[0]._count.id >= 3) {
      cards.push({
        id: 'rec-density',
        type: 'INFRASTRUCTURE',
        title: `High Waste Accumulation: ${highDensityAreas[0].address || 'Identified Sector'}`,
        description: `This area received ${highDensityAreas[0]._count.id} reports in the last 7 days. Consider deploying a permanent secondary bin or scheduled morning sweep.`,
        priority: 'HIGH',
        actionLabel: 'View on Heatmap',
        actionLink: '/officer/hotspots',
      });
    }

    // 2. Overdue complaints
    if (overdueCount > 0) {
      cards.push({
        id: 'rec-overdue',
        type: 'SLA_RISK',
        title: `${overdueCount} Overdue Complaints Require Reassignment`,
        description: `Multiple collection points have breached their SLA resolution window. Reassign to available backup trucks immediately to maintain compliance.`,
        priority: 'CRITICAL',
        actionLabel: 'Open Emergency Queue',
        actionLink: '/officer/emergencies',
      });
    }

    // 3. Category pattern recommendation
    if (frequentCategories.length > 0) {
      const topCat = frequentCategories[0].category;
      cards.push({
        id: 'rec-category',
        type: 'OPTIMIZATION',
        title: `Recurring ${topCat.replace('_', ' ')} Reports Detected`,
        description: `${frequentCategories[0]._count.id} reports of this type filed this week. Consider adjusting crew collection frequency for this category.`,
        priority: 'MEDIUM',
        actionLabel: 'Check Ward Analytics',
        actionLink: '/officer/analytics',
      });
    }

    res.json({ recommendations: cards, total: cards.length });
  })
);

/**
 * FEATURE 7: What-If Collection Simulator
 * POST /api/officer/simulate
 */
router.post(
  '/simulate',
  asyncHandler(async (req, res) => {
    const { where } = await scope(req);
    const body = z
      .object({
        hotspotId: z.string().optional(),
        delayHours: z.coerce.number().min(0).max(72).default(6),
      })
      .parse(req.body);

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);
    const recentReportsCount = await prisma.complaint.count({
      where: { ...where, createdAt: { gte: sevenDaysAgo } },
    });

    const averageReportsPerHour = Math.max(0.2, (recentReportsCount / (7 * 24)));
    const projectedAdditionalReports = Math.round(averageReportsPerHour * body.delayHours * 1.35);
    const overflowProbabilityPercent = Math.min(98, Math.round(35 + (body.delayHours * 9.5)));
    const estimatedSlaPenaltyRisk = body.delayHours > 12 ? 'HIGH' : body.delayHours > 4 ? 'MEDIUM' : 'LOW';

    res.json({
      delayHours: body.delayHours,
      averageReportsPerHour: Number(averageReportsPerHour.toFixed(2)),
      projectedAdditionalReports,
      overflowProbabilityPercent,
      estimatedSlaPenaltyRisk,
      immediateDispatchImpact: {
        slaComplianceEstimated: '96%',
        co2SavedKg: Number((body.delayHours * 1.8).toFixed(1)),
      },
      delayedDispatchImpact: {
        slaComplianceEstimated: `${Math.max(60, 96 - (body.delayHours * 3))}%`,
        co2PenaltyKg: Number((body.delayHours * 3.2).toFixed(1)),
      },
    });
  })
);

/**
 * FEATURE 8: Emergencies & Escalations
 * GET /api/officer/emergencies
 */
router.get(
  '/emergencies',
  asyncHandler(async (req, res) => {
    const { where } = await scope(req);

    const [overdueComplaints, citizenEmergencies, driverSosAlerts] = await Promise.all([
      // SLA breaches
      prisma.complaint.findMany({
        where: {
          ...where,
          dueAt: { lt: new Date() },
          status: { notIn: ['RESOLVED', 'REJECTED'] },
        },
        include: { ward: true, citizen: { select: { id: true, name: true, phone: true } }, assignedVehicle: true },
        orderBy: { dueAt: 'asc' },
        take: 50,
      }),
      // Critical citizen emergency reports
      prisma.complaint.findMany({
        where: {
          ...where,
          isEmergency: true,
          status: { notIn: ['RESOLVED', 'REJECTED'] },
        },
        include: { ward: true, citizen: { select: { id: true, name: true, phone: true } }, assignedVehicle: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Active driver SOS alerts
      prisma.sosAlert.findMany({
        where: { status: { not: 'RESOLVED' } },
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          vehicle: { select: { id: true, registrationNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    res.json({
      slaBreaches: overdueComplaints.map((c) => ({ ...serializeComplaint(c), sla: slaCountdown(c), type: 'SLA_BREACH' })),
      citizenEmergencies: citizenEmergencies.map((c) => ({ ...serializeComplaint(c), sla: slaCountdown(c), type: 'CITIZEN_EMERGENCY' })),
      driverSos: driverSosAlerts.map((s) => ({
        id: s.id,
        driver: s.driver,
        vehicle: s.vehicle,
        latitude: s.latitude,
        longitude: s.longitude,
        message: s.message,
        status: s.status,
        createdAt: s.createdAt,
        type: 'DRIVER_SOS',
      })),
    });
  })
);

router.post(
  ['/emergencies/:id/ack', '/sos/:id/acknowledge'],
  audited('emergency_acknowledge', 'emergencies'),
  asyncHandler(async (req, res) => {
    // Check if it's an SOS alert
    const sos = await prisma.sosAlert.findUnique({ where: { id: req.params.id } });
    if (sos) {
      const updated = await prisma.sosAlert.update({
        where: { id: sos.id },
        data: { status: 'ACKNOWLEDGED', acknowledgedById: req.user.id, acknowledgedAt: new Date() },
      });
      return res.json({ success: true, item: updated });
    }

    // Otherwise check complaint
    const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (complaint) {
      const updated = await prisma.complaint.update({
        where: { id: complaint.id },
        data: { reviewNeeded: false },
      });
      return res.json({ success: true, item: serializeComplaint(updated) });
    }

    throw new HttpError(404, 'Emergency item not found');
  })
);

/**
 * FEATURE 9: Ward Analytics
 * GET /api/officer/analytics
 */
router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const range = req.query.range === 'month' ? 30 : 7;

    const [trends, categories, wards, status, fuelLogs] = await Promise.all([
      analytics.trends(ids, range),
      analytics.categoryBreakdown(ids, range),
      analytics.wardPerformance(ids),
      analytics.statusBreakdown(ids),
      prisma.fuelLog.findMany({
        where: {
          loggedAt: { gte: new Date(Date.now() - range * 86400_000) },
        },
        orderBy: { loggedAt: 'desc' },
        take: 50,
      }).catch(() => []),
    ]);

    const totalFuelLiters = fuelLogs.reduce((sum, f) => sum + (f.liters || 0), 0);
    const totalFuelCost = fuelLogs.reduce((sum, f) => sum + (f.cost || 0), 0);

    res.json({
      trends,
      categories,
      wards,
      status,
      fuel: {
        totalLiters: totalFuelLiters,
        totalCost: totalFuelCost,
        entriesCount: fuelLogs.length,
        recentLogs: fuelLogs.slice(0, 10),
      },
    });
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
        emailVerifiedAt: null,
      },
    });

    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  })
);

// ------------------------------------------------ Scheduled Pickup Management ----

/** GET /api/officer/scheduled-requests — List ward's scheduled pickup requests */
router.get(
  '/scheduled-requests',
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const wardWhere = ids === null ? {} : { wardId: { in: ids } };

    const items = await prisma.scheduledPickupRequest.findMany({
      where: { ...wardWhere },
      include: {
        citizen: { select: { id: true, name: true, phone: true, email: true } },
        ward: { select: { id: true, name: true, code: true } },
        assignedDriver: { select: { id: true, name: true, phone: true } },
        assignedVehicle: { select: { id: true, registrationNumber: true, model: true } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ items });
  })
);

/** POST /api/officer/scheduled-requests/:id/approve — Approve advance scheduled pickup */
router.post(
  '/scheduled-requests/:id/approve',
  writeLimiter,
  audited('scheduled_pickup_approve', 'scheduled_pickup_requests'),
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const item = await prisma.scheduledPickupRequest.findFirst({
      where: {
        id: req.params.id,
        ...(ids === null ? {} : { wardId: { in: ids } }),
      },
      include: { citizen: true },
    });
    if (!item) throw new HttpError(404, 'Scheduled pickup request not found or not in your ward');

    const updated = await prisma.scheduledPickupRequest.update({
      where: { id: item.id },
      data: { status: 'APPROVED_SCHEDULED' },
    });

    // Notify citizen
    await notify({
      userId: item.citizenId,
      type: 'SYSTEM',
      title: `Scheduled Pickup Approved (${item.code})`,
      body: `Your pickup for "${item.eventReason}" on ${new Date(item.scheduledDate).toLocaleDateString('en-IN')} has been approved by the Ward Officer.`,
      payload: { requestId: item.id, code: item.code },
    });

    res.json({ ok: true, status: 'APPROVED_SCHEDULED', item: updated });
  })
);

/** POST /api/officer/scheduled-requests/:id/reject — Reject scheduled pickup with reason */
router.post(
  '/scheduled-requests/:id/reject',
  writeLimiter,
  audited('scheduled_pickup_reject', 'scheduled_pickup_requests'),
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const body = z.object({ reason: z.string().min(3).max(300) }).parse(req.body);

    const item = await prisma.scheduledPickupRequest.findFirst({
      where: {
        id: req.params.id,
        ...(ids === null ? {} : { wardId: { in: ids } }),
      },
    });
    if (!item) throw new HttpError(404, 'Scheduled pickup request not found or not in your ward');

    const updated = await prisma.scheduledPickupRequest.update({
      where: { id: item.id },
      data: {
        status: 'REJECTED',
        rejectionReason: body.reason,
      },
    });

    // Notify citizen
    await notify({
      userId: item.citizenId,
      type: 'SYSTEM',
      title: `Scheduled Pickup Rejected (${item.code})`,
      body: `Your pickup for "${item.eventReason}" could not be accommodated: ${body.reason}`,
      payload: { requestId: item.id, code: item.code, reason: body.reason },
    });

    res.json({ ok: true, status: 'REJECTED', item: updated });
  })
);

/** POST /api/officer/scheduled-requests/:id/assign — Assign Driver & Vehicle */
router.post(
  '/scheduled-requests/:id/assign',
  writeLimiter,
  audited('scheduled_pickup_assign', 'scheduled_pickup_requests'),
  asyncHandler(async (req, res) => {
    const { ids } = await scope(req);
    const body = z
      .object({
        driverId: z.string(),
        vehicleId: z.string().optional(),
      })
      .parse(req.body);

    const item = await prisma.scheduledPickupRequest.findFirst({
      where: {
        id: req.params.id,
        ...(ids === null ? {} : { wardId: { in: ids } }),
      },
      include: { citizen: true },
    });
    if (!item) throw new HttpError(404, 'Scheduled pickup request not found or not in your ward');

    // Find driver & vehicle
    const driver = await prisma.user.findFirst({
      where: { id: body.driverId, role: 'DRIVER', isActive: true },
    });
    if (!driver) throw new HttpError(404, 'Driver account not found');

    const vehicle = body.vehicleId
      ? await prisma.vehicle.findUnique({ where: { id: body.vehicleId } })
      : await prisma.vehicle.findFirst({ where: { driverId: driver.id } });

    const updated = await prisma.scheduledPickupRequest.update({
      where: { id: item.id },
      data: {
        status: 'ASSIGNED',
        assignedDriverId: driver.id,
        assignedVehicleId: vehicle?.id ?? null,
        assignedById: req.user.id,
        assignedAt: new Date(),
      },
      include: {
        assignedDriver: { select: { id: true, name: true, phone: true } },
        assignedVehicle: { select: { id: true, registrationNumber: true, model: true } },
      },
    });

    // 1. Notify Citizen
    await notify({
      userId: item.citizenId,
      type: 'ASSIGNMENT',
      title: `Driver Assigned: ${item.code}`,
      body: `Driver ${driver.name} has been assigned for your pickup on ${new Date(item.scheduledDate).toLocaleDateString('en-IN')} (${item.scheduledTimeSlot}).`,
      payload: { requestId: item.id, code: item.code, driverName: driver.name },
    });

    // 2. Notify Driver (with scheduled date/time context)
    await notify({
      userId: driver.id,
      type: 'ASSIGNMENT',
      title: `New Scheduled Task (${item.code})`,
      body: `Scheduled pickup for ${item.citizen.name} on ${new Date(item.scheduledDate).toLocaleDateString('en-IN')} (${item.scheduledTimeSlot}) at ${item.address}.`,
      payload: {
        requestId: item.id,
        code: item.code,
        scheduledDate: item.scheduledDate,
        scheduledTimeSlot: item.scheduledTimeSlot,
        eventReason: item.eventReason,
        expectedCategories: item.expectedCategories,
      },
    });

    // Emit Socket.io event to driver room
    emitTo(`driver:${driver.id}`, 'new_task_assigned', {
      type: 'SCHEDULED_PICKUP',
      scheduledRequestId: item.id,
      code: item.code,
      scheduledDate: item.scheduledDate,
      scheduledTimeSlot: item.scheduledTimeSlot,
      eventReason: item.eventReason,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
    });

    res.json({ ok: true, status: 'ASSIGNED', item: updated });
  })
);

export default router;
