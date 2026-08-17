import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { prisma } from '../lib/prisma.js';
import { WASTE_CATEGORIES } from '../config/constants.js';

const router = Router();

/**
 * Landing-page impact counters. Aggregate only — no personal data, no auth.
 * These are what make the first screen real instead of decorative.
 */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const since = new Date(Date.now() - 30 * 864e5);
    const [total, resolved, wards, vehicles, citizens, recentResolved] = await Promise.all([
      prisma.complaint.count(),
      prisma.complaint.count({ where: { status: 'RESOLVED' } }),
      prisma.ward.count(),
      prisma.vehicle.count(),
      prisma.user.count({ where: { role: 'CITIZEN' } }),
      prisma.complaint.findMany({
        where: { resolvedAt: { gte: since } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    const avgMinutes = recentResolved.length
      ? Math.round(
          recentResolved.reduce((a, c) => a + (c.resolvedAt - c.createdAt) / 60_000, 0) / recentResolved.length
        )
      : 0;

    res.json({
      city: 'Gandhinagar',
      complaintsTotal: total,
      complaintsResolved: resolved,
      resolutionRatePct: total ? Math.round((resolved / total) * 100) : 0,
      avgResolutionHours: Number((avgMinutes / 60).toFixed(1)),
      wards,
      vehicles,
      citizens,
      updatedAt: new Date(),
    });
  })
);

/** Ward boundaries for the public map — geometry only. */
router.get(
  '/wards',
  asyncHandler(async (_req, res) => {
    const wards = await prisma.ward.findMany({
      select: { id: true, name: true, code: true, zone: true, boundary: true, centerLat: true, centerLng: true },
      orderBy: { code: 'asc' },
    });
    res.json({
      type: 'FeatureCollection',
      features: wards.map((w) => ({
        type: 'Feature',
        properties: { id: w.id, name: w.name, code: w.code, zone: w.zone, centerLat: w.centerLat, centerLng: w.centerLng },
        geometry: w.boundary,
      })),
    });
  })
);

router.get('/categories', (_req, res) => res.json(WASTE_CATEGORIES));

/** AI Safaai Sahayak Chatbot endpoint (Public & Citizen accessible) */
router.post(
  '/chatbot',
  asyncHandler(async (req, res) => {
    const { message, lang = 'en' } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    let userContext = { name: 'Citizen', credits: 0, ward: 'Gandhinagar Ward' };

    // If request contains Bearer token, load real citizen context
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      try {
        const token = header.slice(7);
        const { verifyAccessToken } = await import('../lib/tokens.js');
        const claims = verifyAccessToken(token);
        if (claims?.sub) {
          const user = await prisma.user.findUnique({
            where: { id: claims.sub },
            include: { ward: true },
          });
          if (user) {
            userContext = {
              name: user.name,
              credits: user.greenCredits,
              ward: user.ward?.name || 'Gandhinagar Ward',
            };
          }
        }
      } catch {
        // Continue with anonymous context
      }
    }

    const { askGroqChatbot } = await import('../services/groq.service.js');
    const aiReply = await askGroqChatbot({ message, lang, userContext });
    if (aiReply) {
      return res.json({
        reply: aiReply,
        answered: true,
        aiPowered: true,
        userContext,
      });
    }

    // Fallback if AI service is temporarily offline
    const query = message.toLowerCase();
    let reply = '';
    if (query.includes('report') || query.includes('complaint') || query.includes('शिकायत') || query.includes('ફરિયાદ')) {
      reply =
        lang === 'gu'
          ? 'ફરિયાદ કરવા માટે "Report" બટન દબાવો, કચરાનો લાઈવ ફોટો પાડો, અમારું AI ઓટોમેટિક કેટેગરી ઓળખી લેશે અને લાઈવ GPS સાથે સબમિટ થઈ જશે!'
          : lang === 'hi'
            ? 'शिकायत दर्ज करने के लिए "Report" टैब पर जाएँ, कचरे की फोटो लें, हमारा AI अपने आप श्रेणी पहचान लेगा और GPS के साथ सबमिट कर देगा!'
            : 'To report waste, tap the "Report an issue" button, snap a live photo of the waste, verify the AI-detected category, and submit with your GPS location!';
    } else {
      reply =
        lang === 'gu'
          ? 'હું સફાઈ સહાયક છું. આપ કચરાની ફરિયાદ કરી શકો છો, કલેક્શન વાન લાઈવ ટ્રેક કરી શકો છો અથવા 079-23227900 પર સંપર્ક કરી શકો છો.'
          : lang === 'hi'
            ? 'मैं स्वच्छता सहायक हूँ। आप कचरे की शिकायत दर्ज कर सकते हैं, वैन ट्रैक कर सकते हैं या 079-23227900 पर संपर्क कर सकते हैं।'
            : "I'm here to help with waste management and city sanitation. Tap 'Report an issue' to file a complaint with photo proof or call 079-23227900.";
    }

    res.json({
      reply,
      answered: true,
      aiPowered: false,
      userContext,
    });
  })
);

export default router;

