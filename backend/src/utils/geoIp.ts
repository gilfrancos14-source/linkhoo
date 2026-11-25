/**
 * Résolution IP → pays (gratuit, sans clé, sans dépendance).
 *
 * Utilise ipwho.is en HTTPS (gratuit, sans clé, sans compte), le même
 * fournisseur que `services/geoIp.ts` pour le landing. Le gratuit d'
 * ip-api.com est HTTP-only (HTTPS => 403) : incompatible avec un VPS qui
 * n'autorise que l'egress HTTPS. Un cache en mémoire limite les appels.
 * En cas d'indisponibilité ou d'IP invalide, retourne null silencieusement.
 *
 * Deux usages :
 *  - indicateur pays dans le back-office (admin) ;
 *  - contrôle au bootstrap gérant : un pays connu et incohérent avec le
 *    marché bloque l'accès, un null est traité en fail-open et journalisé.
 */

export interface GeoResult {
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
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as {
        success?: boolean;
        country_code?: string;
        country?: string;
      };
      if (data.success && data.country_code) {
        result = {
          countryCode: data.country_code.trim().toUpperCase(),
          country: data.country ?? data.country_code,
        };
      }
    }
  } catch {
    // Indisponible : on garde null, sans jamais faire échouer la requête.
  }

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(ip, result);
  return result;
}
