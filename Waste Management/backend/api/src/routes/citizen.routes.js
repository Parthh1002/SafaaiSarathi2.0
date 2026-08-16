import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requirePortal, loadUser } from '../middleware/auth.js';
import { reportLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { upload, persist, fileFromRequest } from '../middleware/upload.js';
import { prisma } from '../lib/prisma.js';
import { PORTALS, WASTE_CATEGORIES, EMERGENCY_TYPES, CREDIT_RULES } from '../config/constants.js';
import { createComplaint, serializeComplaint, findDuplicate, wardForPoint } from '../services/complaint.service.js';
import { distanceMeters, boundsAround } from '../lib/geo.js';

const router = Router();
router.use(requirePortal(PORTALS.CITIZEN), loadUser);

const coordinate = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

/** Home: credits, active reports, the truck heading their way. */
router.get(
  '/home',
  asyncHandler(async (req, res) => {
    const [active, resolvedCount, ward] = await Promise.all([
      prisma.complaint.findMany({
        where: { citizenId: req.user.id, status: { notIn: ['RESOLVED', 'REJECTED'] } },
        include: { ward: true, assignedVehicle: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.complaint.count({ where: { citizenId: req.user.id, status: 'RESOLVED' } }),
      req.user.wardId ? prisma.ward.findUnique({ where: { id: req.user.wardId } }) : null,
    ]);

    const trackable = active.find((c) => c.assignedVehicleId);
    let truck = null;
    if (trackable?.assignedVehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: trackable.assignedVehicleId },
        select: { id: true, registrationNumber: true, lastLat: true, lastLng: true, lastHeading: true, status: true },
      });
      if (vehicle?.lastLat != null) {
        const metres = distanceMeters(
          { latitude: trackable.latitude, longitude: trackable.longitude },
          { latitude: vehicle.lastLat, longitude: vehicle.lastLng }
        );
        truck = {
          ...vehicle,
          complaintCode: trackable.code,
          distanceMeters: Math.round(metres),
          // 20 km/h average city speed, floor of one minute.
          etaMinutes: Math.max(1, Math.round((metres / 1000 / 20) * 60)),
          room: `truck:${vehicle.id}`,
        };
      }
    }

    res.json({
      user: {
        name: req.user.name,
        greenCredits: req.user.greenCredits,
        language: req.user.language,
        ward: ward ? { id: ward.id, name: ward.name, code: ward.code } : null,
      },
      stats: {
        active: active.length,
        resolved: resolvedCount,
        credits: req.user.greenCredits,
      },
      activeComplaints: active.map((c) => serializeComplaint(c)),
      truck,
      creditRules: CREDIT_RULES,
    });
  })
);

/** Nearby reports feed — what else is happening around me. */
router.get(
  '/feed',
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = coordinate.parse(req.query);
    const radius = Math.min(5000, Number(req.query.radius) || 1500);
    const bounds = boundsAround({ latitude, longitude }, radius);

    const complaints = await prisma.complaint.findMany({
      where: {
        latitude: { gte: bounds.minLat, lte: bounds.maxLat },
        longitude: { gte: bounds.minLng, lte: bounds.maxLng },
        duplicateOfId: null,
        createdAt: { gte: new Date(Date.now() - 14 * 864e5) },
      },
      include: { ward: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    const nearby = complaints
      .map((c) => ({ complaint: c, metres: distanceMeters({ latitude, longitude }, c) }))
      .filter((x) => x.metres <= radius)
      .sort((a, b) => a.metres - b.metres)
      .map(({ complaint, metres }) => ({
        ...serializeComplaint(complaint),
        distanceMeters: Math.round(metres),
      }));

    res.json(nearby);
  })
);

/**
 * Report filing (plan §2.1). Accepts multipart with a required photo or
 * JSON with a photoUrl already uploaded.
 */
router.post(
  '/report',
  reportLimiter,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const file = fileFromRequest(req);
    let photoUrl = req.body?.photoUrl;
    if (file) {
      const persisted = await persist(file, 'complaints');
      photoUrl = persisted.url;
    }
    if (!photoUrl) {
      throw new HttpError(400, 'A photo is required to file a report');
    }

    const body = z
      .object({
        latitude: z.coerce.number().min(-90).max(90),
        longitude: z.coerce.number().min(-180).max(180),
        address: z.string().max(300).optional(),
        userCategory: z.enum(WASTE_CATEGORIES).optional(),
        description: z.string().max(1000).optional(),
        channel: z.enum(['APP', 'WEB', 'WHATSAPP', 'IVR']).optional(),
        isEmergency: z.coerce.boolean().optional(),
      })
      .parse(req.body);

    const result = await createComplaint({
      citizenId: req.user.id,
      latitude: body.latitude,
      longitude: body.longitude,
      address: body.address,
      userCategory: body.userCategory,
      description: body.description,
      photoUrl,
      channel: body.channel || 'APP',
      isEmergency: Boolean(body.isEmergency),
    });

    res.status(201).json(result);
  })
);

