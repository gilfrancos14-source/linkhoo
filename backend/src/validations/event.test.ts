import { describe, expect, it } from 'vitest';
import { eventCreateSchema, eventQuerySchema, eventUpdateSchema } from './event';

const validCreate = {
  market: 'CI',
  city: 'Abidjan',
  title: 'Salon immobilier',
  description: 'Événement annuel',
  event_date: '2026-10-12',
  img: 'https://cdn.example.com/e.webp',
  alt: 'Stand Ilehya',
};

describe('eventQuerySchema', () => {
  it('accepte un marché valide', () => {
    expect(eventQuerySchema.safeParse({ market: 'CI' }).success).toBe(true);
    expect(eventQuerySchema.safeParse({ market: 'BJ' }).success).toBe(true);
  });

  it('refuse l’absence de marché (villes CI/BJ mélangées)', () => {
    expect(eventQuerySchema.safeParse({}).success).toBe(false);
  });

  it('refuse un marché inconnu', () => {
    expect(eventQuerySchema.safeParse({ market: 'TG' }).success).toBe(false);
  });

  it('accepte include_past=0|1 uniquement', () => {
    expect(eventQuerySchema.safeParse({ market: 'CI', include_past: '1' }).success).toBe(true);
    expect(eventQuerySchema.safeParse({ market: 'CI', include_past: '0' }).success).toBe(true);
    expect(eventQuerySchema.safeParse({ market: 'CI', include_past: 'true' }).success).toBe(false);
  });

  it('refuse tout paramètre inconnu (strict)', () => {
    expect(eventQuerySchema.safeParse({ market: 'CI', tri: 'date' }).success).toBe(false);
  });
});

describe('eventCreateSchema', () => {
  it('accepte un événement valide', () => {
    const parsed = eventCreateSchema.safeParse(validCreate);
    expect(parsed.success).toBe(true);
  });

  it('exige marché, ville, titre, date et image', () => {
    expect(eventCreateSchema.safeParse({ ...validCreate, market: undefined }).success).toBe(false);
    expect(eventCreateSchema.safeParse({ ...validCreate, city: undefined }).success).toBe(false);
    expect(eventCreateSchema.safeParse({ ...validCreate, title: undefined }).success).toBe(false);
    expect(eventCreateSchema.safeParse({ ...validCreate, event_date: undefined }).success).toBe(false);
    expect(eventCreateSchema.safeParse({ ...validCreate, img: undefined }).success).toBe(false);
  });

  it('refuse une date au format autre que YYYY-MM-DD', () => {
    expect(eventCreateSchema.safeParse({ ...validCreate, event_date: '12/10/2026' }).success).toBe(false);
    expect(eventCreateSchema.safeParse({ ...validCreate, event_date: '2026-13-45' }).success).toBe(false);
  });

  it('limite la description à 2000 caractères et le titre à 200', () => {
    expect(eventCreateSchema.safeParse({ ...validCreate, description: 'x'.repeat(2001) }).success).toBe(false);
    expect(eventCreateSchema.safeParse({ ...validCreate, title: 'x'.repeat(201) }).success).toBe(false);
  });

  it('refuse les champs inconnus (strict)', () => {
    expect(eventCreateSchema.safeParse({ ...validCreate, order: 3 }).success).toBe(false);
  });
});

describe('eventUpdateSchema', () => {
  it('accepte un objet partiel (un seul champ)', () => {
    expect(eventUpdateSchema.safeParse({ title: 'Nouveau titre' }).success).toBe(true);
  });

  it('n’injecte pas de valeur par défaut sur les champs absents', () => {
    // Régression : optionalText porte un .default('') qui, via .partial(),
    // écrasait description et alt par '' à chaque mise à jour partielle.
    const parsed = eventUpdateSchema.parse({ title: 'X' });
    expect(parsed).toEqual({ title: 'X' });
    expect(parsed).not.toHaveProperty('description');
    expect(parsed).not.toHaveProperty('alt');
  });

  it('valide les champs présents avec les mêmes règles que la création', () => {
    expect(eventUpdateSchema.safeParse({ event_date: '12/10/2026' }).success).toBe(false);
    expect(eventUpdateSchema.safeParse({ market: 'TG' }).success).toBe(false);
  });

  it('accepte un objet vide (le routeur refuse de son côté)', () => {
    expect(eventUpdateSchema.safeParse({}).success).toBe(true);
  });
});
