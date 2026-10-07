// Identité visiteur des événements Boost (C1 de REVUE_BOOST.md).
//
// `POST /api/boosts/impression` et `/click` sont publics : sans identité
// infalsifiable, un script qui envoie un `visitor_id` différent à chaque
// appel épuise n'importe quel budget (dédup serveur battue en brèche).
//
// Contre-mesure : l'identité n'est plus lue dans le corps de la requête mais
// dans un cookie `HttpOnly` signé HMAC (secret serveur) posé par le serveur
// — ni lisible ni modifiable depuis le JS de la page. Le champ `visitor_id`
// du corps reste exigé (compatibilité) mais sa valeur est ignorée.
//
// Format du cookie : `<visitorId>.<hmac-sha256-hex>`.
// Émission si absent OU invalide (cookie forgé / expiré) : la route répond
// `visitor_issued: true` et le client relance UNE fois — jamais de boucle.

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

export const TRACK_COOKIE_NAME = 'ilehya_bt';

const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
const MIN_VISITOR_ID = 8;
const MAX_VISITOR_ID = 64;
const SIG_HEX_LENGTH = 64;

function trackSecret(): string {
  return process.env.BOOST_TRACK_SECRET || process.env.ADMIN_JWT_SECRET || 'ilehya-boost-track';
}

function signature(visitorId: string): string {
  return createHmac('sha256', trackSecret()).update(visitorId).digest('hex');
}

function isVisitorId(value: string): boolean {
  return value.length >= MIN_VISITOR_ID && value.length <= MAX_VISITOR_ID;
}

/** Lit et VÉRIFIE le cookie : compare les MAC en temps constant. */
export function readTrackVisitor(req: Request): string | null {
  const raw = req.headers.cookie;
  if (typeof raw !== 'string' || !raw) return null;

  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== TRACK_COOKIE_NAME) continue;

    let value = part.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    const sep = value.lastIndexOf('.');
    if (sep <= 0) return null;
    const visitorId = value.slice(0, sep);
    const mac = value.slice(sep + 1);
    if (!isVisitorId(visitorId) || mac.length !== SIG_HEX_LENGTH) return null;

    const expected = Buffer.from(signature(visitorId), 'hex');
    const provided = Buffer.from(mac, 'hex');
    if (provided.length !== expected.length) return null;
    return timingSafeEqual(provided, expected) ? visitorId : null;
  }
  return null;
}

/** Valeur Set-Cookie complète (exportée pour les tests). */
export function buildTrackCookie(visitorId: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const value = encodeURIComponent(`${visitorId}.${signature(visitorId)}`);
  return `${TRACK_COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE_S}${secure}`;
}

/**
 * Identité de ce visiteur : posée (et retournée) si le cookie est absent ou
 * invalide — `issued: true` dit à la route de répondre sans facturer et de
 * laisser le client relancer une fois.
 */
export function ensureTrackVisitor(
  req: Request,
  res: Response,
): { visitorId: string; issued: boolean } {
  const existing = readTrackVisitor(req);
  if (existing) return { visitorId: existing, issued: false };
  const visitorId = randomUUID();
  res.setHeader('Set-Cookie', buildTrackCookie(visitorId));
  return { visitorId, issued: true };
}

/** Pose le cookie s'il est absent ; ne réécrit jamais un cookie valide (cache). */
export function issueTrackCookieIfMissing(req: Request, res: Response): void {
  if (readTrackVisitor(req) !== null) return;
  res.setHeader('Set-Cookie', buildTrackCookie(randomUUID()));
}
