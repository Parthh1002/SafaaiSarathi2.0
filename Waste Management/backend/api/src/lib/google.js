import { OAuth2Client } from 'google-auth-library';
import env from '../config/env.js';

/**
 * "Continue with Google" without Firebase (plan §6.2).
 *
 * Standard OAuth 2.0 Authorization Code flow straight against Google, then the
 * ID token signature/audience is verified locally and OUR session system takes
 * over. Google is out of the picture from that point on.
 */

let client = null;
function getClient() {
  if (!env.google.enabled) return null;
  if (!client) {
    client = new OAuth2Client(env.google.clientId, env.google.clientSecret, env.google.redirectUri);
  }
  return client;
}

export const googleEnabled = () => env.google.enabled;

export function authorizationUrl(state) {
  const c = getClient();
  if (!c) return null;
  return c.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['openid', 'email', 'profile'],
    state,
  });
}

/** Exchange the code, verify the ID token, return the verified profile. */
export async function exchangeCode(code) {
  const c = getClient();
  if (!c) throw Object.assign(new Error('Google sign-in is not configured'), { status: 501 });

  const { tokens } = await c.getToken(code);
  if (!tokens.id_token) throw Object.assign(new Error('Google did not return an ID token'), { status: 502 });

  const ticket = await c.verifyIdToken({ idToken: tokens.id_token, audience: env.google.clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw Object.assign(new Error('Google ID token failed verification'), { status: 401 });

  return {
    providerUserId: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name || payload.email?.split('@')[0] || 'Citizen',
    picture: payload.picture,
  };
}

/** For clients that already hold an ID token (native SDK path). */
export async function verifyIdToken(idToken) {
  const c = getClient();
  if (!c) throw Object.assign(new Error('Google sign-in is not configured'), { status: 501 });
  const ticket = await c.verifyIdToken({ idToken, audience: env.google.clientId });
  const payload = ticket.getPayload();
  return {
    providerUserId: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name,
    picture: payload.picture,
  };
}

export default { googleEnabled, authorizationUrl, exchangeCode, verifyIdToken };
