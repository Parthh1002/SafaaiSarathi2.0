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
