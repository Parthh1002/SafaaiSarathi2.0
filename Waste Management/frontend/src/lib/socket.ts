import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import { tokenStore, type Portal } from './api';

/**
 * One socket per portal, reference-counted so several components can subscribe
 * to the same room without opening duplicate connections.
 */

const sockets = new Map<Portal, Socket>();
const refCounts = new Map<Portal, number>();

export function getSocket(portal: Portal): Socket {
  const existing = sockets.get(portal);
  if (existing) return existing;

  const socket = io(import.meta.env.VITE_API_URL || '/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token: tokenStore.get(portal) },
    autoConnect: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 6000,
  });

  // Re-send the current token after a reconnect — it may have been rotated.
  socket.on('reconnect_attempt', () => {
    socket.auth = { token: tokenStore.get(portal) };
  });

  sockets.set(portal, socket);
  return socket;
}

export function releaseSocket(portal: Portal) {
  const count = (refCounts.get(portal) ?? 1) - 1;
  refCounts.set(portal, Math.max(0, count));
  if (count <= 0) {
    sockets.get(portal)?.disconnect();
    sockets.delete(portal);
    refCounts.delete(portal);
  }
}

/**
 * Subscribe to rooms and events for the life of a component.
 * Rooms are joined on connect and re-joined automatically after a reconnect.
 */
export function useSocket(
  portal: Portal,
  rooms: string[],
  handlers: Record<string, (payload: any) => void>
) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const roomKey = rooms.filter(Boolean).sort().join('|');

  useEffect(() => {
    const socket = getSocket(portal);
    refCounts.set(portal, (refCounts.get(portal) ?? 0) + 1);

    const roomList = roomKey ? roomKey.split('|') : [];
    const join = () => {
      setConnected(true);
      roomList.forEach((room) => socket.emit('subscribe', room));
    };

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('disconnect', () => setConnected(false));

    // A stable wrapper per event so the listener survives handler identity changes.
    const bound = Object.keys(handlersRef.current).map((event) => {
      const fn = (payload: unknown) => handlersRef.current[event]?.(payload);
      socket.on(event, fn);
      return [event, fn] as const;
    });

    return () => {
      roomList.forEach((room) => socket.emit('unsubscribe', room));
      bound.forEach(([event, fn]) => socket.off(event, fn));
      socket.off('connect', join);
      releaseSocket(portal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, roomKey, Object.keys(handlers).sort().join('|')]);

  return connected;
}

export const SOCKET_EVENTS = {
  TRUCK_UPDATE: 'truck:update',
  DRIVER_LOCATION: 'driver:location',
  COMPLAINT_NEW: 'complaint:new',
  COMPLAINT_UPDATE: 'complaint:update',
  EMERGENCY_NEW: 'emergency:new',
  ESCALATION_NEW: 'escalation:new',
  ASSIGNMENT_NEW: 'assignment:new',
  SOS_NEW: 'sos:new',
  NOTIFICATION: 'notification:new',
} as const;
