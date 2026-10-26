import type { CookieOptions, Request } from 'express';

/**
 * F4 : le jeton admin est transporté dans un cookie `HttpOnly` (jamais lisible
 * par le JavaScript de la page, donc hors de portée d'une XSS). Le cookie est
 * restreint au préfixe `/api/admin` (aucun autre endpoint ne le reçoit) et en
 * `SameSite=Strict` (aucun envoi depuis un site tiers → CSRF bloqué au niveau
 * navigateur, en plus de la garde d'origine côté serveur).
 */
export const ADMIN_COOKIE_NAME = 'admin_token';
// Chemin racine : le back-office appelle aussi des routes montées hors
// /api/admin (uploads, bannières, événements…). Le cookie n'est pas accessible
// au JS (HttpOnly) et SameSite=Strict empêche tout envoi cross-site.
export const ADMIN_COOKIE_PATH = '/';
export const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function adminCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    path: ADMIN_COOKIE_PATH,
    maxAge: ADMIN_SESSION_MAX_AGE_MS,
  };
}

export function adminCookieClearOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    path: ADMIN_COOKIE_PATH,
  };
}

/** Lecture d'un cookie sans dépendance supplémentaire (cookie-parser absent). */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** Vrai si la requête s'authentifie via le cookie (et non un Bearer explicite). */
export function usesAdminCookie(req: Request): boolean {
  return readCookie(req, ADMIN_COOKIE_NAME) !== null;
}