/** The red button: high-priority report with 30-min SLA timer. */
router.post(
  '/emergency',
  reportLimiter,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const file = fileFromRequest(req);
    let photoUrl = req.body?.photoUrl;
    if (file) {
      const persisted = await persist(file, 'emergencies');
      photoUrl = persisted.url;
    }

    const body = z
      .object({
        category: z.enum(EMERGENCY_TYPES),
        latitude: z.coerce.number().min(-90).max(90),
        longitude: z.coerce.number().min(-180).max(180),
        address: z.string().max(300).optional(),
        description: z.string().max(1000).optional(),
      })
      .parse(req.body);

    const result = await createComplaint({
      citizenId: req.user.id,
      latitude: body.latitude,
      longitude: body.longitude,
      address: body.address,
      userCategory: body.category,
      description: body.description,
      photoUrl: photoUrl || 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=800',
      channel: 'APP',
      isEmergency: true,
    });

    res.status(201).json(result);
  })
);

/** Duplicate pre-check: called as the user frames the photo. */
router.get(
  '/duplicates/check',
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = coordinate.parse(req.query);
    const category = req.query.category ? String(req.query.category) : undefined;
    const ward = await wardForPoint({ latitude, longitude });
    const duplicate = await findDuplicate({ latitude, longitude, category, wardId: ward?.id });
    if (!duplicate) return res.json({ duplicate: null });
    res.json({
      duplicate: {
        id: duplicate.complaint.id,
        code: duplicate.complaint.code,
        category: duplicate.complaint.category,
        status: duplicate.complaint.status,
        photoUrl: duplicate.complaint.photoUrl,
        distanceMeters: Math.round(duplicate.distanceMeters),
        upvotes: duplicate.complaint.upvotes,
      },
    });
  })
);

/** Upvote / confirm an existing report instead of creating a duplicate. */
router.post(
  '/complaints/:id/upvote',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (!complaint) throw new HttpError(404, 'Complaint not found');
    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: { upvotes: { increment: 1 } },
    });
    res.json({ id: updated.id, upvotes: updated.upvotes });
  })
);

/** List of complaints filed by the signed-in citizen. */
router.get(
  '/complaints',
  asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const rows = await prisma.complaint.findMany({
      where: {
        citizenId: req.user.id,
        status: status ? status : undefined,
      },
      include: { ward: true, assignedVehicle: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(rows.map((c) => serializeComplaint(c)));
  })
);

/** Full complaint detail + timeline + live truck position when assigned. */
router.get(
  '/complaints/:id',
  asyncHandler(async (req, res) => {
    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
      include: {
        ward: true,
        assignedVehicle: {
          select: { id: true, registrationNumber: true, lastLat: true, lastLng: true, lastHeading: true, status: true },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!complaint) throw new HttpError(404, 'Complaint not found');
    if (complaint.citizenId !== req.user.id) {
      throw new HttpError(403, 'You do not own this complaint');
    }

    let truck = null;
    if (complaint.assignedVehicle?.lastLat != null) {
      const metres = distanceMeters(
        { latitude: complaint.latitude, longitude: complaint.longitude },
        { latitude: complaint.assignedVehicle.lastLat, longitude: complaint.assignedVehicle.lastLng }
      );
      truck = {
        ...complaint.assignedVehicle,
        distanceMeters: Math.round(metres),
        etaMinutes: Math.max(1, Math.round((metres / 1000 / 20) * 60)),
        room: `truck:${complaint.assignedVehicle.id}`,
      };
    }

    res.json({
      ...serializeComplaint(complaint),
      timeline: complaint.events.map((e) => ({
        status: e.status,
        note: e.note,
        at: e.createdAt,
      })),
      truck,
    });
  })
);

/** Wallet ledger: point transactions + current balance. */
router.get(
  '/credits',
  asyncHandler(async (req, res) => {
    const [user, history] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { greenCredits: true },
      }),
      prisma.greenCredit.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    res.json({
      balance: user?.greenCredits ?? 0,
      history: history.map((h) => ({
        id: h.id,
        delta: h.delta,
        balanceAfter: h.balanceAfter,
        reason: h.reason,
        reasonCode: h.reasonCode,
        createdAt: h.createdAt,
        complaintId: h.complaintId,
      })),
      rules: CREDIT_RULES,
    });
  })
);

