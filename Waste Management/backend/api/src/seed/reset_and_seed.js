import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

async function main() {
  console.log('--- RESETTING TRANSACTIONAL DATA ---');

  // Step 1: Clear all transactional rows
  await prisma.complaintEvent.deleteMany({});
  await prisma.complaintDuplicate.deleteMany({});
  await prisma.escalation.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.route.deleteMany({});
  await prisma.fuelLog.deleteMany({});
  await prisma.sosAlert.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.greenCredit.deleteMany({});
  await prisma.notification.deleteMany({});

  console.log('Transactional tables cleared.');

  // Find or create primary test ward
  let ward1 = await prisma.ward.findFirst({ where: { code: 'W-01' } });
  if (!ward1) {
    ward1 = await prisma.ward.findFirst();
  }

  const defaultPassword = 'Password123!';
  const passwordHash = await hashPassword(defaultPassword);

  // Step 1.2: Ensure exact test demo accounts exist
  const citizen = await prisma.user.upsert({
    where: { email: 'citizen.test@safaaisarathi.gov.in' },
    update: {
      name: 'Test Citizen',
      phone: '9876543210',
      role: 'CITIZEN',
      isActive: true,
      emailVerifiedAt: new Date(),
      greenCredits: 150,
      passwordHash,
    },
    create: {
      email: 'citizen.test@safaaisarathi.gov.in',
      name: 'Test Citizen',
      phone: '9876543210',
      role: 'CITIZEN',
      isActive: true,
      emailVerifiedAt: new Date(),
      greenCredits: 150,
      passwordHash,
    },
  });

  const driver = await prisma.user.upsert({
    where: { email: 'driver.test@safaaisarathi.gov.in' },
    update: {
      name: 'Test Driver',
      phone: '9876543211',
      role: 'DRIVER',
      isActive: true,
      emailVerifiedAt: new Date(),
      wardId: ward1?.id,
      passwordHash,
    },
    create: {
      email: 'driver.test@safaaisarathi.gov.in',
      name: 'Test Driver',
      phone: '9876543211',
      role: 'DRIVER',
      isActive: true,
      emailVerifiedAt: new Date(),
      wardId: ward1?.id,
      passwordHash,
    },
  });

  const officer = await prisma.user.upsert({
    where: { email: 'officer.test@safaaisarathi.gov.in' },
    update: {
      name: 'Test Ward Officer',
      phone: '9876543212',
      role: 'OFFICER',
      isActive: true,
      emailVerifiedAt: new Date(),
      wardId: ward1?.id,
      passwordHash,
    },
    create: {
      email: 'officer.test@safaaisarathi.gov.in',
      name: 'Test Ward Officer',
      phone: '9876543212',
      role: 'OFFICER',
      isActive: true,
      emailVerifiedAt: new Date(),
      wardId: ward1?.id,
      passwordHash,
    },
  });

  if (ward1) {
    await prisma.wardOfficer.upsert({
      where: { wardId_officerId: { wardId: ward1.id, officerId: officer.id } },
      update: { isPrimary: true },
      create: { wardId: ward1.id, officerId: officer.id, isPrimary: true },
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin.test@safaaisarathi.gov.in' },
    update: {
      name: 'Super Admin',
      phone: '9876543213',
      role: 'ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
      passwordHash,
    },
    create: {
      email: 'admin.test@safaaisarathi.gov.in',
      name: 'Super Admin',
      phone: '9876543213',
      role: 'ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
      passwordHash,
    },
  });

  // Assign vehicle to driver
  let vehicle = await prisma.vehicle.findFirst({ where: { registrationNumber: 'GJ-18-SS-1001' } });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: 'GJ-18-SS-1001',
        model: 'Tata Ace Electric',
        capacityKg: 1000,
        wardId: ward1?.id,
        driverId: driver.id,
        status: 'ON_ROUTE',
        lastLat: 23.2250,
        lastLng: 72.6480,
        lastPingAt: new Date(),
      },
    });
  } else {
    vehicle = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        driverId: driver.id,
        wardId: ward1?.id,
        status: 'ON_ROUTE',
        lastLat: 23.2250,
        lastLng: 72.6480,
        lastPingAt: new Date(),
      },
    });
  }

  console.log('Test users and vehicle initialized.');

  // Step 2: Seed EXACTLY 3 mock complaints
  const now = new Date();

  // Complaint 1: VERIFIED, unassigned
  const c1 = await prisma.complaint.create({
    data: {
      code: 'CMP-2026-TEST01',
      citizenId: citizen.id,
      wardId: ward1?.id,
      category: 'GARBAGE_PILE',
      aiCategory: 'GARBAGE_PILE',
      aiConfidence: 0.88,
      severity: 'MEDIUM',
      status: 'VERIFIED',
      address: 'Sector 6 Market, Gandhinagar',
      latitude: 23.2205,
      longitude: 72.6450,
      photoUrl: 'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=800',
      description: 'Garbage accumulation near Sector 6 main market entrance.',
      reviewNeeded: false,
      isEmergency: false,
      channel: 'APP',
      dueAt: new Date(now.getTime() + 18 * 3600_000),
      createdAt: new Date(now.getTime() - 4 * 3600_000),
      events: {
        create: [
          { status: 'PENDING', note: 'Complaint submitted by citizen via app', createdAt: new Date(now.getTime() - 4 * 3600_000) },
          { status: 'VERIFIED', note: 'AI classified with 88% confidence and verified', actorId: officer.id, createdAt: new Date(now.getTime() - 3 * 3600_000) },
        ],
      },
    },
  });

  // Complaint 2: IN_PROGRESS / ASSIGNED to test driver
  const c2 = await prisma.complaint.create({
    data: {
      code: 'CMP-2026-TEST02',
      citizenId: citizen.id,
      wardId: ward1?.id,
      category: 'OVERFLOWING_BIN',
      aiCategory: 'OVERFLOWING_BIN',
      aiConfidence: 0.94,
      severity: 'HIGH',
      status: 'IN_PROGRESS',
      address: 'Sector 7 Commercial Center, Gandhinagar',
      latitude: 23.2280,
      longitude: 72.6510,
      photoUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800',
      description: 'Public community waste bin overflowing onto the pedestrian pathway.',
      reviewNeeded: false,
      isEmergency: false,
      channel: 'APP',
      assignedVehicleId: vehicle.id,
      assignedById: officer.id,
      assignedAt: new Date(now.getTime() - 2 * 3600_000),
      dueAt: new Date(now.getTime() + 12 * 3600_000),
      createdAt: new Date(now.getTime() - 5 * 3600_000),
      events: {
        create: [
          { status: 'PENDING', note: 'Submitted via Mobile App', createdAt: new Date(now.getTime() - 5 * 3600_000) },
          { status: 'VERIFIED', note: 'Verified by Officer', actorId: officer.id, createdAt: new Date(now.getTime() - 4 * 3600_000) },
          { status: 'ASSIGNED', note: `Assigned to ${vehicle.registrationNumber} (Test Driver)`, actorId: officer.id, createdAt: new Date(now.getTime() - 2 * 3600_000) },
          { status: 'IN_PROGRESS', note: 'Driver has started transit to location', actorId: driver.id, createdAt: new Date(now.getTime() - 1 * 3600_000) },
        ],
      },
    },
  });

  // Complaint 3: RESOLVED with Green Credits awarded
  const c3 = await prisma.complaint.create({
    data: {
      code: 'CMP-2026-TEST03',
      citizenId: citizen.id,
      wardId: ward1?.id,
      category: 'CONSTRUCTION_DEBRIS',
      aiCategory: 'CONSTRUCTION_DEBRIS',
      aiConfidence: 0.91,
      severity: 'LOW',
      status: 'RESOLVED',
      address: 'Sector 11 Community Garden, Gandhinagar',
      latitude: 23.2350,
      longitude: 72.6600,
      photoUrl: 'https://images.unsplash.com/photo-1595278069441-2cf29f8005a4?w=800',
      description: 'Bricks and cement debris left on curb.',
      reviewNeeded: false,
      isEmergency: false,
      channel: 'APP',
      assignedVehicleId: vehicle.id,
      assignedById: officer.id,
      assignedAt: new Date(now.getTime() - 24 * 3600_000),
      resolvedAt: new Date(now.getTime() - 2 * 3600_000),
      resolvedById: driver.id,
      resolutionPhotoUrl: 'https://images.unsplash.com/photo-1595278069441-2cf29f8005a4?w=800',
      dueAt: new Date(now.getTime() + 6 * 3600_000),
      createdAt: new Date(now.getTime() - 26 * 3600_000),
      events: {
        create: [
          { status: 'PENDING', note: 'Reported by Citizen', createdAt: new Date(now.getTime() - 26 * 3600_000) },
          { status: 'VERIFIED', note: 'Auto-verified with 91% confidence', actorId: officer.id, createdAt: new Date(now.getTime() - 25 * 3600_000) },
          { status: 'ASSIGNED', note: `Assigned to ${vehicle.registrationNumber}`, actorId: officer.id, createdAt: new Date(now.getTime() - 24 * 3600_000) },
          { status: 'IN_PROGRESS', note: 'Collection en route', actorId: driver.id, createdAt: new Date(now.getTime() - 4 * 3600_000) },
          { status: 'RESOLVED', note: 'Clean photo proof verified. Waste collected.', actorId: driver.id, createdAt: new Date(now.getTime() - 2 * 3600_000) },
        ],
      },
    },
  });

  // Credit transaction for Complaint 3
  await prisma.greenCredit.create({
    data: {
      userId: citizen.id,
      delta: 50,
      balanceAfter: 150,
      reason: 'CLEANUP_VERIFIED',
      reasonCode: 'CLEANUP_VERIFIED',
      complaintId: c3.id,
    },
  });

  // Initial Audit Log
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'system_reset_and_seed',
      targetTable: 'system',
      targetId: 'seed_init',
    },
  });

  console.log('SUCCESS: Seeded EXACTLY 3 complaints:');
  console.log(`1. ${c1.code} -> ${c1.status} (${c1.category})`);
  console.log(`2. ${c2.code} -> ${c2.status} (${c2.category}, Assigned to Driver)`);
  console.log(`3. ${c3.code} -> ${c3.status} (${c3.category}, Resolved + 50 Green Credits)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
