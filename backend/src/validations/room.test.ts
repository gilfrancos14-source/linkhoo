import { describe, expect, it, vi } from 'vitest';
import { roomCreateSchema, roomUpdateSchema, roomAvailableQuerySchema } from './room';

// Le schéma de création n'accepte que des photos téléversées dans NOTRE
// stockage : on fixe la base publique pour des assertions stables.
vi.hoisted(() => {
  process.env.STORAGE_PUBLIC_BASE_URL = 'https://ilehya.test/media';
});

const MEDIA = 'https://ilehya.test/media/images';

const validRoom = {
  title: 'Studio meublé Cocody',
  subtitle: 'Proche des universities',
  info: 'Eau et électricité incluses',
  price: '250 000 FCFA',
  price_num: 250000,
  price_unit: '/ mois' as const,
  img: `${MEDIA}/studio.webp`,
  alt: 'Salon du studio',
  images: [`${MEDIA}/studio-1.webp`],
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
  it('accepte un lien Google Maps facultatif', () => {
    const parsed = roomCreateSchema.safeParse({
      ...validRoom,
      maps_url: 'https://www.google.com/maps/place/Test/@5.3,4.0,17z',
    });
    expect(parsed.success).toBe(true);
    expect(roomCreateSchema.safeParse({ ...validRoom, maps_url: null }).success).toBe(true);
    expect(roomCreateSchema.safeParse(validRoom).success).toBe(true);
  });

  it('refuse une URL qui n’est pas un lien Google Maps', () => {
    expect(
      roomCreateSchema.safeParse({ ...validRoom, maps_url: 'https://exemple.com/maps' }).success,
    ).toBe(false);
    expect(
      roomCreateSchema.safeParse({ ...validRoom, maps_url: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  it('accepte au maximum cinq images', () => {
    const images = ['a', 'b', 'c', 'd', 'e'].map((n) => `${MEDIA}/${n}.webp`);
    expect(roomCreateSchema.safeParse({ ...validRoom, images }).success).toBe(true);
  });

  it('refuse plus de cinq images', () => {
    const images = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => `${MEDIA}/${n}.webp`);
    expect(roomCreateSchema.safeParse({ ...validRoom, images }).success).toBe(false);
  });

  it('refuse un chemin local /images/ à la création (photo stock non vérifiée)', () => {
    const parsed = roomCreateSchema.safeParse({
      ...validRoom,
      img: '/images/pexels-123.jpg',
      images: ['/images/pexels-123.jpg'],
    });
    expect(parsed.success).toBe(false);
  });

  it('refuse une URL Supabase historique à la création (nouvelle annonce)', () => {
    const parsed = roomCreateSchema.safeParse({
      ...validRoom,
      img: 'https://ilehya.supabase.co/storage/v1/object/public/images/studio.webp',
      images: ['https://ilehya.supabase.co/storage/v1/object/public/images/studio.webp'],
    });
    expect(parsed.success).toBe(false);
  });

  it('refuse une URL image hors du stockage de la plateforme', () => {
    expect(
      roomCreateSchema.safeParse({ ...validRoom, img: 'https://evil.example.com/media/images/photo.webp' }).success,
    ).toBe(false);
    expect(
      roomCreateSchema.safeParse({ ...validRoom, img: 'https://evil.example.com/photo.webp' }).success,
    ).toBe(false);
    expect(
      roomCreateSchema.safeParse({
        ...validRoom,
        img: 'https://attacker.supabase.co/storage/v1/object/public/images/x.webp',
      }).success,
    ).toBe(false);
    expect(
      roomCreateSchema.safeParse({
        ...validRoom,
        img: 'https://ilehya.supabase.co/storage/v1/object/public/verification-docs/x.webp',
      }).success,
    ).toBe(false);
    expect(roomCreateSchema.safeParse({ ...validRoom, img: 'data:image/png;base64,AAAA' }).success).toBe(false);
  });

  it('refuse un PDF comme photo de chambre', () => {
    const parsed = roomCreateSchema.safeParse({ ...validRoom, img: `${MEDIA}/document.pdf` });
    expect(parsed.success).toBe(false);
  });

  it('refuse une URL avec query string ou fragment (contournement)', () => {
    expect(roomCreateSchema.safeParse({ ...validRoom, img: `${MEDIA}/photo.webp?x=.pdf` }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ ...validRoom, img: `${MEDIA}/photo.webp#frag` }).success).toBe(false);
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

  it('refuse un numéro de téléphone écrit en lettres dans la description', () => {
    const parsed = roomCreateSchema.safeParse({
      ...validRoom,
      description:
        'Un studio confortable. Appelez zéro six zéro sept douze trente-quatre cinquante-six.',
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

  it('accepte les URLs historiques déjà en base (compatibilité de modification)', () => {
    expect(roomUpdateSchema.safeParse({ img: '/images/pexels-123.jpg' }).success).toBe(true);
    expect(roomUpdateSchema.safeParse({ images: ['/images/pexels-123.jpg'] }).success).toBe(true);
    expect(
      roomUpdateSchema.safeParse({
        images: ['https://ilehya.supabase.co/storage/v1/object/public/images/studio.webp'],
      }).success,
    ).toBe(true);
  });

  it('refuse les hôtes arbitraires et les PDF même en mise à jour', () => {
    expect(
      roomUpdateSchema.safeParse({ img: 'https://evil.example.com/media/images/photo.webp' }).success,
    ).toBe(false);
    expect(roomUpdateSchema.safeParse({ img: '/images/document.pdf' }).success).toBe(false);
  });

  it('accepte jusqu’à 5 photos et refuse la 6e', () => {
    const urls = Array.from({ length: 5 }, (_, index) => `/images/photo-${index + 1}.jpg`);
    expect(roomUpdateSchema.safeParse({ images: urls }).success).toBe(true);
    expect(roomUpdateSchema.safeParse({ images: [...urls, '/images/photo-6.jpg'] }).success).toBe(false);
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

  it('accepte les filtres serveur quartier/catégorie/budget', () => {
    const parsed = roomAvailableQuerySchema.safeParse({
      ...validQuery,
      quartier: 'Cocody',
      category: 'ci-appartements',
      prix_min: 10000,
      prix_max: 50000,
    });
    expect(parsed.success).toBe(true);
  });

  it('refuse un budget dont le minimum dépasse le maximum', () => {
    const parsed = roomAvailableQuerySchema.safeParse({
      ...validQuery,
      prix_min: 50000,
      prix_max: 10000,
    });
    expect(parsed.success).toBe(false);
  });

  it('accepte une requête textuelle sur les disponibilités', () => {
    const parsed = roomAvailableQuerySchema.safeParse({ ...validQuery, q: 'Bouaké' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.q).toBe('Bouaké');
  });
});

describe('promotion du gérant', () => {
  it('accepte une réduction avec fenêtre de séjour et dates', () => {
    const parsed = roomCreateSchema.safeParse({
      ...validRoom,
      promo_group: 'promo_15',
      promo_min_nights: 3,
      promo_max_nights: 14,
      promo_start: '2026-12-01',
      promo_end: '2026-12-31',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.promo_group).toBe('promo_15');
      expect(parsed.data.promo_min_nights).toBe(3);
    }
  });

  it('refuse un groupe inconnu ou une durée hors bornes', () => {
    expect(roomCreateSchema.safeParse({ ...validRoom, promo_group: 'promo_50' }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ ...validRoom, promo_min_nights: 0 }).success).toBe(false);
  });
});

describe('équipements et restauration', () => {
  it('accepte des équipements connus et une restauration', () => {
    const parsed = roomCreateSchema.safeParse({
      ...validRoom,
      equipments: ['wifi', 'climatisation'],
      restauration: 'petit_dejeuner_inclus',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.equipments).toEqual(['wifi', 'climatisation']);
      expect(parsed.data.restauration).toBe('petit_dejeuner_inclus');
    }
  });

  it('refuse un équipement inconnu, un doublon ou une restauration inconnue', () => {
    expect(roomCreateSchema.safeParse({ ...validRoom, equipments: ['inconnu'] }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ ...validRoom, equipments: ['wifi', 'wifi'] }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ ...validRoom, restauration: 'buffet' }).success).toBe(false);
  });

  it('applique les valeurs par défaut', () => {
    const parsed = roomCreateSchema.safeParse(validRoom);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.equipments).toEqual([]);
      expect(parsed.data.restauration).toBe('aucune');
    }
  });
});
