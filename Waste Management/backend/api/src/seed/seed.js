/**
 * Demo dataset for Safaai Sarathi.
 *
 * Deterministic: same city, same accounts, same 45-day history every run, so a
 * demo is repeatable and the hotspot model has genuine weekday seasonality to
 * forecast from.
 *
 *   npm run db:push && npm run seed
 */
import { prisma, connectDB, disconnectDB } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { polygonBBox } from '../lib/geo.js';
import { CITY, WARDS, wardGeometry, pointInWard, STREETS } from './city.js';
import { WASTE_CATEGORIES, CATEGORY_MAP, CREDIT_RULES, ROLES } from '../config/constants.js';
import { solveLocal, drivablePolyline } from '../services/routing.service.js';

const PASSWORD = 'safaai@2026';
const HISTORY_DAYS = 45;

/** Deterministic PRNG so every run produces the identical city. */
function rng(seed) {
  let a = 0;
  for (let i = 0; i < String(seed).length; i += 1) a = (a * 31 + String(seed).charCodeAt(i)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const intBetween = (r, min, max) => Math.floor(min + r() * (max - min + 1));

const FIRST_NAMES = ['Priya', 'Rohit', 'Anjali', 'Mehul', 'Kiran', 'Nisha', 'Jignesh', 'Bhavna', 'Harsh', 'Devika', 'Ramesh', 'Falguni'];
const LAST_NAMES = ['Patel', 'Shah', 'Desai', 'Mehta', 'Chauhan', 'Trivedi', 'Solanki', 'Parmar', 'Joshi', 'Vasava'];

async function wipe() {
  // Order matters: children before parents.
  await prisma.greenCredit.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.complaintDuplicate.deleteMany();
  await prisma.complaintEvent.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.vehicleLocation.deleteMany();
  await prisma.route.deleteMany();
  await prisma.sosAlert.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.hotspotPrediction.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.wardOfficer.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.emailToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.oAuthIdentity.deleteMany();
  await prisma.modelHealthSample.deleteMany();
  await prisma.user.deleteMany();
  await prisma.ward.deleteMany();
  console.log('[seed] cleared existing data');
}

async function main() {
  await connectDB();
  await wipe();

  const passwordHash = await hashPassword(PASSWORD);

  // ------------------------------------------------------------- wards ----
  const wards = [];
  for (let i = 0; i < WARDS.length; i += 1) {
    const spec = WARDS[i];
    const { boundary, center } = wardGeometry(i);
    const bbox = polygonBBox(boundary);

    const ward = await prisma.ward.create({
      data: {
        name: spec.name,
        code: spec.code,
        zone: spec.zone,
        population: spec.population,
        households: Math.round(spec.population / 4.4),
        boundary,
        centerLat: center.latitude,
        centerLng: center.longitude,
        ...bbox,
        slaMinutes: 1440,
      },
    });
    wards.push({ ward, index: i });
  }
  console.log(`[seed] ${wards.length} wards`);

  // ------------------------------------------------------------- staff ----
  const admin = await prisma.user.create({
    data: {
      name: 'Commissioner H. Patel',
      email: 'admin@safaai.gov.in',
      phone: '9900000001',
      role: ROLES.ADMIN,
      passwordHash,
      emailVerifiedAt: new Date(),
      avatarColor: '#0f766e',
    },
  });
  await prisma.user.create({
    data: {
      name: 'Dy. Commissioner R. Shah',
      email: 'admin2@safaai.gov.in',
      phone: '9900000002',
      role: ROLES.ADMIN,
      passwordHash,
      emailVerifiedAt: new Date(),
      avatarColor: '#115e59',
    },
  });

  const officers = [];
  for (let i = 0; i < 4; i += 1) {
    const r = rng(`officer-${i}`);
    const scoped = [wards[i * 2], wards[i * 2 + 1]].filter(Boolean);
    const officer = await prisma.user.create({
      data: {
        name: `${pick(r, FIRST_NAMES)} ${pick(r, LAST_NAMES)} (Ward Officer)`,
        email: `officer${i + 1}@safaai.gov.in`,
        phone: `98000000${String(i + 1).padStart(2, '0')}`,
        role: ROLES.OFFICER,
        passwordHash,
        emailVerifiedAt: new Date(),
        wardId: scoped[0]?.ward.id,
        avatarColor: '#f59e0b',
      },
    });
    await prisma.wardOfficer.createMany({
      data: scoped.map((w, k) => ({ wardId: w.ward.id, officerId: officer.id, isPrimary: k === 0 })),
    });
    officers.push(officer);
  }

  // ---------------------------------------------------- drivers + fleet ----
  const vehicles = [];
  for (let i = 0; i < wards.length; i += 1) {
    const r = rng(`driver-${i}`);
    const { ward, index } = wards[i];

    const driver = await prisma.user.create({
      data: {
        name: `${pick(r, FIRST_NAMES)} ${pick(r, LAST_NAMES)}`,
        email: `driver${i + 1}@safaai.gov.in`,
        phone: `97000000${String(i + 1).padStart(2, '0')}`,
        role: ROLES.DRIVER,
        passwordHash,
        emailVerifiedAt: new Date(),
        wardId: ward.id,
        avatarColor: '#0ea5e9',
      },
    });

    const depot = pointInWard(index, 0);
    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `GJ 18 ${String.fromCharCode(65 + i)}${String.fromCharCode(65 + ((i + 3) % 26))} ${1000 + i * 137}`,
        wardId: ward.id,
        driverId: driver.id,
        status: i % 5 === 4 ? 'IDLE' : 'ON_ROUTE',
        model: pick(r, ['Tata Ace', 'Mahindra Jeeto', 'Ashok Leyland Dost', 'Tata 407']),
        capacityKg: intBetween(r, 900, 3200),
        maintenanceFlag: i === 6,
        lastLat: depot.latitude,
        lastLng: depot.longitude,
        lastHeading: intBetween(r, 0, 359),
        lastSpeed: 0,
        lastPingAt: new Date(),
      },
    });
    vehicles.push({ vehicle, ward, index, driver });
  }
  console.log(`[seed] ${officers.length} officers, ${vehicles.length} drivers + vehicles`);

  // ---------------------------------------------------------- citizens ----
  const citizens = [];
  for (let i = 0; i < 24; i += 1) {
    const r = rng(`citizen-${i}`);
    const { ward } = wards[i % wards.length];
    const citizen = await prisma.user.create({
      data: {
        name: `${pick(r, FIRST_NAMES)} ${pick(r, LAST_NAMES)}`,
        email: i < 4 ? `citizen${i + 1}@safaai.gov.in` : `resident${i + 1}@example.com`,
        phone: `96000000${String(i + 1).padStart(2, '0')}`,
        role: ROLES.CITIZEN,
        passwordHash,
        emailVerifiedAt: new Date(),
        wardId: ward.id,
        language: pick(r, ['en', 'hi', 'gu', 'gu']),
        avatarColor: '#16a34a',
      },
    });
    citizens.push(citizen);
  }
  console.log(`[seed] ${citizens.length} citizens`);

  // ---------------------------------------------------------- history ----
  /**
   * 45 days of complaints with genuine weekday seasonality (markets on
   * weekends produce more) so the hotspot forecast has a real pattern to find.
   */
  let created = 0;
  let resolvedCount = 0;
  const creditTally = new Map();

  for (let d = HISTORY_DAYS; d >= 1; d -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - d);
    day.setHours(7, 0, 0, 0);
    const weekday = day.getDay();

    for (let w = 0; w < wards.length; w += 1) {
      const { ward, index } = wards[w];
      const r = rng(`complaints-${ward.code}-${d}`);

      // Weekend and market-day uplift, plus a per-ward base rate.
      const base = 2 + (index % 3);
      const weekendBoost = weekday === 0 || weekday === 6 ? 2.2 : 1;
      const count = Math.max(0, Math.round(base * weekendBoost * (0.6 + r() * 0.9)));

      for (let k = 0; k < count; k += 1) {
        const spec = pick(r, WASTE_CATEGORIES);
        const meta = CATEGORY_MAP[spec.id];
        const citizen = citizens[intBetween(r, 0, citizens.length - 1)];
        const point = pointInWard(index, d * 13 + k * 7);

        const createdAt = new Date(day.getTime() + intBetween(r, 0, 11 * 60) * 60_000);
        const confidence = Number((0.45 + r() * 0.52).toFixed(3));
        const autoApproved = confidence >= 0.7;

        /**
         * Older complaints are closed so the SLA and trend charts have depth;
         * the last five days keep a realistic open backlog, which is what the
         * officer queue, emergency panel and route optimiser actually need.
         */
        const shouldResolve = d > 5 ? true : r() > 0.55;
        const resolutionMinutes = Math.round(meta.slaMinutes * (0.35 + r() * 0.95));
        const resolvedAt = shouldResolve ? new Date(createdAt.getTime() + resolutionMinutes * 60_000) : null;
        const status = resolvedAt ? 'RESOLVED' : pick(r, ['PENDING', 'VERIFIED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS']);

        const vehicle = vehicles[w]?.vehicle;
        const complaint = await prisma.complaint.create({
          data: {
            code: `SS-${(created + 1000).toString(36).toUpperCase().padStart(5, '0')}`,
            citizenId: citizen.id,
            wardId: ward.id,
            category: spec.id,
            // The model is not always right — roughly one in eight is corrected
            // by an officer, so Model Health shows a believable agreement rate
            // rather than a flat 100%.
            aiCategory: r() > 0.88 ? pick(r, WASTE_CATEGORIES).id : spec.id,
            aiConfidence: confidence,
            aiVerified: autoApproved,
            reviewNeeded: !autoApproved,
            fraudScore: Number((r() * 0.35).toFixed(3)),
            status,
            severity: meta.severity,
            isEmergency: meta.emergency,
            channel: pick(r, ['WEB', 'APP', 'APP', 'WHATSAPP']),
            description: `${meta.label} reported near ${pick(r, STREETS)}`,
            latitude: point.latitude,
            longitude: point.longitude,
            address: `${intBetween(r, 1, 240)}, ${pick(r, STREETS)}, ${ward.name}`,
            slaMinutes: meta.slaMinutes,
            dueAt: new Date(createdAt.getTime() + meta.slaMinutes * 60_000),
            createdAt,
            updatedAt: resolvedAt || createdAt,
            resolvedAt,
            resolvedById: resolvedAt ? vehicles[w]?.driver.id : null,
            assignedVehicleId: ['ASSIGNED', 'IN_PROGRESS'].includes(status) || resolvedAt ? vehicle?.id : null,
            assignedAt: ['ASSIGNED', 'IN_PROGRESS'].includes(status) || resolvedAt ? createdAt : null,
          },
        });

        // Timeline entries so the citizen's status view has real history.
        const events = [{ status: 'PENDING', note: 'Report received', at: createdAt }];
        if (autoApproved) events.push({ status: 'VERIFIED', note: `AI verified (${Math.round(confidence * 100)}%)`, at: new Date(createdAt.getTime() + 60_000) });
        if (resolvedAt) {
          events.push({ status: 'ASSIGNED', note: `Assigned to ${vehicle?.registrationNumber}`, at: new Date(createdAt.getTime() + 15 * 60_000) });
          events.push({ status: 'RESOLVED', note: 'Cleared by crew, photo proof attached', at: resolvedAt });
        }
        await prisma.complaintEvent.createMany({
          data: events.map((e) => ({ complaintId: complaint.id, status: e.status, note: e.note, createdAt: e.at })),
        });

        const credit = resolvedAt ? CREDIT_RULES.reportSubmitted + CREDIT_RULES.reportResolved : CREDIT_RULES.reportSubmitted;
        creditTally.set(citizen.id, (creditTally.get(citizen.id) || 0) + credit);
        created += 1;
        if (resolvedAt) resolvedCount += 1;
      }
    }
  }
  console.log(`[seed] ${created} complaints (${resolvedCount} resolved) across ${HISTORY_DAYS} days`);

  // Credit ledgers reflecting that history.
  for (const [userId, total] of creditTally) {
    await prisma.user.update({ where: { id: userId }, data: { greenCredits: total } });
    await prisma.greenCredit.create({
      data: {
        userId,
        delta: total,
        balanceAfter: total,
        reason: 'Historical reporting activity',
        reasonCode: 'seed',
      },
    });
  }

  /**
   * The demo citizens each get one fresh, assigned complaint so the live truck
   * tracker has something to follow the moment a judge signs in. Without this
   * the flagship "your truck arrives in 12 minutes" card can be empty purely by
   * chance.
   */
  for (let i = 0; i < 4; i += 1) {
    const citizen = citizens[i];
    const home = vehicles.find((v) => v.ward.id === citizen.wardId) ?? vehicles[i % vehicles.length];
    const r = rng(`demo-active-${i}`);
    const spec = pick(r, WASTE_CATEGORIES.filter((c) => !CATEGORY_MAP[c.id].emergency));
    const meta = CATEGORY_MAP[spec.id];
    const point = pointInWard(home.index, 900 + i);
    const createdAt = new Date(Date.now() - intBetween(r, 40, 180) * 60_000);

    created += 1;
    await prisma.complaint.create({
      data: {
        code: `SS-DEMO${i + 1}`,
        citizenId: citizen.id,
        wardId: home.ward.id,
        category: spec.id,
        aiCategory: spec.id,
        aiConfidence: 0.82,
        aiVerified: true,
        status: 'ASSIGNED',
        severity: meta.severity,
        isEmergency: false,
        channel: 'APP',
        description: `${meta.label} reported near ${pick(r, STREETS)}`,
        latitude: point.latitude,
        longitude: point.longitude,
        address: `${intBetween(r, 1, 240)}, ${pick(r, STREETS)}, ${home.ward.name}`,
        slaMinutes: meta.slaMinutes,
        dueAt: new Date(createdAt.getTime() + meta.slaMinutes * 60_000),
        createdAt,
        assignedVehicleId: home.vehicle.id,
        assignedAt: new Date(createdAt.getTime() + 12 * 60_000),
        events: {
          create: [
            { status: 'PENDING', note: 'Report received', createdAt },
            { status: 'VERIFIED', note: 'AI verified (82%)', createdAt: new Date(createdAt.getTime() + 60_000) },
            {
              status: 'ASSIGNED',
              note: `Assigned to ${home.vehicle.registrationNumber}`,
              createdAt: new Date(createdAt.getTime() + 12 * 60_000),
            },
          ],
        },
      },
    });
  }

  // Two live emergencies so the officer's countdown panel is never empty.
  for (let i = 0; i < 2; i += 1) {
    const home = vehicles[i * 3];
    const r = rng(`demo-emergency-${i}`);
    const spec = i === 0 ? CATEGORY_MAP.DEAD_ANIMAL : CATEGORY_MAP.MEDICAL_WASTE;
    const point = pointInWard(home.index, 500 + i);
    const createdAt = new Date(Date.now() - intBetween(r, 5, 22) * 60_000);

    created += 1;
    await prisma.complaint.create({
      data: {
        code: `SS-SOS${i + 1}`,
        citizenId: citizens[(i + 5) % citizens.length].id,
        wardId: home.ward.id,
        category: spec.id,
        aiCategory: spec.id,
        aiConfidence: 0.91,
        aiVerified: true,
        status: 'PENDING',
        severity: 'CRITICAL',
        isEmergency: true,
        channel: 'APP',
        description: `${spec.label} reported on ${pick(r, STREETS)} — needs immediate clearance`,
        latitude: point.latitude,
        longitude: point.longitude,
        address: `${pick(r, STREETS)}, ${home.ward.name}`,
        slaMinutes: 30,
        dueAt: new Date(createdAt.getTime() + 30 * 60_000),
        createdAt,
        events: { create: [{ status: 'PENDING', note: 'Emergency reported', createdAt }] },
      },
    });
  }

  // ------------------------------------------------ today's live routes ----
  let routes = 0;
  for (const { vehicle, ward, index } of vehicles) {
    if (vehicle.maintenanceFlag) continue;

    const open = await prisma.complaint.findMany({
      where: { wardId: ward.id, status: { in: ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'asc' },
      take: 8,
    });
    if (open.length < 2) continue;

    const depot = pointInWard(index, 0);
    const solved = solveLocal({
      depot: { coordinates: [depot.longitude, depot.latitude] },
      stops: open.map((c) => ({
        complaintId: c.id,
        code: c.code,
        label: c.address,
        category: c.category,
        severity: c.severity,
        isEmergency: c.isEmergency,
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    });

    await prisma.route.create({
      data: {
        vehicleId: vehicle.id,
        driverId: vehicle.driverId,
        wardId: ward.id,
        date: new Date().toISOString().slice(0, 10),
        status: 'PUBLISHED',
        label: `${ward.name} morning beat`,
        orderedStops: solved.stops,
        polylineGeometry: drivablePolyline(solved.polyline),
        distanceKm: solved.distanceKm,
        baselineKm: solved.baselineKm,
        savedKm: solved.savedKm,
        durationMin: solved.durationMin,
        fuelSaved: solved.fuelSaved,
        co2SavedKg: solved.co2SavedKg,
        solver: solved.solver,
      },
    });

    await prisma.complaint.updateMany({
      where: { id: { in: open.map((c) => c.id) }, status: 'VERIFIED' },
      data: { assignedVehicleId: vehicle.id, status: 'ASSIGNED', assignedAt: new Date() },
    });
    routes += 1;
  }
  console.log(`[seed] ${routes} optimised routes published for today`);

  // ------------------------------------------------- emergency contacts ----
  /**
   * The three-digit national numbers are genuine. The municipal numbers are
   * demo placeholders on Gandhinagar's 079 STD code — swap them for the real
   * GMC directory before any live deployment.
   */
  const contacts = [
    { name: 'GMC Sanitation Helpline', category: 'helpline', phone: '079-23227900' },
    { name: 'Fire & Emergency Services', category: 'fire', phone: '101' },
    { name: 'Ambulance', category: 'hospital', phone: '108' },
    { name: 'Police Control Room', category: 'police', phone: '100' },
    { name: 'Animal Control — GMC', category: 'animal_control', phone: '079-23224466' },
    { name: 'Pest Control Cell', category: 'pest_control', phone: '079-23223311' },
    { name: 'Dead Animal Removal Squad', category: 'animal_control', phone: '079-23225913' },
    { name: 'GMC Health Department', category: 'helpline', phone: '079-23223751' },
  ];
  await prisma.emergencyContact.createMany({ data: contacts.map((c) => ({ ...c, isCityWide: true })) });

  // Ward-specific sanitation offices.
  await prisma.emergencyContact.createMany({
    data: wards.map(({ ward }, i) => ({
      name: `${ward.name} Zonal Sanitation Office`,
      category: 'helpline',
      phone: `079-232${String(20000 + i * 137).slice(0, 5)}`,
      wardId: ward.id,
      isCityWide: false,
    })),
  });

  console.log(`
  Safaai Sarathi demo data ready.

  Password for every seeded account: ${PASSWORD}

    Portal    Login page          Account
    -------   -----------------   ----------------------------
    Citizen   /login              citizen1@safaai.gov.in
    Driver    /driver/login       driver1@safaai.gov.in  (or OTP on 9700000001)
    Officer   /officer/login      officer1@safaai.gov.in
    Admin     /admin/login        admin@safaai.gov.in

  ${CITY.name}, ${CITY.state} — ${wards.length} wards, ${vehicles.length} vehicles, ${created} complaints.
`);

  await disconnectDB();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[seed] failed:', err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
