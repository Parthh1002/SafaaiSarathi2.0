import { Server } from 'socket.io';
import env from '../config/env.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { SOCKET_EVENTS, ROLES } from '../config/constants.js';

/**
 * Live tracking transport (plan §4.3).
 *
 * Rooms, not broadcasts:
 *   ward:<id>     officers and admins watching a ward
 *   truck:<id>    one vehicle — a citizen tracking their complaint joins only this
 *   user:<id>     personal notifications
 *   city          admin city-wide view
 *
 * Keeping the citizen scoped to a single truck room is what stops the payload
 * growing with the size of the fleet.
 */

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    path: '/socket.io',
  });

  attachRedisAdapter().catch((err) => console.warn('[socket] redis adapter skipped:', err.message));

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.data.user = null;
      return next();
    }
    try {
      socket.data.user = verifyAccessToken(token);
      return next();
    } catch {
      socket.data.user = null;
      return next();
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (user) {
      socket.join(`user:${user.sub}`);
      socket.join(`driver_${user.sub}`);
      if (user.wardId) socket.join(`ward:${user.wardId}`);
      if (user.role === ROLES.ADMIN) socket.join('city');
    }

    /**
     * Drivers subscribe to their own truck room; officers/admins subscribe to
     * wards they manage; citizens subscribe to one truck. The server validates
     * the shape but authorisation for ward scope is enforced by the REST layer
     * that hands out the ids in the first place.
     */
    socket.on('subscribe', (room) => {
      if (typeof room !== 'string') return;
      if (!/^(ward|truck|complaint|driver):[A-Za-z0-9_-]{1,40}$/.test(room) && !/^driver_[A-Za-z0-9_-]{1,40}$/.test(room)) return;
      if (room.startsWith('ward:') && !user) return; // ward feeds require a session
      socket.join(room);
    });

    socket.on('unsubscribe', (room) => {
      if (typeof room === 'string') socket.leave(room);
    });

    // Driver location can arrive over the socket (plan §4.2) as well as REST.
    socket.on(SOCKET_EVENTS.DRIVER_LOCATION, async (payload) => {
      if (!user || user.role !== ROLES.DRIVER) return;
      const handler = socket.data.locationHandler;
      if (handler) await handler({ ...payload, driverId: user.sub });
    });
  });

  console.log('[socket] realtime gateway ready');
  return io;
}

/** Registered by the telemetry service so the socket path and REST path agree. */
export function onDriverLocation(handler) {
  if (!io) return;
  io.sockets.sockets.forEach((socket) => {
    socket.data.locationHandler = handler;
  });
  io.on('connection', (socket) => {
    socket.data.locationHandler = handler;
  });
}

async function attachRedisAdapter() {
  if (!env.redisUrl) return;
  const { createAdapter } = await import('@socket.io/redis-adapter');
  const { default: Redis } = await import('ioredis');
  const pub = new Redis(env.redisUrl);
  const sub = pub.duplicate();
  io.adapter(createAdapter(pub, sub));
  console.log('[socket] Redis adapter attached — rooms sync across instances');
}

export const getIO = () => io;

export function emit(event, payload, room) {
  if (!io) return;
  if (room) io.to(room).emit(event, payload);
  else io.emit(event, payload);
}

/** Fan out to several rooms at once (ward + city + the specific truck). */
export function emitTo(rooms, event, payload) {
  if (!io) return;
  const targets = [...new Set(rooms.filter(Boolean))];
  if (!targets.length) return;
  io.to(targets).emit(event, payload);
}

export { SOCKET_EVENTS };
export default { initRealtime, getIO, emit, emitTo, onDriverLocation, SOCKET_EVENTS };
