import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mediaRouter from '../routes/media';
import { localStorage, resolveObjectPath, verifyObjectUrl } from './storage';

/**
 * Tests du stockage disque : dÃ©pÃ´t de fichier, URL publique, URL signÃ©e
 * (signature et expiration), suppression, et protection contre la traversÃ©e
 * de chemin.
 */

let root: string;

describe('stockage disque', () => {
  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'ilehya-storage-'));
    process.env.STORAGE_DIR = root;
    process.env.STORAGE_PUBLIC_BASE_URL = 'http://localhost:3001/api/media';
    process.env.STORAGE_SIGNING_SECRET = 'secret-de-test';
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
    delete process.env.STORAGE_DIR;
    delete process.env.STORAGE_PUBLIC_BASE_URL;
    delete process.env.STORAGE_SIGNING_SECRET;
  });

  it('dÃ©pose un fichier et renvoie son URL publique', async () => {
    const bucket = localStorage.from('images');
    const content = Buffer.from('contenu-image');

    const uploaded = await bucket.upload('photo-test.webp', content, {
      contentType: 'image/webp',
      upsert: false,
    });
    expect(uploaded.error).toBeNull();
    expect(uploaded.data?.path).toBe('photo-test.webp');

    const onDisk = await readFile(path.join(root, 'images', 'photo-test.webp'));
    expect(onDisk.toString()).toBe('contenu-image');

    const { data } = bucket.getPublicUrl('photo-test.webp');
    expect(data.publicUrl).toBe('http://localhost:3001/api/media/images/photo-test.webp');
  });

  it('refuse dâ€™Ã©craser un fichier existant sans upsert', async () => {
    const bucket = localStorage.from('images');
    const again = await bucket.upload('photo-test.webp', Buffer.from('autre'), { upsert: false });
    expect(again.error).not.toBeNull();

    const forced = await bucket.upload('photo-test.webp', Buffer.from('autre'), { upsert: true });
    expect(forced.error).toBeNull();
  });

  it('produit une URL signÃ©e valide, puis rejette une signature falsifiÃ©e', async () => {
    const bucket = localStorage.from('verification-docs');
    await bucket.upload('gerant-1/piece.pdf', Buffer.from('pdf'), { upsert: true });

    const signed = await bucket.createSignedUrl('gerant-1/piece.pdf', 3600);
    expect(signed.error).toBeNull();
    const url = new URL(signed.data!.signedUrl);
    const expiresAt = Number(url.searchParams.get('exp'));
    const signature = url.searchParams.get('sig') ?? '';

    expect(verifyObjectUrl('verification-docs', 'gerant-1/piece.pdf', expiresAt, signature)).toBe(true);
    expect(verifyObjectUrl('verification-docs', 'gerant-1/piece.pdf', expiresAt, 'faux')).toBe(false);
    // Un document ne doit pas pouvoir Ãªtre Ã©changÃ© contre un autre.
    expect(verifyObjectUrl('verification-docs', 'gerant-2/piece.pdf', expiresAt, signature)).toBe(false);
    // Une URL expirÃ©e est refusÃ©e.
    expect(verifyObjectUrl('verification-docs', 'gerant-1/piece.pdf', 1, signature)).toBe(false);
  });

  it('supprime un fichier', async () => {
    const bucket = localStorage.from('images');
    const removed = await bucket.remove(['photo-test.webp']);
    expect(removed.error).toBeNull();

    // Le fichier a disparu : un nouveau dÃ©pÃ´t est possible.
    const again = await bucket.upload('photo-test.webp', Buffer.from('x'), { upsert: false });
    expect(again.error).toBeNull();
  });

  it('refuse la traversÃ©e de chemin', () => {
    expect(() => resolveObjectPath('images', '../../etc/passwd')).toThrow();
    expect(() => resolveObjectPath('images', '/etc/passwd')).toThrow();
    expect(() => resolveObjectPath('images', 'a/../../b')).toThrow();
    expect(() => resolveObjectPath('bucket-inconnu', 'a.png')).toThrow();
  });

  it('sert les images publiques et refuse les documents non signÃ©s', async () => {
    const app = express();
    app.use('/api/media', mediaRouter);

    const bucket = localStorage.from('images');
    await bucket.upload('servie.webp', Buffer.from('image'), { upsert: true });

    const ok = await request(app).get('/api/media/images/servie.webp');
    expect(ok.status).toBe(200);
    expect(ok.headers['cache-control']).toContain('max-age');

    const refused = await request(app).get('/api/media/verification-docs/gerant-1/piece.pdf');
    expect(refused.status).toBe(403);

    const introuvable = await request(app).get('/api/media/images/inexistant.webp');
    expect(introuvable.status).toBe(404);
  });
});
