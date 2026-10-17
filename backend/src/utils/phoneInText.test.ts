import { describe, expect, it } from 'vitest';
import {
  containsPhoneNumber,
  detectOffPlatformContact,
  normalize,
  stripPhoneFromText,
} from './phoneInText';

describe('containsPhoneNumber — numéros directs', () => {
  it('détecte un numéro local séparé par des espaces (10 chiffres)', () => {
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

  it('détecte toute la bande 10-12 chiffres sans contexte', () => {
    expect(containsPhoneNumber('0707070707')).toBe(true); // 10
    expect(containsPhoneNumber('07070707070')).toBe(true); // 11
    expect(containsPhoneNumber('070707070707')).toBe(true); // 12
  });

  it('signale 8-9 chiffres seulement avec un indice téléphone', () => {
    expect(containsPhoneNumber('070707070')).toBe(false); // 9, sans indice
    expect(containsPhoneNumber('appelez le 070707070')).toBe(true); // 9 + mot-clé
    expect(containsPhoneNumber('10 000 000 FCFA')).toBe(false); // prix 8 chiffres
  });

  it('ne signale pas les identifiants longs hors bande', () => {
    expect(containsPhoneNumber('référence 1234567890123')).toBe(false); // 13 sans préfixe
  });
});

describe('containsPhoneNumber — heuristiques', () => {
  it('détecte un numéro écrit en toutes lettres (10 chiffres)', () => {
    expect(
      containsPhoneNumber('zero sept zero sept zero sept zero sept zero sept'),
    ).toBe(true);
  });

  it("ne transforme pas une courte suite de nombres en numéro", () => {
    expect(containsPhoneNumber('il a dit zero sept')).toBe(false);
  });

  it('détecte les lettres utilisées comme chiffres (leet)', () => {
    expect(containsPhoneNumber('O7O7O7O7O7')).toBe(true);
  });

  it('ne se laisse pas piéger par des mots en lettres-chiffres', () => {
    expect(containsPhoneNumber('salut les amis')).toBe(false);
    expect(containsPhoneNumber('tasteless assets')).toBe(false);
  });

  it('normalise Unicode, invisibles et accents', () => {
    expect(containsPhoneNumber('０７０７０７０７０７')).toBe(true); // fullwidth
    expect(containsPhoneNumber('٠٧٠٧٠٧٠٧٠٧')).toBe(true); // arabo-indien
    expect(containsPhoneNumber('07\u200B07\u200B07\u200B07\u200B07')).toBe(true); // invisibles
  });
});

describe('containsPhoneNumber — mots-clés et canaux', () => {
  it('détecte les mots-clés de contournement sans numéro', () => {
    expect(containsPhoneNumber('Contact par WhatsApp uniquement')).toBe(true);
    expect(containsPhoneNumber('Appelez-nous pour visiter')).toBe(true);
    expect(containsPhoneNumber('Téléphone : sur demande')).toBe(true);
  });

  it('détecte email, URL et pseudo', () => {
    expect(containsPhoneNumber('Écrivez à jean.marc@exemple.ci')).toBe(true);
    expect(containsPhoneNumber('Visitez notre site www.exemple.com')).toBe(true);
    expect(containsPhoneNumber('Écrivez-moi sur wa.me/2250707070707')).toBe(true);
    expect(containsPhoneNumber('Suivez @monagence')).toBe(true);
  });
});

describe('containsPhoneNumber — anti-faux-positifs', () => {
  it('accepte une description sans coordonnée', () => {
    expect(
      containsPhoneNumber('Un studio confortable au cœur de Cocody, proche des universités.'),
    ).toBe(false);
    expect(
      containsPhoneNumber('Loyer 150 000 FCFA, caution 1 mois, séjour minimum 30 jours.'),
    ).toBe(false);
  });

  it('ignore les dates, les années, les surfaces et les pourcentages', () => {
    expect(containsPhoneNumber('Disponible à partir du 12-03-2026.')).toBe(false);
    expect(containsPhoneNumber('Libre le 12.03.26, rénové en 2024.')).toBe(false);
    expect(containsPhoneNumber('Surface 85 m², 3 chambres, 2 douches, 10 % de remise.')).toBe(
      false,
    );
  });
});

describe('detectOffPlatformContact — raisons', () => {
  it('attribue la bonne raison', () => {
    expect(detectOffPlatformContact('07 07 07 07 07').reasons).toContain('digits');
    expect(
      detectOffPlatformContact('zero sept zero sept zero sept zero sept zero sept').reasons,
    ).toContain('number_words');
    expect(detectOffPlatformContact('O7O7O7O7O7').reasons).toContain('leet');
    expect(detectOffPlatformContact('Contact par WhatsApp').reasons).toContain('keyword');
    expect(detectOffPlatformContact('jean@exemple.ci').reasons).toContain('email');
    expect(detectOffPlatformContact('www.exemple.com').reasons).toContain('url');
    expect(detectOffPlatformContact('Suivez @monagence').reasons).toContain('handle');
  });

  it('renvoie un résultat vide pour un texte propre', () => {
    expect(detectOffPlatformContact('Un studio agréable à Cocody.')).toEqual({
      hasContact: false,
      reasons: [],
      matches: [],
    });
  });
});

describe('normalize', () => {
  it('replie chiffres, accents et invisibles', () => {
    expect(normalize('Téléphone ０7\u200B')).toBe('telephone 07');
  });
});

describe('stabilité et idempotence', () => {
  it("n'est pas affecté par un appel répété", () => {
    const withPhone = 'Numéro 0707070707';
    const without = 'Un studio agréable';
    expect(containsPhoneNumber(withPhone)).toBe(true);
    expect(containsPhoneNumber(without)).toBe(false);
    expect(containsPhoneNumber(withPhone)).toBe(true);
  });

  it('après nettoyage, plus aucune coordonnée détectée', () => {
    const samples = [
      'Contactez le 07 07 07 07 07',
      '+225 07 07 07 07 07',
      'Joindre 002250707070707',
      'Tapez 0707070707 dans WhatsApp',
      'Appeler (01) 23 45 67 89',
      'jean@exemple.ci',
      'www.exemple.com',
      'Suivez @monagence',
      'Contact par WhatsApp uniquement',
    ];
    for (const sample of samples) {
      const { text } = stripPhoneFromText(sample);
      expect(containsPhoneNumber(text)).toBe(false);
    }
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

  it('retire email, URL et pseudo', () => {
    expect(stripPhoneFromText('Écrire à jean@exemple.ci').text).toBe('Écrire à');
    expect(stripPhoneFromText('Site www.exemple.com').text).toBe('Site');
    expect(stripPhoneFromText('Suivez @monagence').text).toBe('Suivez');
  });

  it('signale un texte inchangé', () => {
    expect(stripPhoneFromText('Un studio confortable.')).toEqual({
      text: 'Un studio confortable.',
      changed: false,
    });
  });
});
