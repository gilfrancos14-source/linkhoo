import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createRateLimitStore } from './utils/rateLimitStore';
import { errorHandler } from './middleware/errorHandler';
import { requireClerkAuth } from './middleware/clerkAuth';
import type { RawBodyRequest } from './types/express';
import roomsRouter from './routes/rooms';
import categoriesRouter from './routes/categories';
import bannersRouter from './routes/banners';
import eventsRouter from './routes/events';
import tourismRouter from './routes/tourism';
import reservationsRouter from './routes/reservations';
import newsletterRouter from './routes/newsletter';
import contactRouter from './routes/contact';
import notificationsRouter from './routes/notifications';
import uploadRouter from './routes/upload';
import gerantsRouter from './routes/gerants';
import clientsRouter from './routes/clients';
import reviewsRouter from './routes/reviews';
import premiumRouter from './routes/premium';
import boostsRouter from './routes/boosts';
import adminRouter from './routes/admin';
import authRouter from './routes/auth';
import { startNotificationPurge } from './utils/notificationPurge';

const requiredEnvVars = ['CLERK_SECRET_KEY', 'ADMIN_JWT_SECRET', 'FEDAPAY_PUBLIC_KEY', 'FEDAPAY_SECRET_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[FATAL] Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();

// Derrière un reverse proxy (nginx, Render, Cloudflare…), Express doit lire le
// client réel dans X-Forwarded-For. Sans ça, req.ip = IP du proxy et TOUS les
// utilisateurs partagent le même seau de rate limiting (express-rate-limit
// compte par IP) : quelques clients actifs suffisent à vider la limite globale.
// TRUST_PROXY = nombre de sauts entre le proxy et nous (1 dans la majorité des
// cas). Non défini = pas de proxy (dev/local) → comportement inchangé, mais
// express-rate-limit signale alors la présence d'un header X-Forwarded-For.
// `true`/`false` sont acceptés ; `true` est converti en 1 pour ne pas déclencher
// l'erreur ERR_ERL_PERMISSIVE_TRUST_PROXY (qui refuse la valeur booléenne).
const rawTrustProxy = process.env.TRUST_PROXY?.trim();
let trustProxyHops = 0;
if (rawTrustProxy) {
  const normalized = rawTrustProxy.toLowerCase();
  const hops = normalized === 'true' ? 1
    : normalized === 'false' ? 0
    : Number(rawTrustProxy);
  if (!Number.isInteger(hops) || hops < 0) {
    console.error(`[FATAL] TRUST_PROXY invalide ("${rawTrustProxy}") : attendu un entier >= 0 ou true/false`);
    process.exit(1);
  }
  trustProxyHops = hops;
  if (hops > 0) app.set('trust proxy', hops);
}
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';

// Garde-fou P0 : derrière un proxy, req.ip = IP du proxy sans TRUST_PROXY,
// donc TOUS les clients partagent le même seau de rate limiting (les 429
// frappent tout le monde et la protection IP devient nulle). Avertissement
// explicite en production plutôt qu'un silence trompeur.
if (isProduction && trustProxyHops <= 0) {
  console.warn(
    '[SECURITY] TRUST_PROXY non défini en production : req.ip est l\'IP du reverse proxy, ' +
      'tous les clients partagent la même limite de rate limiting. ' +
      'Définissez TRUST_PROXY=1 (nginx, Render, Cloudflare…) — voir .env.example.',
  );
}
const defaultOrigins = isProduction
  ? ''
  : 'http://localhost:5173,http://127.0.0.1:5173';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || defaultOrigins)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  console.error('[FATAL] ALLOWED_ORIGINS manquant ou vide : définissez la liste des origines autorisées (ex: https://app.ilehya.com)');
  process.exit(1);
}

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('write'),
  skip: (req) => req.method === 'GET',
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('upload'),
  message: { error: 'Limite d\'uploads atteinte, veuillez réessayer plus tard' },
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('admin-login'),
  message: { error: 'Trop de tentatives de connexion, veuillez réessayer plus tard' },
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('webhook'),
  message: { error: 'Trop de requêtes webhook' },
});

app.disable('x-powered-by');
// gzip/brotli : les JSON de la home (salles, bannières, événements) perdent
// ~70 % de poids. À placer avant toutes les routes.
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Endpoints publics modifiables depuis le back-office : le navigateur peut
// réutiliser la réponse immédiatement mais doit la revalider (304 via ETag)
// dès qu'elle est périmée — jamais de bannière/événement obsolète servi
// 60 s après une édition. stale-while-revalidate peint sans attendre.
const PUBLIC_CACHE_PATHS = [
  '/api/banners',
  '/api/categories',
  '/api/events',
  '/api/tourism',
  '/api/reviews/featured',
  '/api/rooms/popular',
  '/api/boosts/featured',
];
app.use((req, res, next) => {
  if (req.method === 'GET' && PUBLIC_CACHE_PATHS.includes(req.path)) {
    res.set('Cache-Control', 'public, max-age=0, stale-while-revalidate=300');
  }
  next();
});
app.use('/api/premium/webhook', webhookLimiter, express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    (req as RawBodyRequest).rawBody = buf.toString('utf8');
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', writeLimiter);
app.use('/api/upload', uploadLimiter);

app.use('/api/rooms', roomsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tourism', tourismRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/contact', contactRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/auth', requireClerkAuth, authRouter);
app.use('/api/gerants', requireClerkAuth, gerantsRouter);
app.use('/api/clients', requireClerkAuth, clientsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/premium', premiumRouter);
app.use('/api/boosts', boostsRouter);
app.use('/api/admin/login', adminLoginLimiter, adminRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});
app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  // P1 #8 : purge quotidienne des notifications de plus de 30 jours
  // (timers unref, jamais bloquant pour l'arrêt du process).
  startNotificationPurge();
});

process.on('unhandledRejection', (reason, _promise) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => process.exit(0));
});

export default app;