/** Real Voucher Redemption: validates balance, deducts points, records transaction */
router.post(
  '/rewards/redeem',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { rewardId, pointsRequired, category, title } = z
      .object({
        rewardId: z.string(),
        pointsRequired: z.number().min(1),
        category: z.string(),
        title: z.string(),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, greenCredits: true, name: true },
    });

    if (!user || user.greenCredits < pointsRequired) {
      throw new HttpError(400, `Insufficient Green Credits. You need ${pointsRequired} credits.`);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { greenCredits: { decrement: pointsRequired } },
      select: { greenCredits: true },
    });

    const voucherCode = `SS-${category}-${Math.random().toString(36).substring(2, 7).toUpperCase()}-2026`;

    await prisma.greenCredit.create({
      data: {
        userId: req.user.id,
        delta: -pointsRequired,
        balanceAfter: updatedUser.greenCredits,
        reason: `Redeemed voucher: ${title}`,
        reasonCode: 'REWARD_REDEMPTION',
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'reward_redeem',
        targetTable: 'green_credits',
        targetId: rewardId,
        details: { rewardId, voucherCode, pointsRequired, newBalance: updatedUser.greenCredits },
      },
    });

    res.json({
      success: true,
      voucherCode,
      rewardId,
      newBalance: updatedUser.greenCredits,
      message: `🎉 Successfully claimed voucher: ${voucherCode}`,
    });
  })
);

/** Ward and city leaderboard. */
router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const scope = req.query.scope === 'ward' && req.user.wardId ? 'ward' : 'city';
    const where = scope === 'ward' ? { wardId: req.user.wardId, role: 'CITIZEN' } : { role: 'CITIZEN' };

    const [top, ahead, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, greenCredits: true },
        orderBy: { greenCredits: 'desc' },
        take: 10,
      }),
      prisma.user.count({ where: { ...where, greenCredits: { gt: req.user.greenCredits } } }),
      prisma.user.count({ where }),
    ]);

    res.json({
      rank: ahead + 1,
      total,
      me: { id: req.user.id, name: req.user.name, greenCredits: req.user.greenCredits },
      top: top.map((u, i) => ({
        position: i + 1,
        name: u.id === req.user.id ? u.name : maskName(u.name),
        greenCredits: u.greenCredits,
        isMe: u.id === req.user.id,
      })),
    });
  })
);

const maskName = (name) => {
  const parts = String(name).trim().split(/\s+/);
  return parts.map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(' ');
};

