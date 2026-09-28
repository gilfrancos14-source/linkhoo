import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { supabaseAdmin } from '../config/supabase';
import { requireClerkOrAdminAuth, requireAdminOrGerant } from '../middleware/clerkAuth';

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const;
const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'] as const;
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 900;
const WEBP_QUALITY = 85;

function hasValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'application/pdf') return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/gif') return buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a';
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

async function compressToWebP(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).slice(1).toLowerCase();
    if (!allowedMimeTypes.includes(file.mimetype as typeof allowedMimeTypes[number]) || !allowedExtensions.includes(extension as typeof allowedExtensions[number])) {
      return callback(new Error('Seuls les fichiers JPEG, PNG, WebP, GIF et PDF sont autorisés'));
    }
    callback(null, true);
  },
});

function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Fichier trop volumineux (10 Mo maximum)' });
      }
      return res.status(400).json({ error: 'Fichier invalide' });
    }
    if (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Fichier invalide' });
    }
    next();
  });
}

const router = Router();

// Le rôle est vérifié AVANT multer : on refuse le fichier avant de le lire.
router.post('/', requireClerkOrAdminAuth, requireAdminOrGerant, handleUpload, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });

    const file = req.file;
    if (!hasValidImageSignature(file.buffer, file.mimetype)) {
      return res.status(400).json({ error: 'Le fichier envoyé n\'est pas un fichier valide' });
    }

    const bucket = (req.body.bucket as string) || 'images';
    const validBuckets = ['images', 'verification-docs'];
    if (!validBuckets.includes(bucket)) {
      return res.status(400).json({ error: 'Bucket invalide' });
    }

    let uploadBuffer: Buffer;
    let uploadContentType: string;
    let uploadExtension: string;

    if (imageMimeTypes.includes(file.mimetype as typeof imageMimeTypes[number])) {
      uploadBuffer = await compressToWebP(file.buffer);
      uploadContentType = 'image/webp';
      uploadExtension = 'webp';
    } else {
      uploadBuffer = file.buffer;
      uploadContentType = file.mimetype;
      uploadExtension = extname(file.originalname).slice(1).toLowerCase();
    }

    const fileName = `${randomUUID()}.${uploadExtension}`;
    const { error } = await supabaseAdmin.storage.from(bucket).upload(fileName, uploadBuffer, {
      contentType: uploadContentType,
      upsert: false,
    });
    if (error) throw error;

    if (bucket === 'verification-docs') {
      const { data: signData, error: signError } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(fileName, 3600);
      if (signError) throw signError;
      res.json({ url: signData.signedUrl, path: fileName });
    } else {
      const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
      res.json({ url: urlData.publicUrl, path: fileName });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
