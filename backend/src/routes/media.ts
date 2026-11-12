import { Router, type Request, type Response, type NextFunction } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { resolveObjectPath, verifyObjectUrl } from '../db/storage';

/**
 * Service des fichiers stockés sur disque.
 *
 *  - `/api/media/images/<chemin>` : photos publiques d'annonces. En production
 *    c'est Nginx qui sert directement `STORAGE_DIR/images` (plus rapide, zéro
 *    passage par Node) ; cette route reste le fallback de développement.
 *  - `/api/media/verification-docs/<chemin>?exp=…&sig=…` : documents privés,
 *    accessibles uniquement par URL signée HMAC avec expiration, l'équivalent
 *    des URLs signées de Supabase Storage.
 */

const router = Router();

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

function contentType(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/** Les images peuvent être chargées depuis une autre origine (dev : 5173). */
function allowCrossOrigin(res: Response): void {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

async function sendFile(
  res: Response,
  absolutePath: string,
  cacheControl: string,
): Promise<void> {
  const info = await stat(absolutePath);
  if (!info.isFile()) {
    res.status(404).json({ error: 'Fichier introuvable' });
    return;
  }
  res.setHeader('Content-Type', contentType(absolutePath));
  res.setHeader('Content-Length', String(info.size));
  res.setHeader('Cache-Control', cacheControl);
  allowCrossOrigin(res);
  createReadStream(absolutePath).pipe(res);
}

router.get('/images/*', async (req: Request, res: Response) => {
  try {
    const objectPath = decodeURIComponent(req.params[0] ?? '');
    const absolutePath = resolveObjectPath('images', objectPath);
    await sendFile(res, absolutePath, 'public, max-age=31536000, immutable');
  } catch {
    res.status(404).json({ error: 'Fichier introuvable' });
  }
});

router.get('/verification-docs/*', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const objectPath = decodeURIComponent(req.params[0] ?? '');
    const expiresAt = Number.parseInt(String(req.query.exp ?? ''), 10);
    const signature = String(req.query.sig ?? '');

    if (!verifyObjectUrl('verification-docs', objectPath, expiresAt, signature)) {
      res.status(403).json({ error: 'Lien expiré ou invalide' });
      return;
    }

    const absolutePath = resolveObjectPath('verification-docs', objectPath);
    await sendFile(res, absolutePath, 'private, no-store');
  } catch (error) {
    next(error);
  }
});

export default router;
