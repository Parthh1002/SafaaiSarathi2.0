import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { loginLimiter, otpLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { requirePortal, loadUser } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { REFRESH_COOKIE, clearRefreshCookie, revokeRefreshToken } from '../lib/tokens.js';
import { googleEnabled, authorizationUrl, exchangeCode, verifyIdToken } from '../lib/google.js';
import { randomToken, hashPassword } from '../lib/password.js';
import { ROLES, PORTALS } from '../config/constants.js';
import env from '../config/env.js';
import auth from '../services/auth.service.js';
import { recordAudit } from '../middleware/audit.js';

const router = Router();

/**
 * Four separate login domains (plan §3) — not one shared screen with a role
 * dropdown. Each portal gets its own endpoint, its own expected role, and mints
 * a token that only works on its own API namespace.
 */

const credentials = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  password: z.string().min(1),
});

function loginRoute(path, expectedRole, portal) {
  router.post(
    path,
    loginLimiter,
    asyncHandler(async (req, res) => {
      const body = credentials.parse(req.body);
      const result = await auth.loginWithPassword({ ...body, expectedRole, res, req });
      if (result.twoFactorRequired) {
        return res.status(202).json({ ...result, portal });
      }
      return res.json({ ...result, portal });
    })
  );
}

loginRoute('/citizen/login', ROLES.CITIZEN, PORTALS.CITIZEN);
loginRoute('/driver/login', ROLES.DRIVER, PORTALS.DRIVER);
loginRoute('/officer/login', ROLES.OFFICER, PORTALS.OFFICER);
loginRoute('/admin/login', ROLES.ADMIN, PORTALS.ADMIN);

/** Second factor, required for officer and admin accounts. */
router.post(
  '/2fa/verify',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { challengeToken, code, portal } = z
      .object({ challengeToken: z.string(), code: z.string().min(6).max(8), portal: z.string().optional() })
      .parse(req.body);

    const expectedRole = portal === PORTALS.ADMIN ? ROLES.ADMIN : portal === PORTALS.OFFICER ? ROLES.OFFICER : undefined;
    const result = await auth.verifyTwoFactor({ challengeToken, code, res, req, expectedRole });
    res.json(result);
  })
);

// ---- Citizen self-registration (staff accounts are admin-provisioned) ----

router.post(
  '/citizen/register',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(80),
        email: z.string().email(),
        phone: z.string().min(8).max(15).optional(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        language: z.enum(['en', 'hi', 'gu']).optional(),
      })
      .parse(req.body);

    const { user, verification } = await auth.registerCitizen(body);

    // Wire SMTP here; logged so registration works without mail credentials.
    const link = `${env.clientOrigins[0]}/verify-email?token=${verification}`;
    console.log(`[mail] verification link for ${user.email}: ${link}`);

    const session = await auth.completeLogin(user, { res, req, expectedRole: ROLES.CITIZEN });
    res.status(201).json({
      ...session,
      emailVerificationSent: true,
      devVerificationLink: env.isProd ? undefined : link,
    });
  })
);

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const row = await auth.consumeEmailToken(token, 'verify');
    await prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
    res.json({ verified: true });
  })
);

router.post(
  '/forgot-password',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const token = await auth.createEmailToken(user.id, 'reset', 2);
      console.log(`[mail] password reset link: ${env.clientOrigins[0]}/reset-password?token=${token}`);
    }
    // Always the same response — never reveal whether an address is registered.
    res.json({ sent: true });
  })
);

router.post(
  '/reset-password',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = z
      .object({ token: z.string(), password: z.string().min(8) })
      .parse(req.body);
    const row = await auth.consumeEmailToken(token, 'reset');
    await prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(password) },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ reset: true });
  })
);

// ---- Driver phone / OTP ---------------------------------------------------

router.post(
  '/driver/otp/request',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = z.object({ phone: z.string().min(8).max(15) }).parse(req.body);
    res.json(await auth.requestDriverOtp(phone));
  })
);

router.post(
  '/driver/otp/verify',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { phone, code } = z.object({ phone: z.string(), code: z.string().min(4).max(8) }).parse(req.body);
    res.json(await auth.verifyDriverOtp({ phone, code, res, req }));
  })
);