/** AI Safaai Sahayak Chatbot endpoint */
router.post(
  '/chatbot',
  asyncHandler(async (req, res) => {
    const { message, lang = 'en' } = z
      .object({
        message: z.string().min(1).max(500),
        lang: z.enum(['en', 'hi', 'gu']).optional(),
      })
      .parse(req.body);

    const query = message.toLowerCase();
    let reply = '';
    let answered = true;

    if (query.includes('report') || query.includes('complaint') || query.includes('शिकायत') || query.includes('ફરિયાદ')) {
      reply =
        lang === 'gu'
          ? 'ફરિયાદ કરવા માટે નીચે "Report" બટન દબાવો, કચરાનો લાઈવ ફોટો પાડો, અમારું AI ઓટોમેટિક કેટેગરી ઓળખી લેશે અને લાઈવ GPS સાથે સબમિટ કરી દો!'
          : lang === 'hi'
            ? 'शिकायत दर्ज करने के लिए नीचे "Report" टैब पर जाएँ, कचरे की फोटो लें, हमारा AI अपने आप श्रेणी पहचान लेगा और GPS के साथ सबमिट कर दें!'
            : 'To report waste, tap the "+" (Report) tab at the bottom, take a live photo of the waste, verify the AI-detected category, and submit with your GPS location!';
    } else if (query.includes('wet') || query.includes('dry') || query.includes('गीला') || query.includes('सूखा') || query.includes('ભીનો') || query.includes('સૂકો')) {
      reply =
        lang === 'gu'
          ? 'લીલી કચરાપેટી: ભીનો કચરો (રસોડાનો કચરો, શાકભાજી, ફળોની છાલ).\nભૂરી કચરાપેટી: સૂકો કચરો (પ્લાસ્ટિક, કાગળ, કાચ, ધાતુ).'
          : lang === 'hi'
            ? 'हरा कूड़ेदान: गीला कचरा (रसोई का कचरा, फल, सब्जियां).\nनीला कूड़ेदान: सूखा कचरा (प्लास्टिक, कागज, कांच, धातु).'
            : 'Green Bin: Wet/Biodegradable waste (food scraps, vegetable peels).\nBlue Bin: Dry/Recyclable waste (plastic, paper, glass, metal).';
    } else if (query.includes('reward') || query.includes('point') || query.includes('credit') || query.includes('રિવોર્ડ') || query.includes('पॉइंट')) {
      reply =
        lang === 'gu'
          ? `તમારી પાસે હાલમાં ${req.user.greenCredits} ગ્રીન ક્રેડિટ્સ છે! દરેક વેરિફાઈડ ફરિયાદ પર 50 ક્રેડિટ્સ મળે છે જેને "Rewards" ટેબમાં વાઉચર માટે વાપરી શકો છો.`
          : lang === 'hi'
            ? `आपके पास वर्तमान में ${req.user.greenCredits} ग्रीन क्रेडिट्स हैं! प्रत्येक मान्य रिपोर्ट पर 50 क्रेडिट्स मिलते हैं जिन्हें "Rewards" टैब में रिडीમ कर सकते हैं.`
            : `You currently have ${req.user.greenCredits} Green Credits! You earn 50 credits per verified complaint, redeemable for tax rebates and bus passes in the Rewards tab.`;
    } else if (query.includes('help') || query.includes('phone') || query.includes('number') || query.includes('हेल्पलाइन') || query.includes('નંબર')) {
      reply =
        'Sanitation Control Room: 079-23227900 | Fire: 101 | Ambulance: 108 | Police: 100. Open the Helpline Directory tab for all zonal contacts.';
    } else {
      answered = false;
      reply =
        lang === 'gu'
          ? 'હું સ્વચ્છતા સહાયક છું. આપ કચરાની ફરિયાદ કરી શકો છો, કલેક્શન વાન લાઈવ ટ્રેક કરી શકો છો અથવા 079-23227900 પર સંપર્ક કરી શકો છો.'
          : lang === 'hi'
            ? 'मैं स्वच्छता सहायक हूँ। आप कचरे की शिकायत दर्ज कर सकते हैं, वैन ट्रैक कर सकते हैं या 079-23227900 पर संपर्क कर सकते हैं।'
            : "I'm here to help with waste management and city sanitation. You can file a complaint with photo proof in the Report tab, track collection trucks in real-time, or call the 24/7 Helpline at 079-23227900.";
    }

    res.json({
      reply,
      answered,
      userContext: {
        credits: req.user.greenCredits,
        ward: req.user.ward?.name,
      },
    });
  })
);

/** Community directory — cached offline by the client. */
router.get(
  '/directory',
  asyncHandler(async (req, res) => {
    const contacts = await prisma.emergencyContact.findMany({
      where: req.user.wardId ? { OR: [{ isCityWide: true }, { wardId: req.user.wardId }] } : { isCityWide: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(contacts);
  })
);

router.get('/categories', (_req, res) => res.json(WASTE_CATEGORIES));

router.patch(
  '/profile',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(80).optional(),
        language: z.enum(['en', 'hi', 'gu']).optional(),
        wardId: z.string().optional(),
      })
      .parse(req.body);

    const user = await prisma.user.update({ where: { id: req.user.id }, data: body, include: { ward: true } });
    res.json({
      name: user.name,
      language: user.language,
      ward: user.ward ? { id: user.ward.id, name: user.ward.name } : null,
    });
  })
);

router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const rows = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(rows);
  })
);

router.post(
  '/notifications/read',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  })
);

// ------------------------------------------------ Scheduled Pickup Requests ----

const scheduledPickupSchema = z.object({
  locationType: z.enum(['MY_HOME', 'COMMON_PLOT_SOCIETY']).default('MY_HOME'),
  address: z.string().min(3).max(300),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  eventReason: z.string().min(3).max(200),
  expectedCategories: z.array(z.string()).min(1),
  expectedQuantity: z.enum(['SMALL', 'MEDIUM', 'LARGE']).default('MEDIUM'),
  scheduledDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid target date'),
  scheduledTimeSlot: z.enum(['MORNING', 'AFTERNOON', 'EVENING']).default('MORNING'),
  additionalNotes: z.string().max(500).optional().nullable(),
});

