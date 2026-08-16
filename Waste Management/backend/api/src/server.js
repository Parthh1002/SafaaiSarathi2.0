import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import env, { assertDatabaseConfigured } from './config/env.js';
import { connectDB, disconnectDB } from './lib/prisma.js';
import apiRoutes from './routes/index.js';
import { requestId, notFound, errorHandler } from './middleware/error.js';
import { ensureUploadDir } from './middleware/upload.js';
import { initRealtime, onDriverLocation } from './sockets/realtime.js';
import { ingestLocation } from './services/tracking.service.js';
import { startEscalationWatcher } from './services/escalation.service.js';
import { startSimulator } from './services/simulator.js';
import { startScheduledReminderWatcher } from './services/reminder.service.js';
import { passwordDriver } from './lib/password.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || env.clientOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(cookieParser());
app.use(requestId);
app.use(morgan(env.isProd ? 'combined' : ':method :url :status :response-time ms'));

app.use('/uploads', express.static(ensureUploadDir(), { maxAge: '7d' }));

app.get('/', (_req, res) =>
  res.json({
    service: 'Safaai Sarathi API',
    tagline: 'AI-verified civic response, not just complaint intake',
    health: '/api/health',
    version: '1.0.0',
  })
);

app.use('/api', apiRoutes);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);

async function bootstrap() {
  assertDatabaseConfigured();
  await connectDB();

  initRealtime(server);
  // The socket channel and the REST endpoint share one ingest path.
  onDriverLocation(async (payload) => {
    try {
      await ingestLocation({
        driverId: payload.driverId,
        vehicleId: payload.truckId || payload.vehicleId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        heading: payload.heading,
        speed: payload.speed,
        ts: payload.ts,
      });
    } catch (err) {
      console.warn('[socket] driver:location rejected:', err.message);
    }
  });

  server.listen(env.port, () => {
    console.log(`
  Safaai Sarathi API   http://localhost:${env.port}
  Health               http://localhost:${env.port}/api/health
  AI service           ${env.aiServiceUrl}
  Password hashing     ${passwordDriver()}
  Web origins          ${env.clientOrigins.join(', ')}
`);
  });

  startEscalationWatcher();
  startScheduledReminderWatcher();
  startSimulator().catch((err) => console.warn('[boot] simulator skipped:', err.message));
}

bootstrap().catch(async (err) => {
  console.error('[boot] failed to start:', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});

const shutdown = async (signal) => {
  console.log(`\n[${signal}] shutting down`);
  server.close(() => {});
  await disconnectDB().catch(() => {});
  setTimeout(() => process.exit(0), 500).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
