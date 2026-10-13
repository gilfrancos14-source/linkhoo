import { describe, expect, it } from 'vitest';
import { roomCreateSchema, roomUpdateSchema, roomAvailableQuerySchema } from './room';

const validRoom = {
  title: 'Studio meublé Cocody',
  subtitle: 'Proche des universities',
  info: 'Eau et électricité incluses',
  price: '250 000 FCFA',
  price_num: 250000,
  price_unit: '/ mois' as const,
  img: 'https://ilehya.supabase.co/storage/v1/object/public/images/studio.webp',
  alt: 'Salon du studio',
  images: ['https://ilehya.supabase.co/storage/v1/object/public/images/studio-1.webp'],
  description: 'Un studio confortable au cœur de Cocody.',
  capacity: '2 personnes',
  category: 'Studio',
  market: 'CI' as const,
  pays: 'Côte d\'Ivoire',
  ville: 'Abidjan',
  quartier: 'Cocody',
  chambres: 1,
  douches: 1,
  disponible: true,
  date_dispo: '2026-03-01',
  conditions: 'Séjour minimum de 30 jours',
};

describe('roomCreateSchema', () => {
  it('accepte au maximum trois images', () => {
    const images = ['a', 'b', 'c'].map((n) => `https://ilehya.supabase.co/storage/v1/object/public/images/${n}.webp`);
    expect(roomCreateSchema.safeParse({ ...validRoom, images }).success).toBe(true);
  });

  it('refuse plus de trois images', () => {
    const images = ['a', 'b', 'c', 'd'].map((n) => `https://ilehya.supabase.co/storage/v1/object/public/images/${n}.webp`);
    expect(roomCreateSchema.safeParse({ ...validRoom, images }).success).toBe(false);
  });

  it('accepte un chemin local /images/', () => {
    const parsed = roomCreateSchema.safeParse({
      ...validRoom,
      img: '/images/pexels-123.jpg',
      images: ['/images/pexels-123.jpg'],
    });
    expect(parsed.success).toBe(true);
  });

  it('refuse une URL image hors du stockage de la plateforme', () => {
    expect(roomCreateSchema.safeParse({ ...validRoom, img: 'https://evil.example.com/photo.webp' }).success).toBe(false);
    expect(
      roomCreateSchema.safeParse({
        ...validRoom,
        img: 'https://ilehya.supabase.co/storage/v1/object/public/verification-docs/x.webp',
      }).success,
    ).toBe(false);
    expect(roomCreateSchema.safeParse({ ...validRoom, img: 'data:image/png;base64,AAAA' }).success).toBe(false);
  });

  it('accepte une chambre complète', () => {
    const parsed = roomCreateSchema.safeParse(validRoom);
    expect(parsed.success).toBe(true);
  });

  it('applique les valeurs par défaut', () => {
    const payload: Record<string, unknown> = { ...validRoom };
    delete payload.subtitle;
    delete payload.date_dispo;
    const parsed = roomCreateSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.subtitle).toBe('');
    expect(parsed.data.is_popular).toBe(false);
    expect(parsed.data.date_dispo).toBe('');
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = roomCreateSchema.safeParse({ ...validRoom, gerant_id: 'user_1' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un titre vide', () => {
    const parsed = roomCreateSchema.safeParse({ ...validRoom, title: '   ' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un marché inconnu', () => {
    const parsed = roomCreateSchema.safeParse({ ...validRoom, market: 'XX' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un prix non entier', () => {
    const parsed = roomCreateSchema.safeParse({ ...validRoom, price_num: 12.5 });
    expect(parsed.success).toBe(false);
  });

  it('refuse un prix nul ou négatif', () => {
    expect(roomCreateSchema.safeParse({ ...validRoom, price_num: 0 }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ ...validRoom, price_num: -100 }).success).toBe(false);
  });

  it('refuse une liste d’images vide', () => {
    const parsed = roomCreateSchema.safeParse({ ...validRoom, images: [] });
    expect(parsed.success).toBe(false);
  });

  it('refuse une unité de prix inconnue', () => {
    const parsed = roomCreateSchema.safeParse({ ...validRoom, price_unit: '/ semaine' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un nombre de chambres nul', () => {
    const parsed = roomCreateSchema.safeParse({ ...validRoom, chambres: 0 });
    expect(parsed.success).toBe(false);
  });

  it('refuse un numéro de téléphone dans la description', () => {
    const parsed = roomCreateSchema.safeParse({
      ...validRoom,
      description: 'Un studio confortable. Appelez le 07 07 07 07 07 pour visiter.',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0].message).toMatch(/numéros de téléphone/i);
  });

  it('refuse un numéro de téléphone dans les conditions', () => {
    expect(
      roomCreateSchema.safeParse({ ...validRoom, conditions: 'Caution 1 mois. WhatsApp : +2250707070707' }).success,
    ).toBe(false);
  });

  it('accepte prix et dates dans la description (pas de faux positif)', () => {
    const parsed = roomCreateSchema.safeParse({
      ...validRoom,
      description: 'Loyer 150 000 FCFA par mois, caution 1 mois. Disponible le 12-03-2026.',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('roomUpdateSchema', () => {
  it('accepte une mise à jour partielle', () => {
    const parsed = roomUpdateSchema.safeParse({ title: 'Nouveau titre' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.title).toBe('Nouveau titre');
  });

  it('conserve les valeurs par défaut héritées du schéma de création', () => {
    const parsed = roomUpdateSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(Object.keys(parsed.data).length).toBeGreaterThan(0);
  });

  it('refuse un téléphone dans une mise à jour partielle de description', () => {
    const parsed = roomUpdateSchema.safeParse({ description: 'Contact : 0123456789' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = roomUpdateSchema.safeParse({ is_verified: true });
    expect(parsed.success).toBe(false);
  });

  it('refuse un prix invalide même partiel', () => {
    const parsed = roomUpdateSchema.safeParse({ price_num: -1 });
    expect(parsed.success).toBe(false);
  });
});

describe('roomAvailableQuerySchema', () => {
  const validQuery = { arrivee: '2026-05-01', depart: '2026-05-04' };

  it('accepte des dates valides avec un marché', () => {
    const parsed = roomAvailableQuerySchema.safeParse({ ...validQuery, market: 'CI' });
    expect(parsed.success).toBe(true);
  });

  it('accepte une requête sans marché ni ville', () => {
    const parsed = roomAvailableQuerySchema.safeParse(validQuery);
    expect(parsed.success).toBe(true);
  });

  it('exige les deux dates', () => {
    const parsed = roomAvailableQuerySchema.safeParse({ arrivee: '2026-05-01' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un format de date non ISO', () => {
    const parsed = roomAvailableQuerySchema.safeParse({ arrivee: '01/05/2026', depart: '04/05/2026' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un départ égal ou antérieur à l’arrivée', () => {
    const equal = roomAvailableQuerySchema.safeParse({ arrivee: '2026-05-01', depart: '2026-05-01' });
    expect(equal.success).toBe(false);
    if (equal.success) return;

    const before = roomAvailableQuerySchema.safeParse({ arrivee: '2026-05-04', depart: '2026-05-01' });
    expect(before.success).toBe(false);
    if (before.success) return;
    expect(before.error.issues[0]?.path).toEqual(['depart']);
    expect(before.error.issues[0]?.message).toContain('ultérieure');
  });

  it('refuse un marché inconnu', () => {
    const parsed = roomAvailableQuerySchema.safeParse({ ...validQuery, market: 'XX' });
    expect(parsed.success).toBe(false);
  });
});
