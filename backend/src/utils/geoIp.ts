/**
 * Résolution IP → pays (gratuit, sans clé, sans dépendance).
 *
 * Utilise ip-api.com (45 req/min, aucun compte requis) avec un cache en
 * mémoire pour ne jamais dépasser le quota. En cas d'indisponibilité ou
 * d'IP invalide, retourne null silencieusement.
 *
 * Deux usages :
 *  - indicateur pays dans le back-office (admin) ;
 *  - contrôle au bootstrap gérant : un pays connu et incohérent avec le
 *    marché bloque l'accès, un null est traité en fail-open et journalisé.
 */

interface GeoResult {
  countryCode: string;
  country: string;
}

const cache = new Map<string, GeoResult | null>();
const CACHE_MAX = 500;
const TIMEOUT_MS = 2500;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

function isPublicIp(ip: string): boolean {
  if (!IPV4.test(ip) && !IPV6.test(ip)) return false;
  if (ip.startsWith('127.') || ip === '::1' || ip.startsWith('10.')) return false;
  if (ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  return true;
}

/** Résout le pays d'une IP. Retourne null si indisponible/privée. */
export async function countryOfIp(ip: string | null | undefined): Promise<GeoResult | null> {
  if (!ip || !isPublicIp(ip)) return null;
  if (cache.has(ip)) return cache.get(ip) ?? null;

  let result: GeoResult | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,country`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        countryCode?: string;
        country?: string;
      };
      if (data.status === 'success' && data.countryCode) {
        result = { countryCode: data.countryCode, country: data.country ?? data.countryCode };
      }
    }
  } catch {
    // Indisponible : on garde null, sans jamais faire échouer la requête.
  }

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(ip, result);
  return result;
}
