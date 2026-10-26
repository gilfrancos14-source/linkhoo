import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createRateLimitStore } from './utils/rateLimitStore';
import { skipWriteQuota, userOrIpKey } from './utils/rateLimiters';
import { readTrackVisitor } from './utils/trackVisitor';
import { usesAdminCookie } from './utils/adminCookie';
import { errorHandler } from './middleware/errorHandler';
import { requireClerkAuth } from './middleware/clerkAuth';
import type { RawBodyRequest } from './types/express';
import roomsRouter from './routes/rooms';
import categoriesRouter from './routes/categories';
import bannersRouter from './routes/banners';
import eventsRouter from './routes/events';
import tourismRouter from './routes/tourism';
import escapadesRouter from './routes/escapades';
import reservationsRouter from './routes/reservations';
import newsletterRouter from './routes/newsletter';
import contactRouter from './routes/contact';
import notificationsRouter from './routes/notifications';
import uploadRouter from './routes/upload';
import gerantsRouter from './routes/gerants';
import clientsRouter from './routes/clients';
import reviewsRouter from './routes/reviews';
import messagesRouter from './routes/messages';
import premiumRouter from './routes/premium';
import boostsRouter from './routes/boosts';
import adminRouter from './routes/admin';
import authRouter from './routes/auth';
import { startNotificationPurge } from './utils/notificationPurge';
import { warmUpImageCheck } from './services/apartmentImageCheck';

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

// m3 : le callback FedaPay (premium + boost) n'utilise plus l'`Origin` du
// navigateur mais APP_PUBLIC_URL. Sans cette variable, le gérant serait
// redirigé après paiement vers http://localhost:5173 : la page de succès ne
// se charge pas, /confirm ne tourne pas, le paiement reste invisible côté
// gérant. Fail-fast identique à ALLOWED_ORIGINS plutôt qu'un échec muet.
if (isProduction && !process.env.APP_PUBLIC_URL?.trim()) {
  console.error('[FATAL] APP_PUBLIC_URL manquant en production : le callback FedaPay pointerait sur localhost (paiement jamais confirmé côté gérant).');
  process.exit(1);
}

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('write'),
  // Ne compte QUE les vraies écritures : les GET, la connexion
  // (/api/auth/*) et le tracking boost (dont le propre limiteur existe plus
  // bas) en sont exclus — sinon un pic de ces requêtes épuise le quota et
  // bloque, par contagion, des écritures et des connexions légitimes.
  skip: skipWriteQuota,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
});

// Connexion / bootstrap / me : limiteur DÉDIÉ et PAR UTILISATEUR (Clerk), monté
// APRÈS requireClerkAuth pour disposer de req.auth.userId. Volontairement large
// (bootstrap est idempotent et rejoué à chaque montage d'espace) : il borne
// l'abus sans jamais bloquer une connexion légitime dont l'IP est partagée
// (NAT, proxy sans TRUST_PROXY, dev).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('auth'),
  keyGenerator: userOrIpKey,
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

// C1 (REVUE_BOOST.md) : /boosts/impression et /boosts/click sont publics et
// débitent un budget prépayé. Trois ceintures :
//  - émission d'identité : ~10 nouvelles identités / 15 min / IP. C'est LA
//    ceinture qui ferme C1 : sans elle, 2 requêtes (émission + facturation)
//    suffisent pour un événement facturé et 40 req/15 min = 20 clics =
//    un budget d'entrée de 1 000 F vidé par une seule IP. Un visiteur
//    légitime n'émet qu'une identité par an (cookie 365 j) ;
//  - par IP : ~40 événements / 15 min → une rafale native ne facture pas
//    plus de 40 événements ;
//  - par campagne : 150 / 15 min → une campagne ciblée reste protégée même
//    répartie sur plusieurs IP (plafond de fait du débit).
// Chaque clé est un store dédié (express-rate-limit refuse les stores partagés).
const boostIssueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('boost-track-issue'),
  // Ne compte QUE les requêtes sans cookie valide : les événements déjà
  // identifiés ne consomment pas le quota d'émission.
  skip: (req) => readTrackVisitor(req) !== null,
  message: { error: 'Trop de nouvelles sessions de suivi, veuillez réessayer plus tard' },
});

const boostTrackIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('boost-track-ip'),
  message: { error: 'Trop de requêtes de suivi, veuillez réessayer plus tard' },
});

const boostTrackBoostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('boost-track-boost'),
  // Volontairement SANS req.ip : la clé est la campagne ciblée.
  keyGenerator: (req) => `boost:${String((req.body as { boost_id?: unknown } | undefined)?.boost_id ?? 'none')}`,
  message: { error: 'Trop de requêtes pour cette campagne, veuillez réessayer plus tard' },
});

// M4 : un budget clic peut être vidé par une seule IP qui forge de nouvelles
// identités visiteur (10 cookies / 15 min). On borne en plus les clics
// facturables par couple IP + campagne : le minting ne suffit plus à financer
// une rafale. Le plafond reste large pour un NAT légitime.
const boostClickIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('boost-click-ip-campaign'),
  keyGenerator: (req) => {
    const boostId = String(
      (req.body as { boost_id?: unknown } | undefined)?.boost_id ?? 'none',
    );
    return `${ipKeyGenerator(req.ip ?? '')}:${boostId}`;
  },
  message: { error: 'Trop de clics pour cette campagne, veuillez réessayer plus tard' },
});

// M4 (suite) : le limiteur de campagne ci-dessus (150 / 15 min, impressions ET
// clics confondus) laisse une campagne vidée très vite en clics. Le clic est
// l'événement cher (50 F) : on le borne séparément par campagne à 60 / 15 min
// (≤ 3 000 F, soit le budget minimal) — très au-dessus d'un trafic légitime
// (une campagne à budget max 100 000 F = 2 000 clics sur 90 jours ≈ 22/jour).
const boostClickCampaignLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('boost-click-campaign'),
  // Volontairement SANS req.ip : la clé est la campagne ciblée.
  keyGenerator: (req) => `boost:${String((req.body as { boost_id?: unknown } | undefined)?.boost_id ?? 'none')}`,
  message: { error: 'Trop de clics pour cette campagne, veuillez réessayer plus tard' },
});

// F5 : les routes de paiement appellent FedaPay et permettent d'énumérer des
// transactions. Elles étaient absentes de tout limiteur dédié (le quota global
// « write » ne comptait que 200 requêtes / 15 min / IP).
const paymentFlowLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('payment-flow'),
  keyGenerator: userOrIpKey,
  message: { error: 'Trop de tentatives de paiement, veuillez réessayer plus tard' },
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
  '/api/escapades',
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
// F4 : une requête admin authentifiée par cookie doit venir d'une origine
// autorisée. SameSite=Strict bloque déjà le cross-site ; cette garde couvre les
// navigateurs/proxys qui l'assouplissent et le cas « même site, origine non
// autorisée ». Les clients Bearer (API, tests) ne sont pas concernés.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (!usesAdminCookie(req)) return next();
  const origin = req.get('origin');
  if (origin && allowedOrigins.includes(origin)) return next();
  return res.status(403).json({ error: 'Origine non autorisée' });
});
app.use('/api', writeLimiter);
app.use('/api/upload', uploadLimiter);
// Placés APRÈS express.json() (sinon req.body est encore vide) et AVANT le
// routeur boosts : une rafale de tracking est refusée avant toute lecture base.
// L'émission d'identité est aussi bornée sur /featured : c'est là que le
// serveur pose le cookie, donc la porte d'entrée du minting en masse.
app.use(
  ['/api/boosts/impression', '/api/boosts/click'],
  boostIssueLimiter,
  boostTrackIpLimiter,
  boostTrackBoostLimiter,
);
app.use('/api/boosts/click', boostClickIpLimiter, boostClickCampaignLimiter);
app.use(
  ['/api/boosts/initiate', '/api/boosts/confirm', '/api/premium/confirm'],
  paymentFlowLimiter,
);

app.use('/api/rooms', roomsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tourism', tourismRouter);
app.use('/api/escapades', escapadesRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/contact', contactRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/auth', requireClerkAuth, authLimiter, authRouter);
app.use('/api/gerants', requireClerkAuth, gerantsRouter);
app.use('/api/clients', requireClerkAuth, clientsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/premium', premiumRouter);
// /featured pose aussi le cookie de visiteur : même quota d'émission (C1).
app.use('/api/boosts/featured', boostIssueLimiter);
app.use('/api/boosts', boostsRouter);
// Le limiteur ne couvre que la route de connexion ; le routeur admin n'est
// monté qu'une fois (ci-dessous). Un second montage du routeur sous
// `/api/admin/login` exposait inutilement tout le back-office à cette URL.
app.use('/api/admin/login', adminLoginLimiter);
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
  if (process.env.NODE_ENV !== 'test') void warmUpImageCheck();
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
