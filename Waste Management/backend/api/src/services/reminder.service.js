import { prisma } from '../lib/prisma.js';
import { notify } from './notification.service.js';
import { emitTo } from '../sockets/realtime.js';

let intervalId = null;

/**
 * Runs periodically to scan for upcoming scheduled pickup requests
 * within the next 24 hours that have not had a reminder notification sent yet.
 * 
 * Persisted in database via `reminderSent` boolean on `ScheduledPickupRequest`
 * so server restarts will safely resume without duplicate notifications or lost alerts.
 */
export async function checkScheduledPickupReminders() {
  try {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingRequests = await prisma.scheduledPickupRequest.findMany({
      where: {
        status: { in: ['APPROVED_SCHEDULED', 'ASSIGNED'] },
        reminderSent: false,
        scheduledDate: {
          gte: now,
          lte: next24Hours,
        },
      },
      include: {
        citizen: { select: { id: true, name: true } },
        assignedDriver: { select: { id: true, name: true } },
        ward: { select: { id: true, name: true } },
      },
    });

    for (const req of upcomingRequests) {
      // 1. Notify Citizen
      await notify({
        userId: req.citizenId,
        type: 'SYSTEM',
        title: `Upcoming Scheduled Pickup: ${req.code}`,
        body: `Reminder: Your waste pickup for "${req.eventReason}" is scheduled for ${new Date(req.scheduledDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} (${req.scheduledTimeSlot}).`,
        data: { scheduledRequestId: req.id, code: req.code },
      });

      // 2. Notify Assigned Driver (if assigned)
      if (req.assignedDriverId) {
        await notify({
          userId: req.assignedDriverId,
          type: 'ASSIGNMENT',
          title: `Upcoming Scheduled Pickup: ${req.code}`,
          body: `Reminder: Scheduled pickup for ${req.citizen.name} at ${req.address} is set for ${req.scheduledTimeSlot}.`,
          data: { scheduledRequestId: req.id, code: req.code },
        });

        emitTo(`driver:${req.assignedDriverId}`, 'task:reminder', {
          scheduledRequestId: req.id,
          code: req.code,
          address: req.address,
          scheduledTimeSlot: req.scheduledTimeSlot,
        });
      }

      // Mark reminder as sent in database
      await prisma.scheduledPickupRequest.update({
        where: { id: req.id },
        data: { reminderSent: true },
      });
    }
  } catch (err) {
    console.warn('[reminder-service] error checking scheduled reminders:', err.message);
  }
}

export function startScheduledReminderWatcher() {
  if (intervalId) return;
  // Run every 10 minutes
  intervalId = setInterval(checkScheduledPickupReminders, 10 * 60 * 1000);
  // Also run initial check 10 seconds after server boots
  setTimeout(checkScheduledPickupReminders, 10000);
}

export function stopScheduledReminderWatcher() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
