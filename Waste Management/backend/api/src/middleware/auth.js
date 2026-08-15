import { verifyAccessToken } from '../lib/tokens.js';
import { prisma } from '../lib/prisma.js';
import { ROLES, PORTALS, ROLE_PORTAL } from '../config/constants.js';

/**
 * Portal isolation (plan §3).
 *
 * `requirePortal('officer')` rejects any token whose audience is not the
 * officer portal — so a citizen token hitting /api/officer/* gets a 403, even
 * if someone crafts the request by hand. Admins are explicitly allowed into the
 * officer namespace because city-wide oversight is their job; nothing else
 * crosses.
 */

function readBearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export function requirePortal(portal) {
  return (req, res, next) => {
    const token = readBearer(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required', portal });
    }

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch (err) {
      const expired = err.name === 'TokenExpiredError';
      return res.status(401).json({ error: expired ? 'Session expired' : 'Invalid token', expired });
    }

    const tokenPortal = claims.portal || claims.aud;
    const adminIntoOfficer = tokenPortal === PORTALS.ADMIN && portal === PORTALS.OFFICER;

    if (tokenPortal !== portal && !adminIntoOfficer) {
      return res.status(403).json({
        error: `A ${tokenPortal} session cannot access the ${portal} API`,
        code: 'PORTAL_MISMATCH',
      });
    }
    if (ROLE_PORTAL[claims.role] !== tokenPortal) {
      return res.status(403).json({ error: 'Token role does not match its portal', code: 'CLAIM_MISMATCH' });
    }

    req.auth = claims;
    req.userId = claims.sub;
    return next();
  };
}

/** Narrow further inside a portal (e.g. admin-only routes in the admin API). */
export function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Authentication required' });
    if (!allowed.includes(req.auth.role)) {
      return res.status(403).json({ error: `Role ${req.auth.role} is not permitted here` });
    }
    return next();
  };
}

/** Loads the full user row when a handler needs more than the token claims. */
export async function loadUser(req, res, next) {
  if (!req.auth) return next();
  const user = await prisma.user.findUnique({
    where: { id: req.auth.sub },
    include: { ward: true, officerWards: { include: { ward: true } } },
  });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Account is not active' });
  }
  req.user = user;
  return next();
}

/** Attaches claims when present but never blocks — used for public stats. */
export function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (token) {
    try {
      req.auth = verifyAccessToken(token);
      req.userId = req.auth.sub;
    } catch {
      /* treated as guest */
    }
  }
  next();
}

/** The ward ids an officer may act on; admins are unrestricted (null). */
export async function officerWardIds(user) {
  if (!user) return [];
  if (user.role === ROLES.ADMIN) return null;
  const scoped = user.officerWards?.map((w) => w.wardId) ?? [];
  if (scoped.length) return scoped;
  return user.wardId ? [user.wardId] : [];
}

export default { requirePortal, requireRole, loadUser, optionalAuth, officerWardIds };
