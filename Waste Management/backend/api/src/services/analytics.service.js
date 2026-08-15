import { prisma } from '../lib/prisma.js';
import { CATEGORY_MAP } from '../config/constants.js';
import { predictHotspots } from './ai.service.js';

/**
 * Every dashboard number is derived here from real rows — no dashboard card
 * reads a hard-coded constant.
 */

const startOfDay = (offsetDays = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d;
};
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const pctChange = (a, b) => (b ? Number((((a - b) / b) * 100).toFixed(1)) : 0);
const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

/** Scope helper: officers see their wards, admins see everything. */
const wardScope = (wardIds) => (wardIds === null ? {} : { wardId: { in: wardIds } });

export async function overview(wardIds) {
  const scope = wardScope(wardIds);
  const today = startOfDay();
  const yesterday = startOfDay(1);

  const [todayComplaints, yesterdayComplaints, open, vehicles, emergencies, resolvedRecent] = await Promise.all([
    prisma.complaint.count({ where: { ...scope, createdAt: { gte: today } } }),
    prisma.complaint.count({ where: { ...scope, createdAt: { gte: yesterday, lt: today } } }),
    prisma.complaint.findMany({
      where: { ...scope, status: { notIn: ['RESOLVED', 'REJECTED'] } },
      select: { id: true, severity: true, isEmergency: true, dueAt: true, reviewNeeded: true, status: true },
    }),
    prisma.vehicle.findMany({
      where: wardIds === null ? {} : { wardId: { in: wardIds } },
      select: { id: true, status: true, lastPingAt: true, maintenanceFlag: true },
    }),
    prisma.complaint.count({
      where: { ...scope, isEmergency: true, status: { notIn: ['RESOLVED', 'REJECTED'] } },
    }),
    prisma.complaint.findMany({
      where: { ...scope, resolvedAt: { gte: startOfDay(6) } },
      select: { createdAt: true, resolvedAt: true, dueAt: true },
    }),
  ]);

  const now = Date.now();
  const resolutionMinutes = resolvedRecent.map((c) => (c.resolvedAt - c.createdAt) / 60_000);
  const withinSla = resolvedRecent.filter((c) => !c.dueAt || c.resolvedAt <= c.dueAt).length;

  return {
    generatedAt: new Date(),
    kpis: {
      complaintsToday: todayComplaints,
      complaintsDeltaPct: pctChange(todayComplaints, yesterdayComplaints),
      openComplaints: open.length,
      overdue: open.filter((c) => c.dueAt && c.dueAt.getTime() < now).length,
      reviewNeeded: open.filter((c) => c.reviewNeeded).length,
      emergenciesOpen: emergencies,
      critical: open.filter((c) => c.severity === 'CRITICAL').length,
      unassigned: open.filter((c) => c.status === 'PENDING' || c.status === 'VERIFIED').length,
      vehiclesTotal: vehicles.length,
      vehiclesOnRoute: vehicles.filter((v) => v.status === 'ON_ROUTE').length,
      vehiclesOnline: vehicles.filter((v) => v.lastPingAt && now - v.lastPingAt.getTime() < 60_000).length,
      vehiclesMaintenance: vehicles.filter((v) => v.maintenanceFlag).length,
      resolvedLast7Days: resolvedRecent.length,
      avgResolutionMinutes: Math.round(avg(resolutionMinutes)),
      slaCompliancePct: resolvedRecent.length ? Math.round((withinSla / resolvedRecent.length) * 100) : 0,
    },
  };
}

export async function statusBreakdown(wardIds) {
  const rows = await prisma.complaint.groupBy({
    by: ['status'],
    where: wardScope(wardIds),
    _count: { _all: true },
  });
  return rows.map((r) => ({ status: r.status, count: r._count._all }));
}

