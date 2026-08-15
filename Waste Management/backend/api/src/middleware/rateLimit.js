import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/**
 * Login brute-force protection (plan §6.3). Redis-backed when REDIS_URL is set,
 * in-memory otherwise — correct for a single instance, and the store swaps
 * without touching call sites.
 */

let store;
if (env.redisUrl) {
  try {
    const { default: RedisStore } = await import('rate-limit-redis');
    const { default: Redis } = await import('ioredis');
    const client = new Redis(env.redisUrl);
    store = new RedisStore({ sendCommand: (...args) => client.call(...args) });
    console.log('[ratelimit] using Redis store');
  } catch (err) {
    console.warn('[ratelimit] Redis store unavailable, using memory:', err.message);
  }
}

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  ...(store ? { store } : {}),
};

export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  keyGenerator: (req) => `${req.ip}:${(req.body?.email || req.body?.phone || '').toLowerCase()}`,
});

export const otpLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60_000,
  max: 5,
  message: { error: 'Too many OTP requests. Try again shortly.' },
});

export const writeLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many requests. Slow down.' },
});

/** Complaint submission — generous enough for a demo, tight enough to matter. */
export const reportLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  max: 20,
  message: { error: 'Report limit reached for this hour.' },
});

export default { loginLimiter, otpLimiter, writeLimiter, reportLimiter };
