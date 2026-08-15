import crypto from 'node:crypto';
import { ZodError } from 'zod';

export function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID().slice(0, 8);
  res.setHeader('X-Request-Id', req.id);
  next();
}

export function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found`, requestId: req.id });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      fields: err.flatten().fieldErrors,
      requestId: req.id,
    });
  }

  // Prisma known errors -> useful HTTP codes instead of a blanket 500.
  if (err.code === 'P2002') {
    return res.status(409).json({ error: `${err.meta?.target?.join(', ') || 'Value'} already exists`, requestId: req.id });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found', requestId: req.id });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Referenced record does not exist', requestId: req.id });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(`[${req.id}] ${req.method} ${req.originalUrl}`, err);

  return res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
    requestId: req.id,
  });
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Throwable HTTP error, so services can signal status without importing express. */
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

export default { requestId, notFound, errorHandler, asyncHandler, HttpError };
