import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import authRoutes from './auth.routes.js';
import citizenRoutes from './citizen.routes.js';
import driverRoutes from './driver.routes.js';
import officerRoutes from './officer.routes.js';
import adminRoutes from './admin.routes.js';
import publicRoutes from './public.routes.js';
import { aiHealth } from '../services/ai.service.js';
import { escalationStatus } from '../services/escalation.service.js';
import { simulatorStatus } from '../services/simulator.js';
import { passwordDriver } from '../lib/password.js';
import { googleEnabled } from '../lib/google.js';

const router = Router();

router.get('/health', async (_req, res) => {
  let db = { state: 'disconnected' };
  try {
    const [row] = await prisma.$queryRaw`select current_database() as name, current_setting('server_version') as version`;
    db = { state: 'connected', ...row };
  } catch (err) {
    db = { state: 'error', error: err.message };
  }

  res.json({
    status: db.state === 'connected' ? 'ok' : 'degraded',
    service: 'safaai-sarathi-api',
    time: new Date(),
    db,
    auth: { passwordHashing: passwordDriver(), googleOAuth: googleEnabled() },
    ai: await aiHealth(),
    escalation: escalationStatus(),
    simulator: simulatorStatus(),
  });
});

/**
 * Four separate API namespaces. The portal guard on each router is what makes
 * these genuinely isolated rather than four views of the same surface.
 */
router.use('/auth', authRoutes);
router.use('/public', publicRoutes);
router.use('/citizen', citizenRoutes);
router.use('/driver', driverRoutes);
router.use('/officer', officerRoutes);
router.use('/admin', adminRoutes);

export default router;
