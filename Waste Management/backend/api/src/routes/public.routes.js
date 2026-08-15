import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { prisma } from '../lib/prisma.js';
import { WASTE_CATEGORIES } from '../config/constants.js';

const router = Router();

/**
 * Landing-page impact counters. Aggregate only — no personal data, no auth.
 * These are what make the first screen real instead of decorative.
 */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const since = new Date(Date.now() - 30 * 864e5);
    const [total, resolved, wards, vehicles, citizens, recentResolved] = await Promise.all([
      prisma.complaint.count(),
      prisma.complaint.count({ where: { status: 'RESOLVED' } }),
      prisma.ward.count(),
      prisma.vehicle.count(),
      prisma.user.count({ where: { role: 'CITIZEN' } }),
      prisma.complaint.findMany({
        where: { resolvedAt: { gte: since } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    const avgMinutes = recentResolved.length
      ? Math.round(
          recentResolved.reduce((a, c) => a + (c.resolvedAt - c.createdAt) / 60_000, 0) / recentResolved.length
        )
      : 0;

    res.json({
      city: 'Gandhinagar',
      complaintsTotal: total,
      complaintsResolved: resolved,
      resolutionRatePct: total ? Math.round((resolved / total) * 100) : 0,
      avgResolutionHours: Number((avgMinutes / 60).toFixed(1)),
      wards,
      vehicles,
      citizens,
      updatedAt: new Date(),
    });
  })
);

/** Ward boundaries for the public map — geometry only. */
router.get(
  '/wards',
  asyncHandler(async (_req, res) => {
    const wards = await prisma.ward.findMany({
      select: { id: true, name: true, code: true, zone: true, boundary: true, centerLat: true, centerLng: true },
      orderBy: { code: 'asc' },
    });
    res.json({
      type: 'FeatureCollection',
      features: wards.map((w) => ({
        type: 'Feature',
        properties: { id: w.id, name: w.name, code: w.code, zone: w.zone, centerLat: w.centerLat, centerLng: w.centerLng },
        geometry: w.boundary,
      })),
    });
  })
);

router.get('/categories', (_req, res) => res.json(WASTE_CATEGORIES));

export default router;