/** POST /api/citizen/scheduled-pickup — Create advance event pickup request */
router.post(
  '/scheduled-pickup',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const body = scheduledPickupSchema.parse(req.body);
    const targetDate = new Date(body.scheduledDate);
    const now = new Date();

    // Lead-time validation: minimum 24 hours ahead
    const hoursAhead = (targetDate.getTime() - now.getTime()) / 3600_000;
    if (hoursAhead < 20) {
      throw new HttpError(400, 'Scheduled pickup requires at least 24 hours advance notice.');
    }

    // Auto-detect ward from coordinates
    const ward = await wardForPoint({ latitude: body.latitude, longitude: body.longitude });

    const code = `SP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const request = await prisma.scheduledPickupRequest.create({
      data: {
        code,
        citizenId: req.user.id,
        wardId: ward?.id ?? req.user.wardId ?? null,
        locationType: body.locationType,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        eventReason: body.eventReason,
        expectedCategories: body.expectedCategories,
        expectedQuantity: body.expectedQuantity,
        scheduledDate: targetDate,
        scheduledTimeSlot: body.scheduledTimeSlot,
        additionalNotes: body.additionalNotes || null,
        status: 'PENDING_REVIEW',
      },
      include: {
        ward: { select: { id: true, name: true } },
      },
    });

    // Notify citizen confirmation
    await notify({
      userId: req.user.id,
      type: 'SYSTEM',
      title: `Scheduled Pickup Requested (${code})`,
      body: `Your request for "${body.eventReason}" on ${targetDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} has been submitted for ward officer review.`,
      payload: { requestId: request.id, code },
    });

    // Notify Ward Officers
    if (request.wardId) {
      await notifyWardOfficers(request.wardId, {
        type: 'SYSTEM',
        title: `New Scheduled Request: ${code}`,
        body: `New event request in ${request.ward?.name || 'your ward'}: "${body.eventReason}" scheduled for ${targetDate.toLocaleDateString('en-IN')}.`,
        payload: { requestId: request.id, code },
      });
    }

    res.status(201).json(request);
  })
);

/** GET /api/citizen/scheduled-pickup — List citizen's scheduled requests */
router.get(
  '/scheduled-pickup',
  asyncHandler(async (req, res) => {
    const items = await prisma.scheduledPickupRequest.findMany({
      where: { citizenId: req.user.id },
      include: {
        ward: { select: { id: true, name: true } },
        assignedDriver: { select: { id: true, name: true, phone: true } },
        assignedVehicle: { select: { id: true, registrationNumber: true, model: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    });
    res.json({ items });
  })
);

/** GET /api/citizen/scheduled-pickup/:id — View single request detail */
router.get(
  '/scheduled-pickup/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.scheduledPickupRequest.findFirst({
      where: { id: req.params.id, citizenId: req.user.id },
      include: {
        ward: { select: { id: true, name: true } },
        assignedDriver: { select: { id: true, name: true, phone: true } },
        assignedVehicle: { select: { id: true, registrationNumber: true, model: true } },
      },
    });
    if (!item) throw new HttpError(404, 'Scheduled pickup request not found');
    res.json(item);
  })
);

/** POST /api/citizen/scheduled-pickup/:id/cancel — Cancel pending/approved request */
router.post(
  '/scheduled-pickup/:id/cancel',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const item = await prisma.scheduledPickupRequest.findFirst({
      where: { id: req.params.id, citizenId: req.user.id },
    });
    if (!item) throw new HttpError(404, 'Scheduled pickup request not found');

    if (!['PENDING_REVIEW', 'APPROVED_SCHEDULED', 'ASSIGNED'].includes(item.status)) {
      throw new HttpError(400, `Cannot cancel request in "${item.status}" state.`);
    }

    const updated = await prisma.scheduledPickupRequest.update({
      where: { id: item.id },
      data: { status: 'CANCELLED' },
      include: {
        assignedDriver: { select: { id: true } },
      },
    });

    // Notify assigned driver if one was assigned
    if (updated.assignedDriverId) {
      await notify({
        userId: updated.assignedDriverId,
        type: 'SYSTEM',
        title: `Scheduled Task Cancelled (${item.code})`,
        body: `Citizen cancelled the scheduled pickup for "${item.eventReason}".`,
        payload: { requestId: item.id, code: item.code },
      });
    }

    res.json({ ok: true, status: 'CANCELLED', item: updated });
  })
);

export default router;
