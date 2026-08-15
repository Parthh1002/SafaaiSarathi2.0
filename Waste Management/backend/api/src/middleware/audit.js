import { prisma } from '../lib/prisma.js';

/**
 * Immutable audit trail (plan §2.4, §6.3): who did what, when, before/after.
 * Only privileged actions are recorded — assignment, escalation override, role
 * changes, account deactivation, settings edits.
 */
export async function recordAudit({ actorId, action, targetTable, targetId, before, after, req }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action,
        targetTable,
        targetId: targetId ? String(targetId) : null,
        before: before ?? undefined,
        after: after ?? undefined,
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent']?.slice(0, 255),
      },
    });
  } catch (err) {
    // An audit write must never break the operation it is describing, but a
    // silent failure would be worse — surface it in the logs.
    console.error('[audit] failed to record', action, err.message);
  }
}

/** Route wrapper: audits automatically when the handler responds 2xx. */
export function audited(action, targetTable, resolveTargetId = (req, body) => body?.id || req.params.id) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        recordAudit({
          actorId: req.auth?.sub,
          action,
          targetTable,
          targetId: resolveTargetId(req, body),
          after: body,
          req,
        });
      }
      return originalJson(body);
    };
    next();
  };
}

export default { recordAudit, audited };
