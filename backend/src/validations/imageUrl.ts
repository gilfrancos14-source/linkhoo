import { z } from 'zod';

/**
 * Validation des URLs d'images de la plateforme.
 *
 * Trois formes acceptées :
 *  - `/images/…` : fichiers statiques servis par le frontend (seed, visuels) ;
 *  - `https://<domaine>/api/media/images/…` : photos téléversées, servies par
 *    le stockage disque (ex- Supabase Storage) ;
 *  - `https://<projet>.supabase.co/storage/v1/object/public/images/…` : URLs
 *    historiques, conservées le temps de la bascule.
 *
 * Le but de la validation est d'empêcher qu'une annonce référence une
 * adresse arbitraire (pistage, javascript:, iframe) : on n'accepte donc que
 * `http(s)` et un chemin qui appartient à notre stockage.
 */

const SUPABASE_PUBLIC_IMAGE_RE =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/images\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;
const LOCAL_IMAGE_RE = /^\/images\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;
const STORAGE_IMAGE_PATH_RE = /^\/api\/media\/images\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/;

export function isAllowedImageUrl(value: string): boolean {
  if (LOCAL_IMAGE_RE.test(value)) return true;
  if (SUPABASE_PUBLIC_IMAGE_RE.test(value)) return true;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return STORAGE_IMAGE_PATH_RE.test(url.pathname);
  } catch {
    return false;
  }
}

export const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(isAllowedImageUrl, {
    message: "URL d'image invalide : seules les images du stockage de la plateforme sont acceptées",
  });
