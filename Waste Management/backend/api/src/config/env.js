import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(apiRoot, '.env') });

const bool = (v, fallback = false) => {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const num = (v, fallback) => (v === undefined || v === '' ? fallback : Number(v));

export const env = {
  root: apiRoot,
  port: num(process.env.PORT, 5100),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  databaseUrl: process.env.DATABASE_URL || '',

  brevoApiKey: process.env.BREVO_API_KEY,
  brevoSmtpLogin: process.env.BREVO_SMTP_LOGIN,
  brevoSmtpPassword: process.env.BREVO_SMTP_PASSWORD,
  smtpFrom: process.env.SMTP_FROM,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me',
    refreshTtlDays: num(process.env.JWT_REFRESH_TTL_DAYS, 7),
  },
  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
    secure: bool(process.env.COOKIE_SECURE, false),
    sameSite: 'strict',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5100/api/auth/citizen/google/callback',
    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5273')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8100',
  routingServiceUrl: process.env.ROUTING_SERVICE_URL || '',
  redisUrl: process.env.REDIS_URL || '',

  storageDriver: process.env.STORAGE_DRIVER || 'local',
  uploadDir: path.join(apiRoot, 'uploads'),

  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || '',
    bucket: process.env.SUPABASE_BUCKET || 'uploads',
  },

  smtpUrl: process.env.SMTP_URL || '',
  mailFrom: process.env.MAIL_FROM || 'Safaai Sarathi <no-reply@safaaisarathi.local>',

  ai: {
    autoApproveConfidence: num(process.env.AI_CONFIDENCE_AUTO_APPROVE, 0.7),
    fraudReviewThreshold: num(process.env.AI_FRAUD_REVIEW_THRESHOLD, 0.6),
  },

  escalation: {
    emergencyMinutes: num(process.env.ESCALATION_EMERGENCY_MINUTES, 30),
    standardMinutes: num(process.env.ESCALATION_STANDARD_MINUTES, 1440),
  },

  simulator: {
    enabled: bool(process.env.SIMULATOR_ENABLED, true),
    intervalMs: num(process.env.SIMULATOR_INTERVAL_MS, 2000),
  },
};

/** Fail loudly and usefully when the database is not configured yet. */
export function assertDatabaseConfigured() {
  if (!env.databaseUrl || env.databaseUrl.includes('YOUR_PASSWORD_HERE')) {
    console.error(`
  DATABASE_URL is not set.

  Edit api/.env and put the password for the 'postgres' role into DATABASE_URL:
    DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5432/waste_management?schema=public"

  Then create the database and tables:
    npm run db:push
    npm run seed
`);
    process.exit(1);
  }
}

export default env;
