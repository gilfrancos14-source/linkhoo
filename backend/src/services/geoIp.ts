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
import { MARKETS, type MarketCode } from '../config/markets';
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
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface GeoInfo {
  readonly countryCode: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

const EMPTY_GEO: GeoInfo = { countryCode: null, latitude: null, longitude: null };

/** Pays + coordonnées de l'IP, mis en cache sous l'IP hachée. */
export async function lookupGeo(ip: string): Promise<GeoInfo> {
  const key = cacheKey(ip);
  const cached = geoCache.get<GeoInfo>(key);
  if (cached !== undefined) return cached;

  let info: GeoInfo = EMPTY_GEO;
  try {
    const res = await fetch(`${GEO_URL}/${encodeURIComponent(ip)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
    });
    if (res.ok) {
      const body = (await res.json()) as GeoResponse;
      if (body.success) {
        const lat = Number(body.latitude);
        const lng = Number(body.longitude);
        info = {
          countryCode:
            typeof body.country_code === 'string'
              ? body.country_code.trim().toUpperCase()
              : null,
          latitude: body.latitude !== undefined && Number.isFinite(lat) ? lat : null,
          longitude: body.longitude !== undefined && Number.isFinite(lng) ? lng : null,
        };
      }
    }
  } catch (error) {
    logger.warn('[geoip] lookup indisponible (non bloquant)', {
      error: error instanceof Error ? error.message : error,
    });
  }

  geoCache.set(key, info, CACHE_TTL_SECONDS);
  return info;
}

/** Retourne le code ISO du pays, ou null si introuvable/indisponible. */
export async function lookupCountry(ip: string): Promise<string | null> {
  return (await lookupGeo(ip)).countryCode;
}

/** Distance grande cercle (haversine) en km. */
function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Marché voisin du visiteur : le plus proche géographiquement, en excluant le
 * sien (déjà présenté dans la section au-dessus). En développement, l'IP est
 * locale : on part d'Abidjan et on exclut la Côte d'Ivoire.
 */
export async function nearestMarketFromRequest(req: Request): Promise<{
  market: MarketCode | null;
  ownMarket: MarketCode | null;
}> {
  const ip = clientIp(req);
  const geo = ip ? await lookupGeo(ip) : EMPTY_GEO;
  const ownMarket = geo.countryCode
    ? COUNTRY_TO_MARKET[geo.countryCode] ?? null
    : null;
  const env = process.env.NODE_ENV;
  const dev = !env || env === 'development';
  const devMarket: MarketCode | null = dev ? 'CI' : null;
  const origin = ownMarket ?? devMarket;
  if (!origin) return { market: null, ownMarket };

  const center = MARKETS.find((item) => item.code === origin)?.center;
  const lat = geo.latitude ?? center?.lat;
  const lng = geo.longitude ?? center?.lng;
  if (lat === undefined || lng === undefined) return { market: null, ownMarket };

  let best: MarketCode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const item of MARKETS) {
    if (item.code === (ownMarket ?? devMarket)) continue;
    const distance = distanceKm(lat, lng, item.center.lat, item.center.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = item.code;
    }
  }
  return { market: best, ownMarket };
}

/**
 * Repli développement : une IP locale (127.0.0.1) ne donne aucun pays. Pour
 * que la section landing soit visible immédiatement sur localhost, on prend
 * le marché CI. Jamais en production, ni dans les tests (NODE_ENV=test).
 */
function devFallback(): { market: MarketCode | null; countryCode: string | null } {
  const env = process.env.NODE_ENV;
  if (!env || env === 'development') return { market: 'CI', countryCode: 'CI' };
  return { market: null, countryCode: null };
}

/** Résout le marché Linkhoo correspondant au pays du visiteur. */
export async function marketFromRequest(req: Request): Promise<{
  market: MarketCode | null;
  countryCode: string | null;
}> {
  const ip = clientIp(req);
  if (!ip) return devFallback();

  const countryCode = await lookupCountry(ip);
  const market = countryCode ? COUNTRY_TO_MARKET[countryCode] ?? null : null;
  if (market) return { countryCode, market };
  // Pays connu mais hors marché : on garde le code pays (utile au debug), le
  // marché reste nul sauf en développement où l'on force l'aperçu CI.
  return { countryCode, market: devFallback().market };
}
