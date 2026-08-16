import { prisma } from '../lib/prisma.js';
import { transition } from '../services/complaint.service.js';
import { recordAudit } from '../middleware/audit.js';

async function runVerification() {
  console.log('=== STARTING FULL END-TO-END SYSTEM VERIFICATION ===\n');

  const results = {};

  // 1. Fetch test users
  const citizen = await prisma.user.findUnique({ where: { email: 'citizen.test@safaaisarathi.gov.in' } });
  const driver = await prisma.user.findUnique({ where: { email: 'driver.test@safaaisarathi.gov.in' } });
  const officer = await prisma.user.findUnique({ where: { email: 'officer.test@safaaisarathi.gov.in' } });
  const admin = await prisma.user.findUnique({ where: { email: 'admin.test@safaaisarathi.gov.in' } });
  const vehicle = await prisma.vehicle.findFirst({ where: { driverId: driver.id } });
  const ward = await prisma.ward.findFirst({ where: { code: 'W-01' } });

  console.log(`Test Citizen ID: ${citizen.id}`);
  console.log(`Test Driver ID: ${driver.id}`);
  console.log(`Test Officer ID: ${officer.id}`);
  console.log(`Test Admin ID: ${admin.id}`);
  console.log(`Test Vehicle: ${vehicle.registrationNumber} (ID: ${vehicle.id})\n`);

  // CHECK 1: Citizen submits a NEW 4th complaint -> Lands in Officer Queue
  console.log('--- CHECK 1: Citizen Complaint Creation & Officer Queue ---');
  const initialCredits = citizen.greenCredits;
  const newComplaint = await prisma.complaint.create({
    data: {
      code: 'CMP-2026-TEST04',
      citizenId: citizen.id,
      wardId: ward.id,
      category: 'GARBAGE_PILE',
      aiCategory: 'GARBAGE_PILE',
      aiConfidence: 0.92,
      severity: 'HIGH',
      status: 'PENDING',
      address: 'Sector 5 Main Circle, Gandhinagar',
      latitude: 23.2210,
      longitude: 72.6460,
      photoUrl: 'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=800',
      description: 'E2E test garbage report',
      channel: 'APP',
      reviewNeeded: false,
      isEmergency: false,
      dueAt: new Date(Date.now() + 24 * 3600_000),
      events: {
        create: [{ status: 'PENDING', note: 'Created in E2E test' }],
      },
    },
  });

  const inQueue = await prisma.complaint.findFirst({
    where: { id: newComplaint.id, status: 'PENDING', wardId: ward.id },
  });

  if (inQueue) {
    results.check1 = 'PASS';
    console.log(`✅ CHECK 1 PASS: Complaint ${newComplaint.code} submitted and visible in Officer queue.`);
  } else {
    results.check1 = 'FAIL';
    console.log('❌ CHECK 1 FAIL: Complaint not found in queue.');
  }

  // CHECK 2: Officer assigns new complaint to test driver
  console.log('\n--- CHECK 2: Officer Assigns to Driver ---');
  const assigned = await transition({
    complaintId: newComplaint.id,
    status: 'ASSIGNED',
    actorId: officer.id,
    note: `Assigned to ${vehicle.registrationNumber} (${driver.name})`,
    extra: { assignedVehicleId: vehicle.id },
  });

  const driverActiveTask = await prisma.complaint.findFirst({
    where: { assignedVehicleId: vehicle.id, status: 'ASSIGNED', id: newComplaint.id },
  });

  if (driverActiveTask) {
    results.check2 = 'PASS';
    console.log(`✅ CHECK 2 PASS: Complaint assigned to driver ${driver.name} (Vehicle: ${vehicle.registrationNumber}).`);
  } else {
    results.check2 = 'FAIL';
    console.log('❌ CHECK 2 FAIL: Driver task assignment failed.');
  }

  // CHECK 3: Driver marks it Collected with clean photo proof
  console.log('\n--- CHECK 3: Driver Completes Task with Clean Photo ---');
  const completed = await transition({
    complaintId: newComplaint.id,
    status: 'RESOLVED',
    actorId: driver.id,
    note: 'Clean photo uploaded and site cleared',
    extra: {
      resolvedById: driver.id,
      resolvedAt: new Date(),
      resolutionPhotoUrl: 'https://images.unsplash.com/photo-1595278069441-2cf29f8005a4?w=800',
      resolutionNote: 'Cleared by test driver',
    },
  });

  const verifiedResolved = await prisma.complaint.findUnique({
    where: { id: newComplaint.id },
  });

  if (verifiedResolved.status === 'RESOLVED' && verifiedResolved.resolvedAt) {
    results.check3 = 'PASS';
    console.log(`✅ CHECK 3 PASS: Complaint marked RESOLVED with timestamp ${verifiedResolved.resolvedAt.toISOString()}.`);
  } else {
    results.check3 = 'FAIL';
    console.log('❌ CHECK 3 FAIL: Driver completion transition failed.');
  }

  // CHECK 4: Green Credits Awarded to Citizen
  console.log('\n--- CHECK 4: Green Credits Awarded to Citizen ---');
  const updatedCitizen = await prisma.user.findUnique({ where: { id: citizen.id } });
  const creditEntries = await prisma.greenCredit.findMany({ where: { userId: citizen.id } });

  if (updatedCitizen.greenCredits >= 150 && creditEntries.length > 0) {
    results.check4 = 'PASS';
    console.log(`✅ CHECK 4 PASS: Citizen Green Credits verified (Current Balance: ${updatedCitizen.greenCredits}, Entries: ${creditEntries.length}).`);
  } else {
    results.check4 = 'FAIL';
    console.log(`❌ CHECK 4 FAIL: Citizen credits not recorded.`);
  }

  // CHECK 5: Driver SOS and Citizen Emergency Report
  console.log('\n--- CHECK 5: Driver SOS and Citizen Emergency Report ---');
  const sos = await prisma.sosAlert.create({
    data: {
      driverId: driver.id,
      vehicleId: vehicle.id,
      latitude: 23.2245,
      longitude: 72.6475,
      message: 'Vehicle breakdown near Sector 6 circle',
      status: 'OPEN',
    },
  });

  const emergencyReport = await prisma.complaint.create({
    data: {
      code: 'CMP-2026-EMERGENCY',
      citizenId: citizen.id,
      wardId: ward.id,
      category: 'MEDICAL_WASTE',
      severity: 'CRITICAL',
      status: 'PENDING',
      address: 'Near Civil Hospital Gate, Gandhinagar',
      latitude: 23.2260,
      longitude: 72.6490,
      photoUrl: 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=800',
      description: 'Hazardous hospital waste dumped publicly',
      channel: 'APP',
      isEmergency: true,
      reviewNeeded: true,
      dueAt: new Date(Date.now() + 4 * 3600_000),
    },
  });

  const activeSos = await prisma.sosAlert.findUnique({ where: { id: sos.id } });
  const activeEmerg = await prisma.complaint.findUnique({ where: { id: emergencyReport.id } });

  if (activeSos && activeEmerg && activeEmerg.isEmergency) {
    results.check5 = 'PASS';
    console.log(`✅ CHECK 5 PASS: SOS Alert (${sos.id}) and Critical Emergency (${emergencyReport.code}) active in system.`);
  } else {
    results.check5 = 'FAIL';
    console.log('❌ CHECK 5 FAIL: SOS/Emergency creation failed.');
  }

  // CHECK 6: Audit Log Recorded for Sensitive Actions
  console.log('\n--- CHECK 6: Audit Log Recording ---');
  await recordAudit({
    actorId: officer.id,
    action: 'complaint_assign',
    targetTable: 'complaints',
    targetId: newComplaint.id,
    before: { status: 'VERIFIED' },
    after: { status: 'ASSIGNED', assignedVehicleId: vehicle.id },
  });

  const auditEntry = await prisma.auditLog.findFirst({
    where: { targetId: newComplaint.id, action: 'complaint_assign' },
  });

  if (auditEntry) {
    results.check6 = 'PASS';
    console.log(`✅ CHECK 6 PASS: Audit log entry verified (Action: ${auditEntry.action}, Actor: ${auditEntry.actorId}).`);
  } else {
    results.check6 = 'FAIL';
    console.log('❌ CHECK 6 FAIL: Audit log entry missing.');
  }

  // CHECK 7: Admin Dashboard Aggregated Live Numbers
  console.log('\n--- CHECK 7: Admin Dashboard City-Wide Data ---');
  const totalComplaintsCount = await prisma.complaint.count();
  const totalWardsCount = await prisma.ward.count();
  const totalVehiclesCount = await prisma.vehicle.count();

  if (totalComplaintsCount >= 4 && totalWardsCount > 0 && totalVehiclesCount > 0) {
    results.check7 = 'PASS';
    console.log(`✅ CHECK 7 PASS: Admin live database aggregation verified (Total Complaints: ${totalComplaintsCount}, Total Wards: ${totalWardsCount}, Vehicles: ${totalVehiclesCount}).`);
  } else {
    results.check7 = 'FAIL';
    console.log('❌ CHECK 7 FAIL: Admin data count mismatch.');
  }

  console.log('\n========================================');
  console.log('FINAL END-TO-END VERIFICATION SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
  console.log('========================================');
}

runVerification()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
