import { z } from 'zod';
import { getPublicBaseUrl } from '../db/storage';

/**
 * Validation des URLs d'images de la plateforme.
 *
 * Deux niveaux, volontairement distincts :
 *
 *  - `platformImageUrlSchema` (strict) : n'accepte que des photos réellement
 *    téléversées dans **notre** stockage, c'est-à-dire servies sous
 *    `STORAGE_PUBLIC_BASE_URL/images/…`. C'est le seul schéma autorisé à la
 *    création d'une annonce : impossible de référencer une photo stock du
 *    site, une image hébergée ailleurs (même déguisée en `/media/images/…`),
 *    un autre projet Supabase ou un document PDF.
 *
 *  - `legacyImageUrlSchema` (compatibilité) : accepte en plus les formes
 *    historiques déjà présentes en base — `/images/…` (visuels embarqués dans
 *    le frontend) et `https://<projet>.supabase.co/storage/v1/object/public/
 *    images/…` (anciens téléversements). Il ne sert qu'à la **modification**
 *    d'une annonce existante (pour ne pas casser les annonces déjà en ligne)
 *    et aux contenus éditoriaux (escapades). Les hôtes arbitraires et les
 *    fichiers non-image y sont refusés.
 *
 * Une URL `https://n-importe-quel-domaine/media/images/x.jpg` était auparavant
 * acceptée : ce n'est plus le cas.
 */

const IMAGE_EXTENSION_RE = /\.(?:jpe?g|png|webp|gif|avif)$/i;
const SAFE_SEGMENTS_RE = /^[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;

// Formes historiques uniquement (aucun nouvel hôte arbitraire).
const SUPABASE_LEGACY_RE =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/images\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;
const LOCAL_LEGACY_RE = /^\/images\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;

function hasImageExtension(pathname: string): boolean {
  return IMAGE_EXTENSION_RE.test(pathname);
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // Les URLs signées/paramétrées n'ont pas leur place dans une annonce :
    // on refuse query string et fragment (évite les contournements par
    // `?ext=.jpg` ou `#…`).
    if (url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

/** Vrai si l'URL pointe vers une photo téléversée dans notre stockage. */
export function isPlatformImageUrl(value: string): boolean {
  const url = parseHttpUrl(value);
  if (!url) return false;

  let base: URL;
  try {
    base = new URL(getPublicBaseUrl());
  } catch {
    return false;
  }

  if (url.origin !== base.origin) return false;

  const basePath = base.pathname.replace(/\/+$/, '');
  const prefix = `${basePath}/images/`;
  if (!url.pathname.startsWith(prefix)) return false;
  if (!hasImageExtension(url.pathname)) return false;

  return SAFE_SEGMENTS_RE.test(url.pathname.slice(prefix.length));
}

/** Vrai si l'URL appartient à une forme historique déjà présente en base. */
export function isLegacyStaticImageUrl(value: string): boolean {
  if (LOCAL_LEGACY_RE.test(value) || SUPABASE_LEGACY_RE.test(value)) {
    return hasImageExtension(value);
  }
  return false;
}

/**
 * Compatibilité : stockage plateforme **ou** forme historique connue.
 * À réserver aux mises à jour d'annonces existantes et aux contenus
 * éditoriaux ; jamais pour la création d'une annonce.
 */
export function isAllowedImageUrl(value: string): boolean {
  return isPlatformImageUrl(value) || isLegacyStaticImageUrl(value);
}

export const platformImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(isPlatformImageUrl, {
    message:
      "URL d'image invalide : seules les photos téléversées dans le stockage de la plateforme sont acceptées",
  });

export const legacyImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(isAllowedImageUrl, {
    message: "URL d'image invalide : seules les images de la plateforme sont acceptées",
  });

/** Alias historique conservé pour les contenus éditoriaux (escapades). */
export const imageUrlSchema = legacyImageUrlSchema;
