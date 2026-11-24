/**
 * Géolocalisation « pays » à partir de l'IP du visiteur.
 *
 * - aucune clé API, aucun service payant : `ipwho.is` (HTTPS, réponse JSON) ;
 * - l'IP n'est jamais stockée en clair : seule son empreinte SHA-256 sert de
 *   clé de cache (24 h), conformément à la règle « pas de PII dans le cache » ;
 * - les IP privées/loopback (développement, tests, proxys internes) sont
 *   ignorées : on ne peut pas en déduire un pays ;
 * - toute panne du service est silencieuse : la section landing concernée
 *   disparaît simplement, le reste du site continue normalement.
 */

import { createHash } from 'crypto';
import { isIP } from 'net';
import type { Request } from 'express';
import { SecureCache } from '../utils/SecureCache';
import type { MarketCode } from '../config/markets';
import { logger } from '../lib/logger';

const GEO_URL = 'https://ipwho.is';
const GEO_TIMEOUT_MS = 4_000;
const CACHE_TTL_SECONDS = 24 * 60 * 60;

const geoCache = new SecureCache();

/** Correspondance ISO 3166-1 alpha-2 → marché Linkhoo. */
const COUNTRY_TO_MARKET: Readonly<Record<string, MarketCode>> = {
  CI: 'CI', BJ: 'BJ', SN: 'SN', TG: 'TG', CM: 'CM', BF: 'BF',
  CG: 'CG', GA: 'GA', GN: 'GN', ML: 'ML', NE: 'NE', CD: 'CD',
};

function isPrivate(ip: string): boolean {
  if (ip.startsWith('127.') || ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith('169.254.') || ip.toLowerCase().startsWith('fe80:')) return true;
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true;
  return false;
}

/** IP du visiteur, telle que résolue par Express (TRUST_PROXY=1 en prod). */
export function clientIp(req: Request): string | null {
  const raw = req.ip || req.socket.remoteAddress || '';
  // Express peut renvoyer une adresse IPv4 mappée IPv6 : ::ffff:1.2.3.4.
  const ip = raw.replace(/^::ffff:/i, '').trim();
  if (!ip || isIP(ip) === 0 || isPrivate(ip)) return null;
  return ip;
}

function cacheKey(ip: string): string {
  return `geo:${createHash('sha256').update(ip).digest('hex')}`;
}

interface GeoResponse {
  readonly success?: boolean;
  readonly country_code?: string;
}

/** Retourne le code ISO du pays, ou null si introuvable/indisponible. */
export async function lookupCountry(ip: string): Promise<string | null> {
  const key = cacheKey(ip);
  const cached = geoCache.get<string | null>(key);
  if (cached !== undefined) return cached;

  let code: string | null = null;
  try {
    const res = await fetch(`${GEO_URL}/${encodeURIComponent(ip)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
    });
    if (res.ok) {
      const body = (await res.json()) as GeoResponse;
      if (body.success && typeof body.country_code === 'string') {
        code = body.country_code.trim().toUpperCase();
      }
    }
  } catch (error) {
    logger.warn('[geoip] lookup indisponible (non bloquant)', {
      error: error instanceof Error ? error.message : error,
    });
  }

  geoCache.set(key, code, CACHE_TTL_SECONDS);
  return code;
}

/** Résout le marché Linkhoo correspondant au pays du visiteur. */
export async function marketFromRequest(req: Request): Promise<{
  market: MarketCode | null;
  countryCode: string | null;
}> {
  const ip = clientIp(req);
  if (!ip) return { market: null, countryCode: null };

  const countryCode = await lookupCountry(ip);
  return {
    countryCode,
    market: countryCode ? COUNTRY_TO_MARKET[countryCode] ?? null : null,
  };
}
