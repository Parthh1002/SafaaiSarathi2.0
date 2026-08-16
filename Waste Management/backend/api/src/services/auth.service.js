import { authenticator } from 'otplib';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword, randomToken, hashToken, numericOtp } from '../lib/password.js';
import {
  signAccessToken,
  issueRefreshToken,
  setRefreshCookie,
  rotateRefreshToken,
  clearRefreshCookie,
} from '../lib/tokens.js';
import { HttpError } from '../middleware/error.js';
import { ROLES, ROLE_PORTAL } from '../config/constants.js';
import env from '../config/env.js';
import { recordAudit } from '../middleware/audit.js';

authenticator.options = { window: 1 };

/** Shape returned to every portal on a successful login. */
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    portal: ROLE_PORTAL[user.role],
    wardId: user.wardId,
    ward: user.ward ? { id: user.ward.id, name: user.ward.name, code: user.ward.code } : null,
    language: user.language,
    greenCredits: user.greenCredits,
    avatarColor: user.avatarColor,
    twoFactorEnabled: user.twoFactorEnabled,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

/**
 * Completes a login: mints the portal-scoped access token and sets the rotating
 * refresh cookie. `expectedRole` is enforced here so hitting the officer login
 * endpoint with citizen credentials fails at the source, not at a route guard.
 */
export async function completeLogin(user, { res, req, expectedRole }) {
  if (expectedRole) {
    const allowed = Array.isArray(expectedRole) ? expectedRole : [expectedRole];
    if (!allowed.includes(user.role)) {
      throw new HttpError(403, 'This account cannot sign in from this portal');
    }
  }
  if (!user.isActive) throw new HttpError(403, 'Account has been deactivated');

  const refresh = await issueRefreshToken(user, {
    userAgent: req?.headers?.['user-agent'],
    ip: req?.ip,
  });
  setRefreshCookie(res, refresh.token, refresh.expiresAt);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, include: { ward: true } });

  return {
    accessToken: signAccessToken(user),
    expiresIn: env.jwt.accessTtl,
    user: publicUser(fullUser),
  };
}

export async function loginWithPassword({ email, phone, password, expectedRole, res, req }) {
  const identifier = (email || phone || '').trim().toLowerCase();
  if (!identifier || !password) throw new HttpError(400, 'Email/phone and password are required');

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
    include: { ward: true },
  });

  // Same message and similar timing whether the user exists or not.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid credentials');
  }

  // Driver first login verification via email
  if (user.role === ROLES.DRIVER && !user.emailVerifiedAt && user.email) {
    const code = numericOtp(6);
    await prisma.otpCode.create({
      data: {
        phone: user.email,
        codeHash: hashToken(code),
        purpose: 'driver_first_login',
        expiresAt: new Date(Date.now() + 10 * 60_000), // 10 minutes
      },
    });

    const { sendMail } = await import('../lib/mail.js');
    await sendMail({
      to: user.email,
      subject: 'Your Safaai Sarathi Driver PIN',
      text: `Your driver login verification PIN is: ${code}. It expires in 10 minutes.`,
    }).catch((e) => {
      console.warn('[mail] Driver first login email delivery failed:', e.message);
    });

    return {
      driverFirstLogin: true,
      email: user.email,
      user: { id: user.id, name: user.name, role: user.role },
    };
  }

  // Officer/Admin must clear TOTP before a session is issued (plan §6.3).
  if (user.twoFactorEnabled) {
    return {
      twoFactorRequired: true,
      challengeToken: await issueTwoFactorChallenge(user),
      user: { id: user.id, name: user.name, role: user.role },
    };
  }

  return completeLogin(user, { res, req, expectedRole });
}

// ---- Two-factor (TOTP, otplib — no auth SaaS) -----------------------------

const challenges = new Map(); // challengeToken -> { userId, expiresAt }

async function issueTwoFactorChallenge(user) {
  const token = randomToken(24);
  challenges.set(token, { userId: user.id, expiresAt: Date.now() + 5 * 60_000 });
  return token;
}

export async function verifyTwoFactor({ challengeToken, code, res, req, expectedRole }) {
  const challenge = challenges.get(challengeToken);
  if (!challenge || challenge.expiresAt < Date.now()) {
    challenges.delete(challengeToken);
    throw new HttpError(401, 'Two-factor challenge expired. Sign in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: challenge.userId }, include: { ward: true } });
  if (!user?.twoFactorSecret) throw new HttpError(400, 'Two-factor is not set up for this account');

  if (!authenticator.check(String(code), user.twoFactorSecret)) {
    throw new HttpError(401, 'Invalid authentication code');
  }

  challenges.delete(challengeToken);
  return completeLogin(user, { res, req, expectedRole });
}

export async function setupTwoFactor(user) {
  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });
  return {
    secret,
    otpauthUrl: authenticator.keyuri(user.email || user.phone || user.id, 'Safaai Sarathi', secret),
  };
}

export async function confirmTwoFactor(user, code) {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fresh?.twoFactorSecret) throw new HttpError(400, 'Start two-factor setup first');
  if (!authenticator.check(String(code), fresh.twoFactorSecret)) {
    throw new HttpError(400, 'Code did not match. Check your authenticator app.');
  }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  return { twoFactorEnabled: true };
}

