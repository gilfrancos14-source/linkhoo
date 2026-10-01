import { describe, expect, it } from 'vitest';
import {
  destinationCreateSchema,
  destinationQuerySchema,
  destinationUpdateSchema,
} from './tourism';

const validCreate = {
  market: 'BJ',
  city: 'Ouidah',
  title: 'Route des esclaves',
  description: 'Balade historique sur la côte.',
  img: 'https://cdn.example.com/ouidah.webp',
  alt: 'Route des esclaves à Ouidah',
};

describe('destinationQuerySchema', () => {
  it('accepte un marché valide', () => {
    expect(destinationQuerySchema.safeParse({ market: 'CI' }).success).toBe(true);
    expect(destinationQuerySchema.safeParse({ market: 'BJ' }).success).toBe(true);
  });

  it('refuse l’absence de marché (destinations CI/BJ mélangées)', () => {
    expect(destinationQuerySchema.safeParse({}).success).toBe(false);
  });

  it('refuse un marché inconnu', () => {
    expect(destinationQuerySchema.safeParse({ market: 'TG' }).success).toBe(false);
  });

  it('refuse tout paramètre inconnu (strict)', () => {
    expect(destinationQuerySchema.safeParse({ market: 'BJ', featured: '1' }).success).toBe(false);
  });
});

describe('destinationCreateSchema', () => {
  it('accepte une destination valide', () => {
    expect(destinationCreateSchema.safeParse(validCreate).success).toBe(true);
  });

  it('exige marché, ville, titre, description et image', () => {
    expect(destinationCreateSchema.safeParse({ ...validCreate, market: undefined }).success).toBe(false);
    expect(destinationCreateSchema.safeParse({ ...validCreate, city: undefined }).success).toBe(false);
    expect(destinationCreateSchema.safeParse({ ...validCreate, title: undefined }).success).toBe(false);
    expect(destinationCreateSchema.safeParse({ ...validCreate, description: undefined }).success).toBe(false);
    expect(destinationCreateSchema.safeParse({ ...validCreate, img: undefined }).success).toBe(false);
  });

  it('force description non vide (colonne NOT NULL sans défaut)', () => {
    expect(destinationCreateSchema.safeParse({ ...validCreate, description: '' }).success).toBe(false);
    expect(destinationCreateSchema.safeParse({ ...validCreate, description: '   ' }).success).toBe(false);
  });

  it('met featured à false par défaut', () => {
    const parsed = destinationCreateSchema.parse(validCreate);
    expect(parsed.featured).toBe(false);
    expect(destinationCreateSchema.parse({ ...validCreate, featured: true }).featured).toBe(true);
  });

  it('refuse featured non booléen', () => {
    expect(destinationCreateSchema.safeParse({ ...validCreate, featured: 'oui' }).success).toBe(false);
  });

  it('limite la description à 2000 caractères et le titre à 200', () => {
    expect(destinationCreateSchema.safeParse({ ...validCreate, description: 'x'.repeat(2001) }).success).toBe(false);
    expect(destinationCreateSchema.safeParse({ ...validCreate, title: 'x'.repeat(201) }).success).toBe(false);
  });

  it('refuse les champs inconnus (strict)', () => {
    expect(destinationCreateSchema.safeParse({ ...validCreate, order: 3 }).success).toBe(false);
  });
});

describe('destinationUpdateSchema', () => {
  it('accepte un objet partiel (un seul champ)', () => {
    expect(destinationUpdateSchema.safeParse({ title: 'Nouveau titre' }).success).toBe(true);
  });

  it('n’injecte pas de valeur par défaut sur les champs absents', () => {
    // Régression : optionalText porte un .default('') qui, via .partial(),
    // écraserait alt par '' à chaque mise à jour partielle.
    const parsed = destinationUpdateSchema.parse({ featured: true });
    expect(parsed).toEqual({ featured: true });
    expect(parsed).not.toHaveProperty('alt');
    expect(parsed).not.toHaveProperty('description');
  });

  it('valide les champs présents avec les mêmes règles que la création', () => {
    expect(destinationUpdateSchema.safeParse({ img: '' }).success).toBe(false);
    expect(destinationUpdateSchema.safeParse({ market: 'TG' }).success).toBe(false);
    expect(destinationUpdateSchema.safeParse({ description: '' }).success).toBe(false);
    expect(destinationUpdateSchema.safeParse({ featured: 'oui' }).success).toBe(false);
  });

  it('accepte un objet vide (le routeur refuse de son côté)', () => {
    expect(destinationUpdateSchema.safeParse({}).success).toBe(true);
  });
});
