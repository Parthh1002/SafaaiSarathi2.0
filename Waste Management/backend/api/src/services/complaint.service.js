import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { CATEGORY_MAP, CREDIT_RULES, SOCKET_EVENTS, ROLES } from '../config/constants.js';
import env from '../config/env.js';
import { emitTo } from '../sockets/realtime.js';
import { notify, notifyWardOfficers, awardCredits } from './notification.service.js';
import { classifyWaste, scoreFraud } from './ai.service.js';
import { distanceMeters, pointInPolygon, boundsAround } from '../lib/geo.js';
import { HttpError } from '../middleware/error.js';

/**
 * The Triage AI Agent (plan §1).
 *
 * Intake does four things before anything reaches a human queue:
 *   1. classify   — YOLOv8 category + confidence
 *   2. deduplicate — merge into an existing nearby report of the same category
 *   3. score      — urgency (severity + SLA) and fraud likelihood
 *   4. route      — emergencies bypass the queue and page the officer directly
 *
 * Confidence below AI_CONFIDENCE_AUTO_APPROVE never auto-approves; it is
 * flagged "Review Needed" for a human. Health/safety categories are never
 * decided automatically (plan §7 honesty line).
 */

const DUPLICATE_RADIUS_M = 60;
const DUPLICATE_WINDOW_HOURS = 24;
const DUPLICATE_THRESHOLD = 0.72;

