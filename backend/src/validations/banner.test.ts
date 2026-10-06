import { describe, expect, it } from 'vitest';
import { bannerCreateSchema, bannerUpdateSchema } from './banner';

const validBanner = {
  section: 'promos',
  img: 'https://cdn.example.com/promo.webp',
  alt: 'Promo rentrée',
  link: '/promos/rentree',
  market: 'CI',
  order: 2,
};

describe('bannerCreateSchema', () => {
  it('accepte une bannière valide sur les deux marchés', () => {
    expect(bannerCreateSchema.safeParse(validBanner).success).toBe(true);
    expect(bannerCreateSchema.safeParse({ ...validBanner, market: 'BJ' }).success).toBe(true);
  });

  it('applique un alt vide par défaut', () => {
    const parsed = bannerCreateSchema.safeParse({ ...validBanner, alt: undefined });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.alt).toBe('');
  });

  it('exige section, img, link, market et order', () => {
    expect(bannerCreateSchema.safeParse({ ...validBanner, section: undefined }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, img: undefined }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, link: undefined }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, market: undefined }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, order: undefined }).success).toBe(false);
  });

  it('n’accepte que les sections popular, promos, categories et events', () => {
    expect(bannerCreateSchema.safeParse({ ...validBanner, section: 'accueil' }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, section: 'POPULAR' }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, section: 'popular' }).success).toBe(true);
    expect(bannerCreateSchema.safeParse({ ...validBanner, section: 'events' }).success).toBe(true);
  });

  it('refuse une image vide, réduite à des espaces ou trop longue', () => {
    expect(bannerCreateSchema.safeParse({ ...validBanner, img: '' }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, img: '   ' }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, img: 'x'.repeat(2049) }).success).toBe(false);
  });

  it('refuse un lien vide ou trop long', () => {
    expect(bannerCreateSchema.safeParse({ ...validBanner, link: '' }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, link: ' '.repeat(5) }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, link: 'x'.repeat(2049) }).success).toBe(false);
  });

  it('refuse un marché inconnu', () => {
    expect(bannerCreateSchema.safeParse({ ...validBanner, market: 'XX' }).success).toBe(false);
  });

  it('limite order à un entier entre 0 et 10000', () => {
    expect(bannerCreateSchema.safeParse({ ...validBanner, order: 0 }).success).toBe(true);
    expect(bannerCreateSchema.safeParse({ ...validBanner, order: 10_000 }).success).toBe(true);
    expect(bannerCreateSchema.safeParse({ ...validBanner, order: -1 }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, order: 10_001 }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, order: 1.5 }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, order: '2' }).success).toBe(false);
  });

  it('limite alt à 300 caractères', () => {
    expect(bannerCreateSchema.safeParse({ ...validBanner, alt: 'x'.repeat(300) }).success).toBe(true);
    expect(bannerCreateSchema.safeParse({ ...validBanner, alt: 'x'.repeat(301) }).success).toBe(false);
  });

  it('refuse tout champ inconnu (strict)', () => {
    expect(bannerCreateSchema.safeParse({ ...validBanner, titre: 'Bannière' }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, id: 'b1' }).success).toBe(false);
    expect(bannerCreateSchema.safeParse({ ...validBanner, created_at: '2026-01-01' }).success).toBe(false);
  });

  it('détaille l’erreur de validation', () => {
    const parsed = bannerCreateSchema.safeParse({ ...validBanner, market: 'XX' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path.includes('market'))).toBe(true);
  });
});

describe('bannerUpdateSchema', () => {
  it('accepte un objet partiel (un seul champ)', () => {
    expect(bannerUpdateSchema.safeParse({ order: 5 }).success).toBe(true);
    expect(bannerUpdateSchema.safeParse({ section: 'popular' }).success).toBe(true);
    expect(bannerUpdateSchema.safeParse({ link: '/nouvelle-promo' }).success).toBe(true);
  });

  it('accepte un objet vide (le défaut alt est injecté)', () => {
    const parsed = bannerUpdateSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ alt: '' });
  });

  it('valide les champs présents avec les mêmes règles que la création', () => {
    expect(bannerUpdateSchema.safeParse({ order: -1 }).success).toBe(false);
    expect(bannerUpdateSchema.safeParse({ order: 1.5 }).success).toBe(false);
    expect(bannerUpdateSchema.safeParse({ market: 'XX' }).success).toBe(false);
    expect(bannerUpdateSchema.safeParse({ section: 'accueil' }).success).toBe(false);
    expect(bannerUpdateSchema.safeParse({ img: '' }).success).toBe(false);
    expect(bannerUpdateSchema.safeParse({ alt: 'x'.repeat(301) }).success).toBe(false);
  });

  it('refuse tout champ inconnu (strict)', () => {
    expect(bannerUpdateSchema.safeParse({ titre: 'X' }).success).toBe(false);
    expect(bannerUpdateSchema.safeParse({ order: 1, id: 'b1' }).success).toBe(false);
  });
});
