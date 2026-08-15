import { prisma } from '../lib/prisma.js';
import env from '../config/env.js';
import { emitTo, SOCKET_EVENTS } from '../sockets/realtime.js';
import { notify, notifyWardOfficers } from './notification.service.js';
import { serializeComplaint } from './complaint.service.js';
import { ROLES } from '../config/constants.js';

/**
 * Auto-escalation (plan §2.3 — "30-min auto-escalation countdown").
 *
 * Level 1: unacknowledged past its SLA  -> every officer on the ward
 * Level 2: still open at 2x SLA         -> super admins
 *
 * A sweep runs on a timer rather than a per-complaint setTimeout, so restarts
 * cannot silently drop a pending escalation.
 */

const SWEEP_INTERVAL_MS = 60_000;
let timer = null;
let stats = { sweeps: 0, escalated: 0, lastRunAt: null };

export function escalationStatus() {
  return { ...stats, running: Boolean(timer), intervalMs: SWEEP_INTERVAL_MS };
}

export function startEscalationWatcher() {
  if (timer) return escalationStatus();
  timer = setInterval(() => {
    sweep().catch((err) => console.error('[escalation]', err.message));
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  console.log('[escalation] watcher started');
  return escalationStatus();
}

export function stopEscalationWatcher() {
  if (timer) clearInterval(timer);
  timer = null;
  return escalationStatus();
}

export async function sweep() {
  stats.sweeps += 1;
  stats.lastRunAt = new Date();
  const now = new Date();

  const overdue = await prisma.complaint.findMany({
    where: {
      status: { in: ['PENDING', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'] },
      dueAt: { lt: now },
      escalationCount: { lt: 2 },
    },
    include: { ward: true, citizen: { select: { id: true, name: true } }, assignedVehicle: true },
    take: 100,
  });

  for (const complaint of overdue) {
    const overdueMinutes = Math.round((now - complaint.dueAt) / 60_000);
    const level = complaint.escalationCount + 1;
    const reason =
      level === 1
        ? `Unresolved ${overdueMinutes} min past its ${complaint.slaMinutes} min SLA`
        : `Still open at twice its SLA (${overdueMinutes} min overdue)`;

    // Level 2 only once the complaint is genuinely at 2x its SLA.
    if (level === 2 && overdueMinutes < complaint.slaMinutes) continue;

    await escalate(complaint, level, reason);
  }

  return stats;
}

export async function escalate(complaint, level, reason) {
  const target = await pickEscalationTarget(complaint, level);

  await prisma.escalation.create({
    data: {
      complaintId: complaint.id,
      escalatedToId: target?.id ?? null,
      level,
      reason,
    },
  });

  const updated = await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      escalationCount: level,
      severity: level >= 2 ? 'CRITICAL' : complaint.severity === 'LOW' ? 'MEDIUM' : complaint.severity,
    },
    include: { ward: true, citizen: { select: { id: true, name: true } }, assignedVehicle: true },
  });

  stats.escalated += 1;

  const payload = {
    ...serializeComplaint(updated),
    escalation: { level, reason, escalatedTo: target ? { id: target.id, name: target.name, role: target.role } : null },
  };

  emitTo([complaint.wardId ? `ward:${complaint.wardId}` : null, 'city'], SOCKET_EVENTS.ESCALATION_NEW, payload);

  if (target) {
    await notify({
      userId: target.id,
      type: 'ESCALATION',
      title: `Escalation L${level} · ${complaint.code}`,
      body: reason,
      payload: { complaintId: complaint.id, level },
    });
  } else if (complaint.wardId) {
    await notifyWardOfficers(complaint.wardId, {
      type: 'ESCALATION',
      title: `Escalation L${level} · ${complaint.code}`,
      body: reason,
      payload: { complaintId: complaint.id, level },
    });
  }

  return payload;
}

/** L1 goes to the ward's primary officer, L2 to a super admin. */
async function pickEscalationTarget(complaint, level) {
  if (level >= 2) {
    return prisma.user.findFirst({ where: { role: ROLES.ADMIN, isActive: true }, orderBy: { createdAt: 'asc' } });
  }
  if (!complaint.wardId) return null;

  const primary = await prisma.wardOfficer.findFirst({
    where: { wardId: complaint.wardId, isPrimary: true },
    include: { officer: true },
  });
  if (primary?.officer?.isActive) return primary.officer;

  const any = await prisma.wardOfficer.findFirst({
    where: { wardId: complaint.wardId },
    include: { officer: true },
  });
  return any?.officer ?? null;
}

/** Countdown for the officer's emergency panel. */
export function slaCountdown(complaint) {
  if (!complaint.dueAt) return null;
  const msLeft = new Date(complaint.dueAt).getTime() - Date.now();
  return {
    dueAt: complaint.dueAt,
    minutesLeft: Math.round(msLeft / 60_000),
    overdue: msLeft < 0,
    pctElapsed: Math.min(
      100,
      Math.round(
        ((Date.now() - new Date(complaint.createdAt).getTime()) / (complaint.slaMinutes * 60_000)) * 100
      )
    ),
  };
}

export { env };
export default { startEscalationWatcher, stopEscalationWatcher, sweep, escalate, slaCountdown, escalationStatus };
