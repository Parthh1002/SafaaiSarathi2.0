# Reminder Service Background Worker

- Runs every 10 minutes.
- Scans `ScheduledPickup` records within 24h.
- Emits reminders to citizens and stages driver task manifests.
