import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import uploadRouter from './upload';
import { supabaseAdmin } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
  clerkBearer,
  defaultVerifyToken,
  fakeChain,
  supabaseStorage,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(),
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => {
    const pipeline = {
      resize: vi.fn(() => pipeline),
      webp: vi.fn(() => pipeline),
      toBuffer: vi.fn(async () => Buffer.from('donnees-webp')),
    };
    return pipeline;
  }),
}));

const app = buildTestApp('/api/upload', uploadRouter);

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
const PDF_HEADER = Buffer.from('%PDF-1.4\n% contenu du document', 'utf8');

let gerants: FakeChain;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  gerants = fakeChain({ data: null, error: null });
  useSupabaseTables(supabaseAdmin.from, { gerants });
});

describe("POST /api/upload — contrôle d'accès", () => {
  it('401 sans jeton', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token d'authentification manquant");
  });

  it('401 si ni Clerk ni l’admin ne reconnaissent le jeton', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', Bearer('nimporte-quoi'))
      .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
  });

  it('403 pour un simple client connecté', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Accès réservé aux comptes gérant');
  });

  it('200 : un jeton admin passe sans interrogation de la table gerants', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${adminToken()}`)
      .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(gerants.maybeSingle).not.toHaveBeenCalled();
  });

  it('200 : un gérant connecté peut téléverser', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/upload — fichier', () => {
  it('400 si aucun fichier nest envoyé', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .field('bucket', 'images');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Aucun fichier envoyé');
  });

  it('400 si le type mime est interdit', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', Buffer.from('du texte'), {
        filename: 'script.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('JPEG, PNG, WebP, GIF et PDF');
  });

  it('400 si le contenu ne correspond pas à la signature annoncée', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', Buffer.from('ceci nest pas un png'), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le fichier envoyé n'est pas un fichier valide");
  });

  it('413 si le fichier dépasse 10 Mo', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', Buffer.alloc(11 * 1024 * 1024), {
        filename: 'gros.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Fichier trop volumineux (10 Mo maximum)');
  });

  it('400 sur un bucket inconnu', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .field('bucket', 'secrets')
      .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bucket invalide');
  });
});

describe('POST /api/upload — mise en ligne', () => {
  it('200 : compresse une image en WebP et renvoie une URL publique', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://storage.test/images/fichier-test.webp');
    expect(res.body.path).toMatch(/\.webp$/);
    expect(vi.mocked(sharp)).toHaveBeenCalled();
    expect(supabaseStorage().upload).toHaveBeenCalledWith(
      expect.stringMatching(/\.webp$/),
      Buffer.from('donnees-webp'),
      expect.objectContaining({ contentType: 'image/webp', upsert: false }),
    );
  });

  it('200 : un PDF est téléversé tel quel', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', PDF_HEADER, { filename: 'justificatif.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.path).toMatch(/\.pdf$/);
    expect(vi.mocked(sharp)).not.toHaveBeenCalled();
    expect(supabaseStorage().upload).toHaveBeenCalledWith(
      expect.stringMatching(/\.pdf$/),
      PDF_HEADER,
      expect.objectContaining({ contentType: 'application/pdf' }),
    );
  });

  it('200 : le bucket verification-docs renvoie une URL signée', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .field('bucket', 'verification-docs')
      .attach('file', PDF_HEADER, { filename: 'carte.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://storage.test/signed/fichier-test');
    expect(supabaseStorage().createSignedUrl).toHaveBeenCalledWith(expect.any(String), 3600);
    expect(supabaseStorage().getPublicUrl).not.toHaveBeenCalled();
  });
});

describe('POST /api/upload — signatures dart', () => {
  beforeEach(() => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
  });

  const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const GIF87A = Buffer.from('GIF87a\x01\x00\x01\x00\x80\x00\x00', 'binary');
  const GIF89A = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00', 'binary');
  const WEBP = Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 ', 'binary');

  it('200 : une image JPEG dont la signature correspond', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', JPEG_SIGNATURE, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.path).toMatch(/\.webp$/);
  });

  it('200 : un GIF87a dont la signature correspond', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', GIF87A, { filename: 'anim.gif', contentType: 'image/gif' });

    expect(res.status).toBe(200);
    expect(res.body.path).toMatch(/\.webp$/);
  });

  it('200 : un GIF89a dont la signature correspond', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', GIF89A, { filename: 'anim2.gif', contentType: 'image/gif' });

    expect(res.status).toBe(200);
    expect(res.body.path).toMatch(/\.webp$/);
  });

  it('200 : un WebP dont lentête RIFF/WEBP correspond', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', WEBP, { filename: 'image.webp', contentType: 'image/webp' });

    expect(res.status).toBe(200);
    expect(res.body.path).toMatch(/\.webp$/);
  });

  it('400 : une image JPEG dont la signature ne correspond pas', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', Buffer.from('pas-un-jpeg'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le fichier envoyé n'est pas un fichier valide");
  });

  it('400 : un fichier dont lentête RIFF ne correspond pas', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', Buffer.from('NOPE\x00\x00\x00\x00WEBP'), {
        filename: 'image.webp',
        contentType: 'image/webp',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le fichier envoyé n'est pas un fichier valide");
  });
});

describe('POST /api/upload — échecs des artefacts', () => {
  beforeEach(() => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { gerants });
  });

  it('400 sur un champ de fichier inattendu (erreur multer)', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('photo', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Fichier invalide');
  });

  it('500 quand le téléversement vers le bucket échoue', async () => {
    vi.mocked(supabaseStorage().upload).mockResolvedValueOnce({
      data: null,
      error: { message: 'quota dépassé' },
    } as never);

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erreur interne du serveur');
  });

  it('500 quand la génération de lURL signée échoue', async () => {
    vi.mocked(supabaseStorage().createSignedUrl).mockResolvedValueOnce({
      data: null,
      error: { message: 'bucket verrouillé' },
    } as never);

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', clerkBearer('user_1'))
      .field('bucket', 'verification-docs')
      .attach('file', PDF_HEADER, { filename: 'carte.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erreur interne du serveur');
  });
});

function Bearer(token: string): string {
  return `Bearer ${token}`;
}
