import { describe, expect, it } from 'vitest';
import { containsPhoneNumber, stripPhoneFromText } from './phoneInText';

describe('containsPhoneNumber', () => {
  it('détecte un numéro local séparé par des espaces', () => {
    expect(containsPhoneNumber('Contactez le 07 07 07 07 07 pour plus de détails')).toBe(true);
  });

  it("détecte un numéro avec l'indicatif international", () => {
    expect(containsPhoneNumber('Écrire à +225 07 07 07 07 07')).toBe(true);
    expect(containsPhoneNumber('Joindre 002250707070707')).toBe(true);
  });

  it('détecte un numéro collé sans séparateur', () => {
    expect(containsPhoneNumber('Tapez 0707070707 dans WhatsApp')).toBe(true);
  });

  it('détecte un numéro avec parenthèses', () => {
    expect(containsPhoneNumber('Appeler (01) 23 45 67 89')).toBe(true);
  });

  it('détecte les mots-clés de contournement sans numéro', () => {
    expect(containsPhoneNumber('Contact par WhatsApp uniquement')).toBe(true);
    expect(containsPhoneNumber('Appelez-nous pour visiter')).toBe(true);
    expect(containsPhoneNumber('Téléphone : sur demande')).toBe(true);
  });

  it('accepte une description sans coordonnée', () => {
    expect(containsPhoneNumber('Un studio confortable au cœur de Cocody, proche des universités.')).toBe(false);
    expect(containsPhoneNumber('Loyer 150 000 FCFA, caution 1 mois, séjour minimum 30 jours.')).toBe(false);
  });

  it('ignore les dates et les années', () => {
    expect(containsPhoneNumber('Disponible à partir du 12-03-2026.')).toBe(false);
    expect(containsPhoneNumber('Libre le 12.03.26, rénové en 2024.')).toBe(false);
  });

  it('n’est pas affecté par un appel répété (flag global)', () => {
    const withPhone = 'Numéro 0707070707';
    const without = 'Un studio agréable';
    expect(containsPhoneNumber(withPhone)).toBe(true);
    expect(containsPhoneNumber(without)).toBe(false);
    expect(containsPhoneNumber(withPhone)).toBe(true);
  });
});

describe('stripPhoneFromText', () => {
  it('retire le numéro et les mots-clés', () => {
    expect(stripPhoneFromText('Appartement neuf. Appelez le 07 07 07 07 07.')).toEqual({
      text: 'Appartement neuf. le .',
      changed: true,
    });
    expect(stripPhoneFromText('Appartement neuf. WhatsApp : 0707070707')).toEqual({
      text: 'Appartement neuf. :',
      changed: true,
    });
  });

  it('signale un texte inchangé', () => {
    expect(stripPhoneFromText('Un studio confortable.')).toEqual({
      text: 'Un studio confortable.',
      changed: false,
    });
  });
});