// ---- Registration (citizens only; staff are provisioned by admin) ---------

export async function registerCitizen({ name, email, phone, password, language }) {
  const normalisedEmail = email?.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { OR: [normalisedEmail ? { email: normalisedEmail } : undefined, phone ? { phone } : undefined].filter(Boolean) },
  });
  if (existing) throw new HttpError(409, 'An account with that email or phone already exists');

  const user = await prisma.user.create({
    data: {
      name,
      email: normalisedEmail,
      phone,
      passwordHash: await hashPassword(password),
      role: ROLES.CITIZEN,
      language: language || 'en',
    },
  });

  const verification = await createEmailToken(user.id, 'verify');
  return { user, verification };
}

export async function createEmailToken(userId, purpose, ttlHours = 24) {
  const token = randomToken(32);
  await prisma.emailToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      purpose,
      expiresAt: new Date(Date.now() + ttlHours * 3600_000),
    },
  });
  return token;
}

export async function consumeEmailToken(token, purpose) {
  const row = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.purpose !== purpose) throw new HttpError(400, 'Invalid or already used link');
  if (row.usedAt) throw new HttpError(400, 'This link has already been used');
  if (row.expiresAt < new Date()) throw new HttpError(400, 'This link has expired');

  await prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row;
}

// ---- Driver phone / OTP login --------------------------------------------

export async function requestDriverOtp(phone) {
  const driver = await prisma.user.findFirst({ where: { phone, role: ROLES.DRIVER } });
  // Do not leak whether the number belongs to a driver.
  if (!driver) return { sent: true, delivered: false };

  const code = numericOtp(6);
  await prisma.otpCode.create({
    data: {
      phone,
      codeHash: hashToken(code),
      purpose: 'driver_login',
      expiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });

  // Wire an SMS gateway here. Logged so the demo works without credentials —
  // and the response never contains the code.
  console.log(`[otp] driver login code for ${phone}: ${code}`);
  return { sent: true, delivered: true, devHint: env.isProd ? undefined : 'Code printed in the API console' };
}

export async function verifyDriverOtp({ phone, code, res, req }) {
  const row = await prisma.otpCode.findFirst({
    where: { phone, purpose: 'driver_login', consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new HttpError(401, 'Code expired. Request a new one.');
  if (row.attempts >= 5) throw new HttpError(429, 'Too many attempts. Request a new code.');

  if (row.codeHash !== hashToken(String(code))) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(401, 'Incorrect code');
  }

  await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  const driver = await prisma.user.findFirst({ where: { phone, role: ROLES.DRIVER }, include: { ward: true } });
  if (!driver) throw new HttpError(404, 'Driver account not found');

  return completeLogin(driver, { res, req, expectedRole: ROLES.DRIVER });
}

// ---- Driver First Login OTP Verification --------------------------------

export async function verifyDriverFirstLogin({ email, code, res, req }) {
  const row = await prisma.otpCode.findFirst({
    where: { phone: email, purpose: 'driver_first_login', consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new HttpError(401, 'Code expired. Request a new one.');
  if (row.attempts >= 5) throw new HttpError(429, 'Too many attempts. Request a new code.');

  if (row.codeHash !== hashToken(String(code))) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(401, 'Incorrect code');
  }

  await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  
  const driver = await prisma.user.findFirst({ where: { email, role: ROLES.DRIVER }, include: { ward: true } });
  if (!driver) throw new HttpError(404, 'Driver account not found');

  await prisma.user.update({ where: { id: driver.id }, data: { emailVerifiedAt: new Date() } });

  return completeLogin(driver, { res, req, expectedRole: ROLES.DRIVER });
}

// ---- Session lifecycle ---------------------------------------------------

export async function refreshSession({ rawToken, res, req, expectedPortal }) {
  if (!rawToken) throw new HttpError(401, 'No refresh token');

  const result = await rotateRefreshToken(rawToken, {
    userAgent: req?.headers?.['user-agent'],
    ip: req?.ip,
  });

  if (result.error) {
    clearRefreshCookie(res);
    if (result.error === 'reused') {
      await recordAudit({
        action: 'refresh_token_reuse_detected',
        targetTable: 'refresh_tokens',
        req,
      });
      throw new HttpError(401, 'Session revoked for security. Please sign in again.');
    }
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }

  const { user, refresh } = result;
  if (expectedPortal && ROLE_PORTAL[user.role] !== expectedPortal) {
    clearRefreshCookie(res);
    throw new HttpError(403, 'Session does not belong to this portal');
  }

  setRefreshCookie(res, refresh.token, refresh.expiresAt);
  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, include: { ward: true } });

  return { accessToken: signAccessToken(user), expiresIn: env.jwt.accessTtl, user: publicUser(fullUser) };
}

export default {
  publicUser,
  completeLogin,
  loginWithPassword,
  verifyTwoFactor,
  setupTwoFactor,
  confirmTwoFactor,
  registerCitizen,
  createEmailToken,
  consumeEmailToken,
  requestDriverOtp,
  verifyDriverOtp,
  verifyDriverFirstLogin,
  refreshSession,
};
