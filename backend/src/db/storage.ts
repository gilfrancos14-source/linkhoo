import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Stockage de fichiers local (remplace Supabase Storage).
 *
 * MinIO n'est plus distribuable (images Docker Hub retirées, binaires
 * officiels en 410 Gone), et un service S3 de plus sur un VPS 4 vCPU / 8 Go
 * n'apporte rien pour deux buckets. Le disque + Nginx est plus simple, plus
 * rapide et sauvegardable par une simple copie de dossier.
 *
 * Deux buckets :
 *  - `images` : photos d'annonces, publiques, servies par Nginx (ou par
 *    `routes/media.ts` en développement) ;
 *  - `verification-docs` : pièces justificatives, privées, servies par une URL
 *    signée HMAC avec expiration (même contrat que `createSignedUrl`).
 *
 * L'API exposée est volontairement identique à celle de `storage-js` : le code
 * des routes ne change pas.
 */

const BUCKETS = new Set(['images', 'verification-docs']);

export interface StorageError {
  message: string;
}

export type StorageResponse<T> =
  | { data: T; error: null }
  | { data: null; error: StorageError };

function storageRoot(): string {
  return path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), 'storage'));
}

function publicBaseUrl(): string {
  const configured = process.env.STORAGE_PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const port = process.env.PORT ?? '3001';
  return `http://localhost:${port}/api/media`;
}

/**
 * URL de base des documents privés : elle passe TOUJOURS par l'API, qui
 * vérifie la signature HMAC. Les photos publiques peuvent, elles, être
 * servies directement par Nginx (`STORAGE_PUBLIC_BASE_URL`).
 */
function signedBaseUrl(): string {
  const configured = process.env.STORAGE_SIGNED_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const appUrl = process.env.APP_PUBLIC_URL;
  if (appUrl) return `${appUrl.replace(/\/+$/, '')}/api/media`;
  const port = process.env.PORT ?? '3001';
  return `http://localhost:${port}/api/media`;
}

function signingSecret(): string {
  const secret = process.env.STORAGE_SIGNING_SECRET ?? process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error(
      'STORAGE_SIGNING_SECRET (ou ADMIN_JWT_SECRET) requis pour signer les URLs de documents',
    );
  }
  return secret;
}

/** Empêche toute sortie du dossier de stockage (`../`, chemin absolu, `\`). */
export function resolveObjectPath(bucket: string, objectPath: string): string {
  if (!BUCKETS.has(bucket)) throw new Error(`Bucket inconnu : « ${bucket} »`);

  const raw = objectPath.replace(/\\/g, '/');
  if (raw.includes('\0')) throw new Error(`Chemin d'objet invalide : « ${objectPath} »`);
  // Un segment `..` est refusé (et non normalisé) : on préfère une erreur
  // explicite à une réécriture silencieuse du chemin.
  if (raw.split('/').some((segment) => segment === '..')) {
    throw new Error(`Chemin d'objet invalide : « ${objectPath} »`);
  }
  if (raw.startsWith('/') || path.isAbsolute(objectPath)) {
    throw new Error(`Chemin d'objet invalide : « ${objectPath} »`);
  }

  const normalized = path.posix.normalize(raw).replace(/^\/+/, '');
  if (normalized.length === 0) {
    throw new Error(`Chemin d'objet invalide : « ${objectPath} »`);
  }

  const root = storageRoot();
  const resolved = path.resolve(root, bucket, normalized);
  const bucketRoot = path.resolve(root, bucket);
  if (!resolved.startsWith(bucketRoot + path.sep)) {
    throw new Error(`Chemin d'objet hors du stockage : « ${objectPath} »`);
  }
  return resolved;
}

export function signObjectUrl(bucket: string, objectPath: string, expiresAt: number): string {
  const payload = `${bucket}/${objectPath.replace(/\\/g, '/')}:${expiresAt}`;
  return createHmac('sha256', signingSecret()).update(payload).digest('hex');
}

export function verifyObjectUrl(
  bucket: string,
  objectPath: string,
  expiresAt: number,
  signature: string,
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) return false;
  const expected = signObjectUrl(bucket, objectPath, expiresAt);
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(signature, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

class LocalBucket {
  constructor(private readonly bucket: string) {
    if (!BUCKETS.has(bucket)) throw new Error(`Bucket inconnu : « ${bucket} »`);
  }

  async upload(
    objectPath: string,
    file: Buffer,
    options: { contentType?: string; upsert?: boolean } = {},
  ): Promise<StorageResponse<{ path: string; fullPath: string }>> {
    try {
      const target = resolveObjectPath(this.bucket, objectPath);
      if (!options.upsert) {
        const exists = await stat(target).then(() => true).catch(() => false);
        if (exists) {
          return { data: null, error: { message: 'The resource already exists' } };
        }
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file);
      return {
        data: { path: objectPath, fullPath: `${this.bucket}/${objectPath}` },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  getPublicUrl(objectPath: string): { data: { publicUrl: string } } {
    const cleaned = objectPath.replace(/\\/g, '/').replace(/^\/+/, '');
    return { data: { publicUrl: `${publicBaseUrl()}/${this.bucket}/${cleaned}` } };
  }

  async createSignedUrl(
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<StorageResponse<{ signedUrl: string; path: string }>> {
    try {
      const target = resolveObjectPath(this.bucket, objectPath);
      const exists = await stat(target).then(() => true).catch(() => false);
      if (!exists) return { data: null, error: { message: 'Object not found' } };

      const expiresAt = Math.floor(Date.now() / 1000) + Math.max(1, expiresInSeconds);
      const cleaned = objectPath.replace(/\\/g, '/').replace(/^\/+/, '');
      const signature = signObjectUrl(this.bucket, cleaned, expiresAt);
      return {
        data: {
          signedUrl:
            `${signedBaseUrl()}/${this.bucket}/${cleaned}` +
            `?exp=${expiresAt}&sig=${signature}`,
          path: objectPath,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  async remove(objectPaths: string[]): Promise<StorageResponse<{ name: string }[]>> {
    try {
      const deleted: { name: string }[] = [];
      for (const objectPath of objectPaths) {
        const target = resolveObjectPath(this.bucket, objectPath);
        await rm(target, { force: true });
        deleted.push({ name: objectPath });
      }
      return { data: deleted, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  }
}

export const localStorage = {
  from(bucket: string): LocalBucket {
    return new LocalBucket(bucket);
  },
};
