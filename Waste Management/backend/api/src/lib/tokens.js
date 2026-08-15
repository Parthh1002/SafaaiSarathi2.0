import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { prisma } from './prisma.js';
import { randomToken, hashToken } from './password.js';
import { ROLE_PORTAL } from '../config/constants.js';

/**
 * Token minting and rotation (plan §6.1, §6.3).
 *
 * The access token carries a signed `role` claim AND an `aud` (audience) set to
 * the portal it was minted for. Middleware checks `aud` against the API
 * namespace being called, which is what makes a citizen token bounce off
 * /api/officer/* with a 403 instead of a redirect.
 */

export const REFRESH_COOKIE = 'ss_refresh';

export function signAccessToken(user) {
  const portal = ROLE_PORTAL[user.role];
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      wardId: user.wardId ?? null,
      portal,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl, audience: portal, issuer: 'safaai-sarathi' }
  );
}

export function verifyAccessToken(token, expectedPortal) {
  return jwt.verify(token, env.jwt.accessSecret, {
    issuer: 'safaai-sarathi',
    ...(expectedPortal ? { audience: expectedPortal } : {}),
  });
}

/**
 * Issues a refresh token, stores only its hash, and records the device.
 * Rotation happens in `rotateRefreshToken`; the old row is marked revoked and
 * linked to its replacement so a stolen-token replay is detectable.
 */
export async function issueRefreshToken(user, { userAgent, ip, replacesId } = {}) {
  const token = randomToken(48);
  const expiresAt = new Date(Date.now() + env.jwt.refreshTtlDays * 864e5);

  const row = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: userAgent?.slice(0, 255),
      ip,
    },
  });

  if (replacesId) {
    await prisma.refreshToken.update({
      where: { id: replacesId },
      data: { revokedAt: new Date(), replacedById: row.id },
    });
  }

  return { token, expiresAt, id: row.id };
}

export async function rotateRefreshToken(rawToken, context = {}) {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing) return { error: 'invalid' };
  if (existing.revokedAt) {
    // Re-use of a rotated token: treat the whole family as compromised.
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { error: 'reused' };
  }
  if (existing.expiresAt < new Date()) return { error: 'expired' };
  if (!existing.user.isActive) return { error: 'inactive' };

  const next = await issueRefreshToken(existing.user, { ...context, replacesId: existing.id });
  return { user: existing.user, refresh: next };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** httpOnly + Secure + SameSite=Strict, exactly as the plan specifies. */
export function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    expires: expiresAt,
    path: '/api/auth',
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: '/api/auth',
  });
}

export default {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllSessions,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE,
};
