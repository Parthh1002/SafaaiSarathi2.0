/**
 * Safaai Sarathi 2.0 - Real Driver Account Seed Script
 * ====================================================
 * Configures the live test driver account:
 *   Email: parthh1002@gmail.com
 *   Password: Parth@1002
 *   Role: DRIVER
 *   Vehicle: GJ-18-GB-4012 (Real-Time GPS Transmitter)
 */

import { prisma, connectDB, disconnectDB } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

async function seedRealDriver() {
  await connectDB();
  console.log('[Seed] Configuring Real Driver account: parthh1002@gmail.com ...');

  const email = 'parthh1002@gmail.com';
  const rawPassword = 'Parth@1002';
  const passwordHash = await hashPassword(rawPassword);

  // 1. Fetch Sector 6 or default primary ward
  let ward = await prisma.ward.findFirst({
    where: { OR: [{ code: 'W-06' }, { name: { contains: 'Sector 6' } }] },
  });

  if (!ward) {
    ward = await prisma.ward.findFirst();
  }

  // 2. Upsert real driver user account
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Parth Patel (Real GPS Driver)',
      passwordHash,
      role: 'DRIVER',
      isActive: true,
      emailVerifiedAt: new Date(),
      wardId: ward?.id,
    },
    create: {
      name: 'Parth Patel (Real GPS Driver)',
      email,
      phone: '9825144321',
      passwordHash,
      role: 'DRIVER',
      isActive: true,
      emailVerifiedAt: new Date(),
      wardId: ward?.id,
      avatarColor: '#10b981',
    },
  });

  console.log(`[Seed] Driver user ready: ${user.id} (${user.email})`);

  // 3. Upsert assigned vehicle
  const regNumber = 'GJ-18-GB-4012';
  let vehicle = await prisma.vehicle.findFirst({
    where: { OR: [{ registrationNumber: regNumber }, { driverId: user.id }] },
  });

  if (vehicle) {
    vehicle = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        driverId: user.id,
        wardId: ward?.id,
        status: 'ON_ROUTE',
        model: 'Tata Ace Gold 2T (Real GPS Live)',
        lastLat: 23.2156,
        lastLng: 72.6369,
        lastSpeed: 0,
        lastPingAt: new Date(),
      },
    });
  } else {
    vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: regNumber,
        driverId: user.id,
        wardId: ward?.id,
        status: 'ON_ROUTE',
        model: 'Tata Ace Gold 2T (Real GPS Live)',
        capacityKg: 2000,
        lastLat: 23.2156,
        lastLng: 72.6369,
        lastSpeed: 0,
        lastPingAt: new Date(),
      },
    });
  }

  console.log(`[Seed] Vehicle assigned: ${vehicle.registrationNumber} (ID: ${vehicle.id})`);
  await disconnectDB();
  console.log('✅ Real Driver Account Seed Complete!');
}

seedRealDriver().catch((err) => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
