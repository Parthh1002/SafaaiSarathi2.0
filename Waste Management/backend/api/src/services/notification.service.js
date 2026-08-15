import { prisma } from '../lib/prisma.js';
import { emit, emitTo, SOCKET_EVENTS } from '../sockets/realtime.js';
import { CREDIT_RULES } from '../config/constants.js';

/**
 * In-app notifications. Expo Push / Web Push plug in at `dispatchExternal` —
 * the record and the socket delivery are the same either way.
 */
export async function notify({ userId, type, title, body, payload }) {
  if (!userId) return null;

  const row = await prisma.notification.create({
    data: { userId, type, title, body, payload: payload ?? undefined },
  });

  emit(
    SOCKET_EVENTS.NOTIFICATION,
    {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      payload: row.payload,
      createdAt: row.createdAt,
    },
    `user:${userId}`
  );

  await dispatchExternal(userId, row);
  return row;
}

/** Notify every officer scoped to a ward, plus admins. */
export async function notifyWardOfficers(wardId, notification) {
  const officers = await prisma.wardOfficer.findMany({ where: { wardId }, select: { officerId: true } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });

  const ids = [...new Set([...officers.map((o) => o.officerId), ...admins.map((a) => a.id)])];
  await Promise.all(ids.map((userId) => notify({ ...notification, userId })));
  return ids.length;
}

/**
 * Expo Push (native) and Web Push/VAPID (browser) go here. Logged for now so
 * the flow is visible end to end without external credentials — the plan calls
 * for Expo's free push service, which needs a device token we do not have yet.
 */
async function dispatchExternal(userId, row) {
  if (process.env.NODE_ENV === 'production') return;
  console.log(`[push] -> user:${userId} [${row.type}] ${row.title}`);
}

// ---- Green credits ---------------------------------------------------------

export async function awardCredits({ userId, delta, reason, reasonCode, complaintId }) {
  if (!userId || !delta) return null;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { greenCredits: { increment: delta } },
    select: { greenCredits: true },
  });

  const entry = await prisma.greenCredit.create({
    data: {
      userId,
      delta,
      balanceAfter: user.greenCredits,
      reason,
      reasonCode,
      complaintId: complaintId ?? undefined,
    },
  });

  emit(
    SOCKET_EVENTS.NOTIFICATION,
    { type: 'CREDIT_AWARDED', delta, balance: user.greenCredits, reason },
    `user:${userId}`
  );

  return entry;
}

export { CREDIT_RULES, emitTo };
export default { notify, notifyWardOfficers, awardCredits, CREDIT_RULES };
