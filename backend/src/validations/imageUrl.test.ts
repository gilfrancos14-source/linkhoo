import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  imageUrlSchema,
  isAllowedImageUrl,
  isLegacyStaticImageUrl,
  isPlatformImageUrl,
  legacyImageUrlSchema,
  platformImageUrlSchema,
} from './imageUrl';

const BASE = 'https://ilehya.test/media';
const PREVIOUS_BASE = process.env.STORAGE_PUBLIC_BASE_URL;

beforeEach(() => {
  process.env.STORAGE_PUBLIC_BASE_URL = BASE;
});

afterEach(() => {
  if (PREVIOUS_BASE === undefined) {
    delete process.env.STORAGE_PUBLIC_BASE_URL;
  } else {
    process.env.STORAGE_PUBLIC_BASE_URL = PREVIOUS_BASE;
  }
});

describe('isPlatformImageUrl', () => {
  it('accepte une photo téléversée dans notre stockage', () => {
    expect(isPlatformImageUrl(`${BASE}/images/6f1c.webp`)).toBe(true);
    expect(isPlatformImageUrl(`${BASE}/images/sous/dossier/photo.jpg`)).toBe(true);
  });

  it('accepte la base de développement (sans slash final)', () => {
    process.env.STORAGE_PUBLIC_BASE_URL = 'http://localhost:3001/api/media/';
    expect(isPlatformImageUrl('http://localhost:3001/api/media/images/abc.png')).toBe(true);
  });

  it('refuse un autre domaine, même avec le chemin /media/images/', () => {
    expect(isPlatformImageUrl('https://evil.example.com/media/images/x.jpg')).toBe(false);
    expect(isPlatformImageUrl('https://ilehya.test.evil.com/media/images/x.jpg')).toBe(false);
    expect(isPlatformImageUrl('https://ilehya.test/media/images/x.jpg.evil')).toBe(false);
  });

  it('refuse un autre projet Supabase', () => {
    expect(
      isPlatformImageUrl('https://attacker.supabase.co/storage/v1/object/public/images/x.jpg'),
    ).toBe(false);
  });

  it('refuse un chemin local /images/ (visuel du frontend)', () => {
    expect(isPlatformImageUrl('/images/pexels-123.jpg')).toBe(false);
  });

  it('refuse un PDF et les fichiers non-image', () => {
    expect(isPlatformImageUrl(`${BASE}/images/document.pdf`)).toBe(false);
    expect(isPlatformImageUrl(`${BASE}/images/script.js`)).toBe(false);
    expect(isPlatformImageUrl(`${BASE}/images/sans-extension`)).toBe(false);
  });

  it('refuse query string et fragment', () => {
    expect(isPlatformImageUrl(`${BASE}/images/x.webp?x=1`)).toBe(false);
    expect(isPlatformImageUrl(`${BASE}/images/x.webp#frag`)).toBe(false);
  });

  it('refuse les schémas non http(s) et les URL relatives', () => {
    expect(isPlatformImageUrl('javascript:alert(1)')).toBe(false);
    expect(isPlatformImageUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isPlatformImageUrl('//ilehya.test/media/images/x.jpg')).toBe(false);
    expect(isPlatformImageUrl('/media/images/x.jpg')).toBe(false);
  });

  it('refuse le bucket privé de vérification', () => {
    expect(isPlatformImageUrl(`${BASE}/verification-docs/user_1/carte.png`)).toBe(false);
  });
});

describe('isLegacyStaticImageUrl', () => {
  it('accepte les formes historiques déjà en base', () => {
    expect(isLegacyStaticImageUrl('/images/pexels-123.jpg')).toBe(true);
    expect(
      isLegacyStaticImageUrl('https://ilehya.supabase.co/storage/v1/object/public/images/a.webp'),
    ).toBe(true);
  });

  it('refuse les PDF et les hôtes arbitraires', () => {
    expect(isLegacyStaticImageUrl('/images/document.pdf')).toBe(false);
    expect(isLegacyStaticImageUrl('https://evil.example.com/media/images/x.jpg')).toBe(false);
    expect(
      isLegacyStaticImageUrl('https://ilehya.supabase.co/storage/v1/object/public/other/x.webp'),
    ).toBe(false);
  });
});

describe('isAllowedImageUrl', () => {
  it('combine stockage plateforme et formes historiques', () => {
    expect(isAllowedImageUrl(`${BASE}/images/x.webp`)).toBe(true);
    expect(isAllowedImageUrl('/images/x.jpg')).toBe(true);
  });
});

describe('schémas zod', () => {
  it('platformImageUrlSchema ne laisse passer que le stockage plateforme', () => {
    expect(platformImageUrlSchema.safeParse(`${BASE}/images/x.webp`).success).toBe(true);
    expect(platformImageUrlSchema.safeParse('/images/x.jpg').success).toBe(false);
    expect(
      platformImageUrlSchema.safeParse('https://evil.example.com/media/images/x.jpg').success,
    ).toBe(false);
  });

  it('legacyImageUrlSchema accepte les formes historiques', () => {
    expect(legacyImageUrlSchema.safeParse('/images/x.jpg').success).toBe(true);
    expect(legacyImageUrlSchema.safeParse(`${BASE}/images/x.webp`).success).toBe(true);
    expect(
      legacyImageUrlSchema.safeParse('https://evil.example.com/media/images/x.jpg').success,
    ).toBe(false);
  });

  it('imageUrlSchema reste un alias de compatibilité', () => {
    expect(imageUrlSchema.safeParse('/images/x.jpg').success).toBe(true);
  });
});
