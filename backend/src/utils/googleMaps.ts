interface ParsedCoords {
  lat: number;
  lng: number;
}

const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);
const SHORT_LINK_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;

function isValidCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function extractFromPattern(text: string): ParsedCoords | null {
  // /@lat,lng (ex: /maps/@48.8584,2.2945,17z ou /maps/place/.../@lat,lng)
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  // data=!3dLAT!4dLNG
  const dataMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataMatch) {
    const lat = Number(dataMatch[1]);
    const lng = Number(dataMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  // query params : q=, ll=, viewpoint=, center= sous forme "lat,lng"
  const paramMatch = text.match(/[?&](?:q|ll|viewpoint|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (paramMatch) {
    const lat = Number(paramMatch[1]);
    const lng = Number(paramMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  // query param q URL-encodé : q=48.85%2C2.29
  const encodedMatch = text.match(/[?&](?:q|ll|viewpoint|center)=(-?\d+(?:\.\d+)?)%2C(-?\d+(?:\.\d+)?)/i);
  if (encodedMatch) {
    const lat = Number(encodedMatch[1]);
    const lng = Number(encodedMatch[2]);
    if (isValidCoords(lat, lng)) return { lat, lng };
  }

  return null;
}

function isGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (SHORT_HOSTS.has(host)) return true;
  // google.com, www.google.com, maps.google.com, google.co.ci, www.google.co.bj,
  // maps.google.fr, google.com.ma, etc.
  if (host === 'google.com' || host.endsWith('.google.com')) return true;
  return /^([a-z0-9-]+\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host);
}

function isGoogleMapsLikeUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (SHORT_HOSTS.has(host)) return true;
  if (!isGoogleHost(host)) return false;
  // maps.google.* ou path contenant /maps (google.com/maps/...)
  if (host.startsWith('maps.')) return true;
  return /\/maps\b/i.test(url.pathname) || url.pathname === '/maps' || Boolean(url.searchParams.get('q') || url.searchParams.get('query'));
}

async function fetchWithManualRedirects(startUrl: string): Promise<URL | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SHORT_LINK_TIMEOUT_MS);
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'ilehya-verification/1.0' },
      });
      clearTimeout(timer);
    } catch {
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return null;
      }
      // Anti-SSRF : chaque hop doit rester sur un hébergement Google
      if (!isGoogleHost(next.hostname.toLowerCase())) return null;
      current = next.toString();
      continue;
    }

    // Dernier redirect ou page finale
    try {
      return new URL(res.url || current);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extrait latitude/longitude d'un lien Google Maps.
 * Formats supportés : @lat,lng · q=/ll=/viewpoint=/center= · !3d!4d · short links.
 * Retourne null si le lien n'est pas un lien Google Maps ou si aucune coordonnée n'est trouvée.
 */
export async function parseGoogleMapsUrl(input: string): Promise<ParsedCoords | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }

  const host = url.hostname.toLowerCase();
  const isMaps = isGoogleHost(host);
  if (!isMaps) return null;

  // Short link : résolution manuelle des redirections (validation hôte à chaque hop)
  if (SHORT_HOSTS.has(host)) {
    const resolved = await fetchWithManualRedirects(url.toString());
    if (!resolved) return null;
    if (!isGoogleHost(resolved.hostname.toLowerCase())) return null;
    return extractFromPattern(resolved.toString());
  }

  if (!isGoogleMapsLikeUrl(url)) return null;

  return extractFromPattern(url.toString());
}
