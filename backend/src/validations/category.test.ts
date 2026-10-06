import { describe, expect, it } from 'vitest';
import { categoryCreateSchema, categoryUpdateSchema } from './category';

const validCategory = {
  title: 'Meublé',
  img: 'https://cdn.example.com/meuble.webp',
  alt: 'Meublé à Abidjan',
  market: 'CI',
};

describe('categoryCreateSchema', () => {
  it('accepte une catégorie valide sur les deux marchés', () => {
    expect(categoryCreateSchema.safeParse(validCategory).success).toBe(true);
    expect(categoryCreateSchema.safeParse({ ...validCategory, market: 'BJ' }).success).toBe(true);
  });

  it('applique un alt vide par défaut', () => {
    const parsed = categoryCreateSchema.safeParse({ ...validCategory, alt: undefined });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.alt).toBe('');
  });

  it('exige title, img et market', () => {
    expect(categoryCreateSchema.safeParse({ ...validCategory, title: undefined }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...validCategory, img: undefined }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...validCategory, market: undefined }).success).toBe(false);
  });

  it('détaille l’erreur sur le titre manquant', () => {
    const parsed = categoryCreateSchema.safeParse({ ...validCategory, title: undefined });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path.includes('title'))).toBe(true);
  });

  it('refuse un titre vide, réduit à des espaces ou trop long', () => {
    expect(categoryCreateSchema.safeParse({ ...validCategory, title: '' }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...validCategory, title: '   ' }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...validCategory, title: 'x'.repeat(201) }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...validCategory, title: 'x'.repeat(200) }).success).toBe(true);
  });

  it('refuse une image vide ou trop longue', () => {
    expect(categoryCreateSchema.safeParse({ ...validCategory, img: '' }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...validCategory, img: '  ' }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...validCategory, img: 'x'.repeat(2049) }).success).toBe(false);
  });

  it('refuse un marché inconnu', () => {
    expect(categoryCreateSchema.safeParse({ ...validCategory, market: 'XX' }).success).toBe(false);
  });

  it('limite alt à 300 caractères', () => {
    expect(categoryCreateSchema.safeParse({ ...validCategory, alt: 'x'.repeat(301) }).success).toBe(false);
  });

  it('refuse tout champ inconnu (strict)', () => {
    expect(categoryCreateSchema.safeParse({ ...validCategory, slug: 'meuble' }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...validCategory, id: 'c1' }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...validCategory, ordre: 2 }).success).toBe(false);
  });

  it('détaille les champs rejetés (strict)', () => {
    const parsed = categoryCreateSchema.safeParse({ ...validCategory, slug: 'meuble' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });
});

describe('categoryUpdateSchema', () => {
  it('accepte un objet partiel (un seul champ)', () => {
    expect(categoryUpdateSchema.safeParse({ title: 'Studio' }).success).toBe(true);
    expect(categoryUpdateSchema.safeParse({ market: 'BJ' }).success).toBe(true);
    expect(categoryUpdateSchema.safeParse({ img: 'https://cdn.example.com/new.webp' }).success).toBe(true);
  });

  it('accepte un objet vide (le défaut alt est injecté)', () => {
    const parsed = categoryUpdateSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ alt: '' });
  });

  it('valide les champs présents avec les mêmes règles que la création', () => {
    expect(categoryUpdateSchema.safeParse({ title: '' }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ market: 'XX' }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ img: '' }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ alt: 'x'.repeat(301) }).success).toBe(false);
  });

  it('refuse tout champ inconnu (strict)', () => {
    expect(categoryUpdateSchema.safeParse({ slug: 'studio' }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ title: 'X', id: 'c1' }).success).toBe(false);
  });
});
