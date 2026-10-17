import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { createRateLimitStore } from './rateLimitStore';

/**
 * Clé de comptage : l'utilisateur Clerk authentifié quand il est connu, sinon
 * l'IP (normalisée IPv6 via `ipKeyGenerator`, requise par express-rate-limit).
 *
 * Compter par utilisateur plutôt que par IP est essentiel derrière un NAT, un
 * reverse proxy ou en dev : plusieurs personnes partagent alors la même IP et
 * un seul utilisateur actif suffisait à faire bloquer « Trop de requêtes » pour
 * tout le monde — y compris pour se connecter.
 */
export function userOrIpKey(req: Request): string {
  return req.auth?.userId ?? ipKeyGenerator(req.ip ?? '');
}

/** Chemin de requête débarrassé de sa query string. */
function fullPath(req: Request): string {
  return (req.originalUrl || req.url || '').split('?')[0];
}

/**
 * Vrai pour les routes d'authentification (`/api/auth/*`). Elles ne doivent
 * JAMAIS consommer le quota global d'écritures : se connecter ne peut pas être
 * refusé (429) parce qu'un autre gérant a enchaîné des écritures ou des
 * événements de suivi dans la même fenêtre (voir `skipWriteQuota`).
 */
export function isAuthRequest(req: Request): boolean {
  const path = fullPath(req);
  return path === '/api/auth' || path.startsWith('/api/auth/');
}

/**
 * Chemins à fort volume qui disposent déjà de leur PROPRE limiteur dédié
 * (voir index.ts : boostIssue/boostTrackIp/boostTrackBoost). Les recompter dans
 * le quota global « write » le vide inutilement : quelques cartes boostées sur
 * la home génèrent assez d'impressions/clics pour épuiser les 200 écritures et
 * bloquer, par ricochet, des connexions ou des écritures sans rapport.
 */
const SELF_LIMITED_PATHS = new Set(['/api/boosts/impression', '/api/boosts/click']);

/**
 * Prédicat `skip` du limiteur global d'écritures (index.ts) : ne compte que les
 * vraies écritures. Les GET, la connexion et le tracking boost en sont exclus.
 */
export function skipWriteQuota(req: Request): boolean {
  if (req.method === 'GET') return true;
  if (isAuthRequest(req)) return true;
  return SELF_LIMITED_PATHS.has(fullPath(req));
}

export const createClientLimiter = (options: { limit?: number; prefix: string }) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.limit ?? 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Préfixe DISTINCT par limiteur : un store dédié (MemoryStore) ou un
    // namespace Redis propre (« ilehya:ratelimit:<prefix>: »). Sans ça, tous
    // les limiteurs partageraient le même compteur sous REDIS_URL : lire ses
    // messages consommerait le quota d'envoi, etc. (voir rateLimitStore.ts).
    store: createRateLimitStore(options.prefix),
    // Clé par utilisateur connecté : une IP partagée ne fait plus se bloquer
    // des utilisateurs distincts entre eux.
    keyGenerator: userOrIpKey,
    message: { error: 'Trop de requêtes, veuillez réessayer plus tard' },
    // Les limites ne visent que les écritures : un GET (section avis de la
    // home, liste de notifications pollée toutes les 30 s…) ne doit jamais
    // renvoyer de 429 à un utilisateur qui navigue normalement.
    skip: (req) => req.method === 'GET',
  });
