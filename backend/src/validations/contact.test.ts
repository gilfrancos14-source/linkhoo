import { describe, expect, it } from 'vitest';
import { contactMessageSchema, PAYS_CONTACT, SUJETS_CONTACT } from './contact';

const valide = {
  nom: 'Diop',
  prenom: 'Awa',
  email: 'awa@exemple.ci',
  telephone: '+221 77 123 45 67',
  pays: 'Sénégal',
  sujet: 'reservation',
  message: 'Bonjour, je souhaite réserver une chambre.',
  market: 'CI',
};

describe('contactMessageSchema', () => {
  it('accepte un message complet', () => {
    const parsed = contactMessageSchema.safeParse(valide);
    expect(parsed.success).toBe(true);
  });

  it('accepte les champs optionnels absents', () => {
    const { prenom: _prenom, telephone: _tel, market: _market, ...minimal } = valide;
    const parsed = contactMessageSchema.safeParse(minimal);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.prenom).toBe('');
      expect(parsed.data.telephone).toBe('');
      expect(parsed.data.website).toBe('');
    }
  });

  it('normalise l\u2019email et les espaces', () => {
    const parsed = contactMessageSchema.safeParse({ ...valide, email: '  AWA@Exemple.ci ' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('awa@exemple.ci');
  });

  it('rejette un email invalide ou un champ vide', () => {
    expect(contactMessageSchema.safeParse({ ...valide, email: 'pas-un-email' }).success).toBe(false);
    expect(contactMessageSchema.safeParse({ ...valide, nom: '   ' }).success).toBe(false);
    expect(contactMessageSchema.safeParse({ ...valide, nom: '' }).success).toBe(false);
  });

  it('rejette un pays hors de la liste de référence', () => {
    expect(contactMessageSchema.safeParse({ ...valide, pays: 'France' }).success).toBe(false);
    expect(PAYS_CONTACT).toHaveLength(12);
    expect(PAYS_CONTACT).toContain('Cameroun');
    expect(PAYS_CONTACT).not.toContain('Caméroun');
  });

  it('rejette un sujet hors de la liste', () => {
    expect(contactMessageSchema.safeParse({ ...valide, sujet: 'publicite' }).success).toBe(false);
    expect(SUJETS_CONTACT).toEqual([
      'reservation',
      'compte-gerant',
      'partenariat',
      'presse',
      'autre',
    ]);
  });

  it('respecte la longueur du message (10 à 2000 caractères)', () => {
    expect(contactMessageSchema.safeParse({ ...valide, message: 'Court' }).success).toBe(false);
    expect(contactMessageSchema.safeParse({ ...valide, message: 'a'.repeat(10) }).success).toBe(true);
    expect(contactMessageSchema.safeParse({ ...valide, message: 'a'.repeat(2000) }).success).toBe(true);
    expect(contactMessageSchema.safeParse({ ...valide, message: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('rejette un numéro de téléphone mal formé', () => {
    expect(contactMessageSchema.safeParse({ ...valide, telephone: 'abc' }).success).toBe(false);
    expect(contactMessageSchema.safeParse({ ...valide, telephone: '07 11 22 33' }).success).toBe(true);
  });

  it('rejette un champ inconnu (strict)', () => {
    expect(contactMessageSchema.safeParse({ ...valide, source: 'pied-de-page' }).success).toBe(false);
  });

  it('rejette un marché hors CI/BJ', () => {
    expect(contactMessageSchema.safeParse({ ...valide, market: 'TG' }).success).toBe(false);
  });
});