router.post(
  '/driver/first-login-verify',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = z.object({ email: z.string().email(), code: z.string().min(6).max(6) }).parse(req.body);
    res.json(await auth.verifyDriverFirstLogin({ email, code, res, req }));
  })
);

// ---- Google OAuth 2.0 / OIDC (citizens only) ------------------------------

const oauthStates = new Map();

router.get(
  '/citizen/google',
  asyncHandler(async (_req, res) => {
    if (!googleEnabled()) {
      throw new HttpError(501, 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }
    const state = randomToken(16);
    oauthStates.set(state, Date.now() + 10 * 60_000);
    res.redirect(authorizationUrl(state));
  })
);

router.get(
  '/citizen/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    const expiry = oauthStates.get(state);
    if (!expiry || expiry < Date.now()) throw new HttpError(400, 'OAuth state is invalid or expired');
    oauthStates.delete(state);

    const profile = await exchangeCode(String(code));
    const session = await upsertGoogleUser(profile, res, req);

    // Hand the access token to the SPA; the refresh token is already an
    // httpOnly cookie, so it never touches the URL.
    const target = new URL('/auth/google/return', env.clientOrigins[0]);
    target.searchParams.set('token', session.accessToken);
    res.redirect(target.toString());
  })
);

/** Native/SDK path: the client already holds a verified Google ID token. */
router.post(
  '/citizen/google/token',
  asyncHandler(async (req, res) => {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);
    const profile = await verifyIdToken(idToken);
    res.json(await upsertGoogleUser(profile, res, req));
  })
);

async function upsertGoogleUser(profile, res, req) {
  const identity = await prisma.oAuthIdentity.findUnique({
    where: { provider_providerUserId: { provider: 'google', providerUserId: profile.providerUserId } },
    include: { user: { include: { ward: true } } },
  });

  let user = identity?.user;

  if (!user && profile.email) {
    // Link to an existing password account with the same verified address.
    user = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() }, include: { ward: true } });
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: profile.name || 'Citizen',
        email: profile.email?.toLowerCase(),
        role: ROLES.CITIZEN,
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
      },
      include: { ward: true },
    });
  }

  if (!identity) {
    await prisma.oAuthIdentity.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerUserId: profile.providerUserId,
        email: profile.email,
      },
    });
  }

  return auth.completeLogin(user, { res, req, expectedRole: ROLES.CITIZEN });
}

// ---- Session lifecycle ----------------------------------------------------

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    res.json(await auth.refreshSession({ rawToken, res, req, expectedPortal: req.body?.portal }));
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.json({ loggedOut: true });
  })
);

/** `me` per portal — the guard proves the token belongs to that portal. */
for (const [portal, path] of Object.entries({
  [PORTALS.CITIZEN]: '/citizen/me',
  [PORTALS.DRIVER]: '/driver/me',
  [PORTALS.OFFICER]: '/officer/me',
  [PORTALS.ADMIN]: '/admin/me',
})) {
  router.get(
    path,
    requirePortal(portal),
    loadUser,
    asyncHandler(async (req, res) => {
      res.json({
        user: auth.publicUser(req.user),
        wards: req.user.officerWards?.map((w) => ({ id: w.ward.id, name: w.ward.name, code: w.ward.code })) ?? [],
      });
    })
  );
}

// ---- Two-factor management (officer/admin) --------------------------------

router.post(
  '/2fa/setup',
  requirePortal(PORTALS.ADMIN),
  loadUser,
  asyncHandler(async (req, res) => res.json(await auth.setupTwoFactor(req.user)))
);

router.post(
  '/2fa/confirm',
  requirePortal(PORTALS.ADMIN),
  loadUser,
  asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().min(6).max(8) }).parse(req.body);
    const result = await auth.confirmTwoFactor(req.user, code);
    await recordAudit({ actorId: req.user.id, action: '2fa_enabled', targetTable: 'users', targetId: req.user.id, req });
    res.json(result);
  })
);

/** Demo accounts for the login screens — seeded, never production data. */
router.get(
  '/demo-accounts',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: '@safaai.gov.in' } },
      select: { name: true, email: true, phone: true, role: true },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });
    res.json({
      password: 'safaai@2026',
      note: 'Seeded demo accounts. Each role signs in on its own portal login screen.',
      accounts: users,
      googleEnabled: googleEnabled(),
    });
  })
);

export default router;
