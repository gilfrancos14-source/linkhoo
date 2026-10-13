import { describe, expect, it } from 'vitest';
import {
  escapadeQuerySchema,
  escapadeCreateSchema,
  escapadeUpdateSchema,
} from './escapade';

const validCreate = {
  market: 'BJ' as const,
  lieu: 'Ouidah',
  description: 'Plages, musée et balades en famille.',
  images: ['/images/ouidah.jpg'],
};

describe('escapadeQuerySchema', () => {
  it('accepte un marché valide', () => {
    expect(escapadeQuerySchema.safeParse({ market: 'CI' }).success).toBe(true);
  });

  it('refuse market absent (cartes CI/BJ mélangées)', () => {
    expect(escapadeQuerySchema.safeParse({}).success).toBe(false);
  });

  it('refuse un paramètre inconnu', () => {
    expect(escapadeQuerySchema.safeParse({ market: 'BJ', tri: 'date' }).success).toBe(false);
  });

  it('refuse un marché hors registre', () => {
    expect(escapadeQuerySchema.safeParse({ market: 'XX' }).success).toBe(false);
  });
});

describe('escapadeCreateSchema', () => {
  it('accepte une escapade valide (image locale)', () => {
    expect(escapadeCreateSchema.safeParse(validCreate).success).toBe(true);
  });

  it('accepte une image Supabase publique', () => {
    const result = escapadeCreateSchema.safeParse({
      ...validCreate,
      images: ['https://abc.supabase.co/storage/v1/object/public/images/ouidah.webp'],
    });
    expect(result.success).toBe(true);
  });

  it('accepte jusqu’à 5 images', () => {
    const images = [
      '/images/a.jpg',
      '/images/b.jpg',
      '/images/c.jpg',
      '/images/d.jpg',
      '/images/e.jpg',
    ];
    expect(escapadeCreateSchema.safeParse({ ...validCreate, images }).success).toBe(true);
  });

  it('refuse 6 images (max 5)', () => {
    const images = ['/images/a.jpg', '/images/b.jpg', '/images/c.jpg', '/images/d.jpg', '/images/e.jpg', '/images/f.jpg'];
    expect(escapadeCreateSchema.safeParse({ ...validCreate, images }).success).toBe(false);
  });

  it('refuse un tableau d’images vide', () => {
    expect(escapadeCreateSchema.safeParse({ ...validCreate, images: [] }).success).toBe(false);
  });

  it('refuse une image externe hors stockage plateforme', () => {
    const result = escapadeCreateSchema.safeParse({
      ...validCreate,
      images: ['https://evil.example.com/photo.jpg'],
    });
    expect(result.success).toBe(false);
  });

  it('refuse un lieu vide ou trop long', () => {
    expect(escapadeCreateSchema.safeParse({ ...validCreate, lieu: '' }).success).toBe(false);
    expect(escapadeCreateSchema.safeParse({ ...validCreate, lieu: 'x'.repeat(121) }).success).toBe(false);
  });

  it('refuse une description contenant un numéro de téléphone', () => {
    const result = escapadeCreateSchema.safeParse({
      ...validCreate,
      description: 'Appelez le +229 97 00 00 00 pour réserver.',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un champ inconnu', () => {
    expect(escapadeCreateSchema.safeParse({ ...validCreate, position: 3 }).success).toBe(false);
  });

  it('refuse un marché invalide', () => {
    expect(escapadeCreateSchema.safeParse({ ...validCreate, market: 'XX' }).success).toBe(false);
  });
});

describe('escapadeUpdateSchema', () => {
  it('accepte une mise à jour partielle', () => {
    expect(escapadeUpdateSchema.safeParse({ lieu: 'Nouveau lieu' }).success).toBe(true);
  });

  it('accepte la mise à jour de plusieurs champs', () => {
    const result = escapadeUpdateSchema.safeParse({
      description: 'Nouvelle description.',
      images: ['/images/nouvelle.jpg'],
    });
    expect(result.success).toBe(true);
  });

  it('accepte un objet vide (le routeur rejettera côté serveur)', () => {
    expect(escapadeUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('refuse un champ inconnu', () => {
    expect(escapadeUpdateSchema.safeParse({ alt: 'x' }).success).toBe(false);
  });

  it('refuse une description avec téléphone', () => {
    expect(
      escapadeUpdateSchema.safeParse({ description: 'Tél 01 02 03 04 05' }).success,
    ).toBe(false);
  });

  it('refuse un tableau d’images invalide', () => {
    expect(escapadeUpdateSchema.safeParse({ images: [] }).success).toBe(false);
  });
});
