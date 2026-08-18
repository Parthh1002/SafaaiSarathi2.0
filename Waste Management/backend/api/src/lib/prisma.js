import { PrismaClient } from '@prisma/client';
import env from '../config/env.js';

export const prisma = new PrismaClient({
  log: env.isProd ? ['error'] : ['warn', 'error'],
});

export async function connectDB() {
  try {
    await prisma.$connect();
    const [{ db, version }] = await prisma.$queryRaw`
      select current_database() as db, current_setting('server_version') as version
    `;
    console.log(`[db] connected  postgres ${version}  database "${db}"`);

    // Ensure scheduled_pickup_requests schema & enums exist idempotently
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "LocationType" AS ENUM ('MY_HOME', 'COMMON_PLOT_SOCIETY');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
          CREATE TYPE "WasteQuantity" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
          CREATE TYPE "TimeSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
          CREATE TYPE "ScheduledPickupStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED_SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        CREATE TABLE IF NOT EXISTS "scheduled_pickup_requests" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "code" TEXT NOT NULL UNIQUE,
          "citizenId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "wardId" TEXT REFERENCES "wards"("id") ON DELETE SET NULL,
          "locationType" "LocationType" NOT NULL DEFAULT 'MY_HOME',
          "address" TEXT NOT NULL,
          "latitude" DOUBLE PRECISION NOT NULL,
          "longitude" DOUBLE PRECISION NOT NULL,
          "eventReason" TEXT NOT NULL,
          "expectedCategories" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "expectedQuantity" "WasteQuantity" NOT NULL DEFAULT 'MEDIUM',
          "scheduledDate" TIMESTAMP(3) NOT NULL,
          "scheduledTimeSlot" "TimeSlot" NOT NULL DEFAULT 'MORNING',
          "additionalNotes" TEXT,
          "status" "ScheduledPickupStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
          "rejectionReason" TEXT,
          "assignedDriverId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
          "assignedVehicleId" TEXT REFERENCES "vehicles"("id") ON DELETE SET NULL,
          "assignedById" TEXT,
          "assignedAt" TIMESTAMP(3),
          "completedAt" TIMESTAMP(3),
          "completionPhotoUrl" TEXT,
          "completionNotes" TEXT,
          "reminderSent" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[db] verified scheduled_pickup_requests schema');
    } catch (schemaErr) {
      console.warn('[db] scheduled schema check notice:', schemaErr.message);
    }

    return prisma;
  } catch (err) {
    console.error('\n[db] connection failed:', err.message);
    console.error(`
  Checklist:
    1. Is PostgreSQL running?   (services: postgresql-x64-17 on 5432, -16 on 5433)
    2. Is the password in api/.env DATABASE_URL correct?
    3. Does the database exist?  createdb -U postgres waste_management
       ...or let Prisma create it:  npm run db:push
`);
    throw err;
  }
}

export async function disconnectDB() {
  await prisma.$disconnect();
}

export default prisma;
