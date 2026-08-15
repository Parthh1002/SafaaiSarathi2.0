import crypto from 'node:crypto';

/**
 * Argon2id password hashing (plan §6.1).
 *
 * Uses @node-rs/argon2 (prebuilt, no node-gyp toolchain needed on Windows).
 * If the native module is unavailable, falls back to scrypt from Node's own
 * crypto — still a memory-hard KDF, so the fallback is safe rather than a
 * downgrade to plain hashing. The active algorithm is reported at boot.
 */

let argon2 = null;
let driver = 'scrypt';

try {
  argon2 = await import('@node-rs/argon2');
  driver = 'argon2id';
} catch {
  console.warn('[auth] @node-rs/argon2 unavailable — falling back to scrypt');
}

const ARGON_OPTIONS = {
  memoryCost: 19456, // 19 MiB — OWASP minimum for Argon2id
  timeCost: 2,
  parallelism: 1,
};

export const passwordDriver = () => driver;

export async function hashPassword(plain) {
  if (argon2) return argon2.hash(plain, ARGON_OPTIONS);

  const salt = crypto.randomBytes(16);
  const key = await scrypt(plain, salt);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(plain, stored) {
  if (!stored) return false;

  if (stored.startsWith('scrypt$')) {
    const [, saltB64, keyB64] = stored.split('$');
    const key = await scrypt(plain, Buffer.from(saltB64, 'base64'));
    const expected = Buffer.from(keyB64, 'base64');
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  }

  if (!argon2) return false;
  try {
    return await argon2.verify(stored, plain, ARGON_OPTIONS);
  } catch {
    return false;
  }
}

function scrypt(plain, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(plain, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

/** Opaque random token (refresh tokens, email links, OTP salts). */
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

/** Tokens are stored hashed so a database leak cannot resume a session. */
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** 6-digit numeric OTP for driver phone login. */
export const numericOtp = (digits = 6) =>
  String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0');

export default { hashPassword, verifyPassword, randomToken, hashToken, numericOtp, passwordDriver };