export async function categoryBreakdown(wardIds, days = 7) {
  const rows = await prisma.complaint.groupBy({
    by: ['category'],
    where: { ...wardScope(wardIds), createdAt: { gte: startOfDay(days - 1) } },
    _count: { _all: true },
  });
  const total = rows.reduce((a, r) => a + r._count._all, 0) || 1;
  return rows
    .map((r) => ({
      category: r.category,
      label: CATEGORY_MAP[r.category]?.label || r.category,
      count: r._count._all,
      pct: Number(((r._count._all / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count);
}

export async function trends(wardIds, days = 14) {
  const from = startOfDay(days - 1);
  const complaints = await prisma.complaint.findMany({
    where: { ...wardScope(wardIds), createdAt: { gte: from } },
    select: { createdAt: true, resolvedAt: true, isEmergency: true, dueAt: true },
  });

  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = startOfDay(i);
    const end = startOfDay(i - 1);
    const reported = complaints.filter((c) => c.createdAt >= start && c.createdAt < end);
    const resolved = complaints.filter((c) => c.resolvedAt && c.resolvedAt >= start && c.resolvedAt < end);
    const onTime = resolved.filter((c) => !c.dueAt || c.resolvedAt <= c.dueAt).length;

    buckets.push({
      date: dayKey(start),
      label: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      weekday: start.toLocaleDateString('en-IN', { weekday: 'short' }),
      reported: reported.length,
      resolved: resolved.length,
      emergencies: reported.filter((c) => c.isEmergency).length,
      slaPct: resolved.length ? Math.round((onTime / resolved.length) * 100) : null,
    });
  }
  return buckets;
}

export async function wardPerformance(wardIds) {
  const wards = await prisma.ward.findMany({
    where: wardIds === null ? {} : { id: { in: wardIds } },
    orderBy: { code: 'asc' },
  });
  const since = startOfDay(6);

  const results = [];
  for (const ward of wards) {
    const [open, recent, vehicles] = await Promise.all([
      prisma.complaint.count({ where: { wardId: ward.id, status: { notIn: ['RESOLVED', 'REJECTED'] } } }),
      prisma.complaint.findMany({
        where: { wardId: ward.id, createdAt: { gte: since } },
        select: { createdAt: true, resolvedAt: true, dueAt: true, isEmergency: true, severity: true },
      }),
      prisma.vehicle.count({ where: { wardId: ward.id } }),
    ]);

    const resolved = recent.filter((c) => c.resolvedAt);
    const onTime = resolved.filter((c) => !c.dueAt || c.resolvedAt <= c.dueAt).length;

    results.push({
      id: ward.id,
      name: ward.name,
      code: ward.code,
      zone: ward.zone,
      center: { latitude: ward.centerLat, longitude: ward.centerLng },
      boundary: ward.boundary,
      population: ward.population,
      openComplaints: open,
      reported7d: recent.length,
      resolved7d: resolved.length,
      emergencies7d: recent.filter((c) => c.isEmergency).length,
      critical: recent.filter((c) => c.severity === 'CRITICAL').length,
      slaCompliancePct: resolved.length ? Math.round((onTime / resolved.length) * 100) : 0,
      avgResolutionMinutes: Math.round(avg(resolved.map((c) => (c.resolvedAt - c.createdAt) / 60_000))),
      vehicles,
      /** 0-100 pressure score — drives the heatmap colour ramp. */
      load: Math.min(100, Math.round(open * 6 + recent.filter((c) => c.isEmergency).length * 12)),
    });
  }
  return results;
}

/** Complaint points for the officer heatmap, already filtered to their scope. */
export async function heatmapPoints(wardIds, { days = 14, status } = {}) {
  const complaints = await prisma.complaint.findMany({
    where: {
      ...wardScope(wardIds),
      createdAt: { gte: startOfDay(days - 1) },
      ...(status ? { status } : {}),
      duplicateOfId: null,
    },
    select: {
      id: true,
      code: true,
      latitude: true,
      longitude: true,
      category: true,
      severity: true,
      status: true,
      isEmergency: true,
      upvotes: true,
      createdAt: true,
    },
    take: 2000,
  });

  return complaints.map((c) => ({
    ...c,
    // Weight duplicates up: five people reporting one pile matters more.
    weight: (c.isEmergency ? 3 : 1) + Math.min(4, c.upvotes),
  }));
}

/**
 * Hotspot forecast. Aggregates real history and hands it to the model service;
 * if that is down, a seasonal-naive baseline computed here still produces a
 * usable forecast rather than an empty panel.
 */
export async function hotspotForecast(wardIds, forDate) {
  const target = forDate || dayKey(startOfDay(-1));
  const wards = await prisma.ward.findMany({ where: wardIds === null ? {} : { id: { in: wardIds } } });

  const history = await prisma.complaint.findMany({
    where: { ...wardScope(wardIds), createdAt: { gte: startOfDay(60) } },
    select: { wardId: true, createdAt: true, category: true, isEmergency: true },
  });

  const series = wards.map((w) => ({
    wardId: w.id,
    name: w.name,
    counts: bucketByDay(history.filter((h) => h.wardId === w.id)),
  }));

  const remote = await predictHotspots({ forDate: target, series });
  if (!remote.degraded && remote.predictions?.length) {
    await persistPredictions(remote.predictions, target, remote.modelVersion);
    return { forDate: target, modelVersion: remote.modelVersion, source: 'ai-service', predictions: remote.predictions };
  }

  const predictions = series.map((s) => baselineForecast(s, target));
  await persistPredictions(predictions, target, 'baseline-seasonal-v1');
  return {
    forDate: target,
    modelVersion: 'baseline-seasonal-v1',
    source: 'api-fallback',
    note: 'Model service unavailable — seasonal baseline used.',
    predictions,
  };
}

function bucketByDay(rows) {
  const counts = {};
  for (const row of rows) {
    const key = dayKey(row.createdAt);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * Seasonal-naive with recency weighting: the same weekday over recent weeks,
 * weighted so last week counts more than five weeks ago. A real baseline, not
 * a random number — and it is labelled as a baseline in the response.
 */
function baselineForecast(series, forDate) {
  const targetWeekday = new Date(forDate).getDay();
  const samples = [];

  for (const [date, count] of Object.entries(series.counts)) {
    const d = new Date(date);
    if (d.getDay() !== targetWeekday) continue;
    const ageWeeks = (Date.now() - d.getTime()) / (7 * 864e5);
    samples.push({ count, weight: Math.exp(-ageWeeks / 3) });
  }

  const totalWeight = samples.reduce((a, s) => a + s.weight, 0);
  const predicted = totalWeight ? samples.reduce((a, s) => a + s.count * s.weight, 0) / totalWeight : 0;

  const allCounts = Object.values(series.counts);
  const mean = avg(allCounts);
  const risk = Math.min(100, Math.round((predicted / Math.max(1, mean || 1)) * 45 + Math.min(predicted, 12) * 4));

  return {
    wardId: series.wardId,
    name: series.name,
    predictedCount: Number(predicted.toFixed(1)),
    riskScore: risk,
    confidence: samples.length >= 4 ? 0.62 : samples.length >= 2 ? 0.4 : 0.2,
    drivers: [
      { feature: 'same_weekday_history', value: Number(predicted.toFixed(1)) },
      { feature: 'ward_daily_mean', value: Number(mean.toFixed(1)) },
      { feature: 'samples', value: samples.length },
    ],
  };
}

async function persistPredictions(predictions, forDate, modelVersion) {
  for (const p of predictions) {
    if (!p.wardId) continue;
    await prisma.hotspotPrediction.upsert({
      where: { wardId_forDate: { wardId: p.wardId, forDate } },
      create: {
        wardId: p.wardId,
        forDate,
        predictedCount: p.predictedCount,
        riskScore: p.riskScore,
        confidence: p.confidence ?? 0,
        drivers: p.drivers ?? undefined,
        modelVersion,
      },
      update: {
        predictedCount: p.predictedCount,
        riskScore: p.riskScore,
        confidence: p.confidence ?? 0,
        drivers: p.drivers ?? undefined,
        modelVersion,
      },
    });
  }
}

/** AI model health panel (plan §2.4). */
export async function modelHealth(days = 14) {
  const since = startOfDay(days - 1);
  const rows = await prisma.complaint.findMany({
    where: { createdAt: { gte: since }, aiCategory: { not: null } },
    select: { aiConfidence: true, reviewNeeded: true, status: true, category: true, aiCategory: true, createdAt: true },
  });

  const byDay = {};
  for (const r of rows) {
    const key = dayKey(r.createdAt);
    byDay[key] = byDay[key] || { date: key, confidences: [], lowConfidence: 0, rejected: 0, agreed: 0, total: 0 };
    byDay[key].confidences.push(r.aiConfidence);
    byDay[key].total += 1;
    if (r.reviewNeeded) byDay[key].lowConfidence += 1;
    if (r.status === 'REJECTED') byDay[key].rejected += 1;
    if (r.category === r.aiCategory) byDay[key].agreed += 1;
  }

  const daily = Object.values(byDay)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      samples: d.total,
      avgConfidence: Number(avg(d.confidences).toFixed(3)),
      lowConfidenceRate: Number((d.lowConfidence / d.total).toFixed(3)),
      humanAgreementRate: Number((d.agreed / d.total).toFixed(3)),
      rejectedRate: Number((d.rejected / d.total).toFixed(3)),
    }));

  return {
    windowDays: days,
    samples: rows.length,
    avgConfidence: Number(avg(rows.map((r) => r.aiConfidence)).toFixed(3)),
    lowConfidenceRate: rows.length ? Number((rows.filter((r) => r.reviewNeeded).length / rows.length).toFixed(3)) : 0,
    humanAgreementRate: rows.length
      ? Number((rows.filter((r) => r.category === r.aiCategory).length / rows.length).toFixed(3))
      : 0,
    daily,
    retrainingSuggested: daily.slice(-3).every((d) => d.lowConfidenceRate > 0.4),
  };
}

export { startOfDay, dayKey };
export default {
  overview,
  statusBreakdown,
  categoryBreakdown,
  trends,
  wardPerformance,
  heatmapPoints,
  hotspotForecast,
  modelHealth,
};