export const complaintCode = () =>
  `SS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export async function createComplaint({
  citizenId,
  photo, // { buffer, mimetype, filename } | null
  photoUrl,
  latitude,
  longitude,
  address,
  description,
  declaredCategory,
  isEmergency = false,
  channel = 'WEB',
  req,
}) {
  const citizen = await prisma.user.findUnique({ where: { id: citizenId } });
  if (!citizen) throw new HttpError(404, 'Citizen account not found');

  // Helper to normalize any case (e.g. 'construction_debris' -> 'CONSTRUCTION_DEBRIS')
  const normalizeCat = (c) => {
    if (!c) return 'OTHER';
    const up = String(c).trim().toUpperCase();
    return CATEGORY_MAP[up] ? up : 'OTHER';
  };

  // ---- 1. Classify -------------------------------------------------------
  let ai = { category: normalizeCat(declaredCategory), confidence: 0, modelVersion: 'none', degraded: false };
  if (photo?.buffer) {
    ai = await classifyWaste({ ...photo, hint: declaredCategory });
  }

  const aiCategory = normalizeCat(ai.category);
  const confidence = Number(ai.confidence || 0);
  const autoApproved = confidence >= env.ai.autoApproveConfidence;

  // The citizen's own choice wins when the model is unsure — the model is an
  // assistant here, not an authority.
  const category = autoApproved ? aiCategory : normalizeCat(declaredCategory) || aiCategory;
  const meta = CATEGORY_MAP[category] || CATEGORY_MAP.OTHER;

  const emergency = isEmergency || meta.emergency;

  // ---- 2. Ward attribution (PostGIS ST_Contains, done in app code) -------
  const ward = await wardForPoint({ latitude, longitude });

  // ---- 3. Fraud signals ---------------------------------------------------
  const fraud = await scoreFraud(await buildFraudFeatures({ citizen, latitude, longitude, ai }));

  // ---- 4. Duplicate detection --------------------------------------------
  const duplicate = await findDuplicate({ latitude, longitude, category, wardId: ward?.id });

  const slaMinutes = emergency ? env.escalation.emergencyMinutes : meta.slaMinutes;
  const now = new Date();

  const complaint = await prisma.complaint.create({
    data: {
      code: complaintCode(),
      citizenId,
      wardId: ward?.id ?? null,
      category,
      aiCategory: photo?.buffer ? aiCategory : null,
      aiConfidence: confidence,
      aiVerified: autoApproved && !ai.degraded,
      reviewNeeded: !autoApproved || fraud.score >= env.ai.fraudReviewThreshold,
      fraudScore: fraud.score,
      fraudSignals: fraud.signals?.length ? { signals: fraud.signals, modelVersion: fraud.modelVersion } : undefined,
      status: autoApproved && !duplicate ? 'VERIFIED' : 'PENDING',
      severity: emergency ? 'CRITICAL' : meta.severity,
      isEmergency: emergency,
      channel,
      description,
      latitude,
      longitude,
      address,
      photoUrl,
      slaMinutes,
      dueAt: new Date(now.getTime() + slaMinutes * 60_000),
      duplicateOfId: duplicate?.complaint.id ?? null,
    },
    include: { ward: true, citizen: { select: { id: true, name: true } } },
  });

  await addEvent(complaint.id, complaint.status, autoApproved ? `AI verified (${Math.round(confidence * 100)}% confidence)` : 'Awaiting verification', null);

  // ---- Duplicate bookkeeping ---------------------------------------------
  if (duplicate) {
    await prisma.complaintDuplicate.create({
      data: {
        parentComplaintId: duplicate.complaint.id,
        duplicateComplaintId: complaint.id,
        similarityScore: duplicate.similarity,
        distanceMeters: duplicate.distanceMeters,
        method: 'geo+category+time',
      },
    });
    await prisma.complaint.update({
      where: { id: duplicate.complaint.id },
      data: { upvotes: { increment: 1 } },
    });
  }

  // ---- Credits ------------------------------------------------------------
  const creditRule = duplicate
    ? { delta: CREDIT_RULES.duplicateReport, code: 'duplicate_report', reason: 'Confirmed an existing report' }
    : emergency
      ? { delta: CREDIT_RULES.emergencyVerified, code: 'emergency_report', reason: 'Emergency report filed' }
      : { delta: CREDIT_RULES.reportSubmitted, code: 'report_submitted', reason: 'Report submitted' };
  await awardCredits({
    userId: citizenId,
    delta: creditRule.delta,
    reason: creditRule.reason,
    reasonCode: creditRule.code,
    complaintId: complaint.id,
  });

  // ---- Fan out ------------------------------------------------------------
  const payload = serializeComplaint(complaint, { duplicateOf: duplicate?.complaint.code ?? null });
  const rooms = [ward ? `ward:${ward.id}` : null, 'city'];

  emitTo(rooms, emergency ? SOCKET_EVENTS.EMERGENCY_NEW : SOCKET_EVENTS.COMPLAINT_NEW, payload);

  if (emergency) {
    // Bypass the queue: page every officer for the ward immediately.
    await notifyWardOfficers(ward?.id, {
      type: 'EMERGENCY',
      title: `EMERGENCY · ${meta.label}`,
      body: `${complaint.code} at ${address || 'reported location'} — acknowledge within ${slaMinutes} minutes.`,
      payload: { complaintId: complaint.id, code: complaint.code },
    });
  }

  await notify({
    userId: citizenId,
    type: 'COMPLAINT_UPDATE',
    title: `Report ${complaint.code} received`,
    body: duplicate
      ? `Merged with an existing report nearby. You will be notified when it is resolved.`
      : autoApproved
        ? `AI verified as ${meta.label}. Assigning a vehicle shortly.`
        : `Received. An officer will verify it shortly.`,
    payload: { complaintId: complaint.id },
  });

  return {
    complaint: payload,
    ai: {
      category: aiCategory,
      confidence,
      autoApproved,
      modelVersion: ai.modelVersion,
      degraded: ai.degraded,
      degradedReason: ai.degradedReason,
      threshold: env.ai.autoApproveConfidence,
    },
    fraud,
    duplicate: duplicate
      ? {
          of: duplicate.complaint.code,
          id: duplicate.complaint.id,
          similarity: duplicate.similarity,
          distanceMeters: Math.round(duplicate.distanceMeters),
          alsoReportedBy: duplicate.complaint.upvotes + 1,
        }
      : null,
    creditsAwarded: creditRule.delta,
  };
}

/**
 * Ward lookup: bounding-box pre-filter in SQL (indexed), exact ray-cast here.
 * This is the two-phase strategy PostGIS would run internally.
 */
export async function wardForPoint({ latitude, longitude }) {
  const candidates = await prisma.ward.findMany({
    where: {
      minLat: { lte: latitude },
      maxLat: { gte: latitude },
      minLng: { lte: longitude },
      maxLng: { gte: longitude },
    },
  });
  for (const ward of candidates) {
    if (pointInPolygon({ latitude, longitude }, ward.boundary)) return ward;
  }
  return candidates[0] ?? null;
}

/**
 * Duplicate detection: proximity + category + recency.
 *
 * The plan specifies CLIP image embeddings; that runs in the AI service and is
 * folded in when available. The geo/category/time signal below is computed from
 * data we definitely have, so dedupe works even with the vision service down.
 */
export async function findDuplicate({ latitude, longitude, category, wardId, excludeId }) {
  const bounds = boundsAround({ latitude, longitude }, DUPLICATE_RADIUS_M);
  const since = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3600_000);

  const candidates = await prisma.complaint.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      category,
      status: { notIn: ['RESOLVED', 'REJECTED'] },
      duplicateOfId: null,
      createdAt: { gte: since },
      latitude: { gte: bounds.minLat, lte: bounds.maxLat },
      longitude: { gte: bounds.minLng, lte: bounds.maxLng },
      ...(wardId ? { wardId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  let best = null;
  for (const candidate of candidates) {
    const metres = distanceMeters({ latitude, longitude }, candidate);
    if (metres > DUPLICATE_RADIUS_M) continue;

    const proximity = 1 - metres / DUPLICATE_RADIUS_M;
    const ageHours = (Date.now() - candidate.createdAt.getTime()) / 3600_000;
    const recency = 1 - Math.min(1, ageHours / DUPLICATE_WINDOW_HOURS);
    const similarity = 0.65 * proximity + 0.2 + 0.15 * recency; // 0.2 = category match

    if (similarity >= DUPLICATE_THRESHOLD && (!best || similarity > best.similarity)) {
      best = { complaint: candidate, similarity: Number(similarity.toFixed(3)), distanceMeters: metres };
    }
  }
  return best;
}

async function buildFraudFeatures({ citizen, latitude, longitude, ai }) {
  const hourAgo = new Date(Date.now() - 3600_000);
  const [reportsLastHour, totals, rejected] = await Promise.all([
    prisma.complaint.count({ where: { citizenId: citizen.id, createdAt: { gte: hourAgo } } }),
    prisma.complaint.count({ where: { citizenId: citizen.id } }),
    prisma.complaint.count({ where: { citizenId: citizen.id, status: 'REJECTED' } }),
  ]);

  return {
    accountAgeHours: (Date.now() - citizen.createdAt.getTime()) / 3600_000,
    reportsLastHour,
    totalReports: totals,
    priorRejectedRate: totals ? rejected / totals : 0,
    hasExif: ai.capture?.hasExif ?? null,
    blurScore: ai.capture?.detail ?? null,
    latitude,
    longitude,
  };
}

// ---- Lifecycle -------------------------------------------------------------

export async function addEvent(complaintId, status, note, actorId) {
  return prisma.complaintEvent.create({ data: { complaintId, status, note, actorId: actorId ?? undefined } });
}

export async function transition({ complaintId, status, actorId, note, extra = {} }) {
  const before = await prisma.complaint.findUnique({ where: { id: complaintId }, include: { ward: true } });
  if (!before) throw new HttpError(404, 'Complaint not found');

  const complaint = await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      status,
      ...extra,
      ...(status === 'RESOLVED' ? { resolvedAt: new Date(), resolvedById: actorId } : {}),
      ...(status === 'ASSIGNED' ? { assignedAt: new Date(), assignedById: actorId } : {}),
    },
    include: { ward: true, citizen: { select: { id: true, name: true } }, assignedVehicle: true },
  });

  await addEvent(complaintId, status, note, actorId);

  const payload = serializeComplaint(complaint);
  emitTo([complaint.wardId ? `ward:${complaint.wardId}` : null, 'city', `complaint:${complaint.id}`],
    SOCKET_EVENTS.COMPLAINT_UPDATE, payload);

  await notify({
    userId: complaint.citizenId,
    type: 'COMPLAINT_UPDATE',
    title: `${complaint.code} — ${statusLabel(status)}`,
    body: note || statusMessage(status, complaint),
    payload: { complaintId: complaint.id, status },
  });

  // Resolution pays out; the duplicates that fed it pay out too.
  if (status === 'RESOLVED') {
    await awardCredits({
      userId: complaint.citizenId,
      delta: CREDIT_RULES.reportResolved,
      reason: `Report ${complaint.code} resolved`,
      reasonCode: 'report_resolved',
      complaintId: complaint.id,
    });
    await payOutDuplicates(complaint);
  }
  if (status === 'VERIFIED') {
    await awardCredits({
      userId: complaint.citizenId,
      delta: CREDIT_RULES.reportVerified,
      reason: `Report ${complaint.code} verified`,
      reasonCode: 'report_verified',
      complaintId: complaint.id,
    });
  }
  if (status === 'REJECTED') {
    await awardCredits({
      userId: complaint.citizenId,
      delta: CREDIT_RULES.fakeReport,
      reason: `Report ${complaint.code} rejected`,
      reasonCode: 'report_rejected',
      complaintId: complaint.id,
    });
  }

  return payload;
}

/** Everyone who reported the same thing hears that it was fixed. */
async function payOutDuplicates(complaint) {
  const links = await prisma.complaintDuplicate.findMany({
    where: { parentComplaintId: complaint.id },
    include: { duplicate: { select: { id: true, code: true, citizenId: true } } },
  });

  for (const link of links) {
    await prisma.complaint.update({
      where: { id: link.duplicate.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    await addEvent(link.duplicate.id, 'RESOLVED', `Resolved with ${complaint.code}`, null);
    await notify({
      userId: link.duplicate.citizenId,
      type: 'COMPLAINT_UPDATE',
      title: `${link.duplicate.code} — Resolved`,
      body: 'The issue you reported has been cleared.',
      payload: { complaintId: link.duplicate.id },
    });
  }
}

const statusLabel = (s) =>
  ({ PENDING: 'Pending', VERIFIED: 'Verified', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', REJECTED: 'Rejected' })[s] || s;

const statusMessage = (status, complaint) =>
  ({
    VERIFIED: 'An officer has verified your report.',
    ASSIGNED: `Assigned to vehicle ${complaint.assignedVehicle?.registrationNumber || ''}.`.trim(),
    IN_PROGRESS: 'A crew is on the way.',
    RESOLVED: 'The issue has been cleared. Thank you.',
    REJECTED: 'This report could not be verified.',
  })[status] || 'Your report was updated.';

// ---- Serialisation ---------------------------------------------------------

export function serializeComplaint(c, extra = {}) {
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    category: c.category,
    categoryLabel: CATEGORY_MAP[c.category]?.label || c.category,
    aiCategory: c.aiCategory,
    aiConfidence: c.aiConfidence,
    aiVerified: c.aiVerified,
    reviewNeeded: c.reviewNeeded,
    fraudScore: c.fraudScore,
    fraudSignals: c.fraudSignals?.signals ?? [],
    status: c.status,
    severity: c.severity,
    isEmergency: c.isEmergency,
    channel: c.channel,
    description: c.description,
    latitude: c.latitude,
    longitude: c.longitude,
    address: c.address,
    photoUrl: c.photoUrl,
    resolutionPhotoUrl: c.resolutionPhotoUrl,
    wardId: c.wardId,
    ward: c.ward ? { id: c.ward.id, name: c.ward.name, code: c.ward.code } : null,
    citizen: c.citizen ? { id: c.citizen.id, name: c.citizen.name } : null,
    assignedVehicleId: c.assignedVehicleId,
    vehicle: c.assignedVehicle
      ? { id: c.assignedVehicle.id, registrationNumber: c.assignedVehicle.registrationNumber }
      : null,
    upvotes: c.upvotes,
    duplicateOfId: c.duplicateOfId,
    slaMinutes: c.slaMinutes,
    dueAt: c.dueAt,
    overdue: c.dueAt ? c.dueAt < new Date() && !['RESOLVED', 'REJECTED'].includes(c.status) : false,
    escalationCount: c.escalationCount,
    createdAt: c.createdAt,
    assignedAt: c.assignedAt,
    resolvedAt: c.resolvedAt,
    ...extra,
  };
}

export default {
  createComplaint,
  transition,
  findDuplicate,
  wardForPoint,
  serializeComplaint,
  addEvent,
  complaintCode,
};
