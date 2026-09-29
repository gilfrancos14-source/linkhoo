import { describe, expect, it } from 'vitest';
import {
  dateStringSchema,
  emailSchema,
  idParamsSchema,
  idSchema,
  marketQuerySchema,
  marketSchema,
  optionalText,
} from './common';

describe('marketSchema', () => {
  it('n’accepte que CI et BJ', () => {
    expect(marketSchema.safeParse('CI').success).toBe(true);
    expect(marketSchema.safeParse('BJ').success).toBe(true);
    expect(marketSchema.safeParse('TG').success).toBe(false);
    expect(marketSchema.safeParse('ci').success).toBe(false);
    expect(marketSchema.safeParse('').success).toBe(false);
  });

  it('refuse les valeurs non chaînes', () => {
    expect(marketSchema.safeParse(42).success).toBe(false);
    expect(marketSchema.safeParse(null).success).toBe(false);
    expect(marketSchema.safeParse(undefined).success).toBe(false);
  });

  it('détaille le code d’erreur', () => {
    const parsed = marketSchema.safeParse('TG');
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.code).toBe('invalid_value');
  });
});

describe('idSchema', () => {
  it('accepte un identifiant standard', () => {
    const parsed = idSchema.safeParse('room-1');
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toBe('room-1');
  });

  it('retire les espaces autour', () => {
    const parsed = idSchema.safeParse('  abc-123  ');
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toBe('abc-123');
  });

  it('refuse une chaîne vide ou composée d’espaces', () => {
    expect(idSchema.safeParse('').success).toBe(false);
    expect(idSchema.safeParse('   ').success).toBe(false);
  });

  it('accepte jusqu’à 200 caractères et refuse 201', () => {
    expect(idSchema.safeParse('a'.repeat(200)).success).toBe(true);
    expect(idSchema.safeParse('a'.repeat(201)).success).toBe(false);
  });

  it('refuse les valeurs non chaînes', () => {
    expect(idSchema.safeParse(1).success).toBe(false);
    expect(idSchema.safeParse(null).success).toBe(false);
    expect(idSchema.safeParse(undefined).success).toBe(false);
  });

  it('accepte un UUID et des caractères Unicode', () => {
    expect(idSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(true);
    expect(idSchema.safeParse('chambre_été').success).toBe(true);
  });
});

describe('emailSchema', () => {
  it('accepte un email valide et le passe en minuscules', () => {
    const parsed = emailSchema.safeParse('Jean@Example.ci');
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toBe('jean@example.ci');
  });

  it('retire les espaces avant/après', () => {
    const parsed = emailSchema.safeParse('  lecteur@exemple.ci  ');
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toBe('lecteur@exemple.ci');
  });

  it('accepte la casse déjà minuscule sans modification', () => {
    const parsed = emailSchema.safeParse('lecteur@exemple.ci');
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toBe('lecteur@exemple.ci');
  });

  it('refuse un email invalide', () => {
    for (const value of ['pas-un-email', 'lecteur@', '@exemple.ci', 'a b@exemple.ci', '']) {
      expect(emailSchema.safeParse(value).success).toBe(false);
    }
  });

  it('accepte 255 caractères et refuse 256', () => {
    expect(emailSchema.safeParse(`${'x'.repeat(250)}@e.ci`).success).toBe(true);
    expect(emailSchema.safeParse(`${'x'.repeat(251)}@e.ci`).success).toBe(false);
  });

  it('refuse les valeurs non chaînes', () => {
    expect(emailSchema.safeParse(42).success).toBe(false);
    expect(emailSchema.safeParse(null).success).toBe(false);
  });
});

describe('dateStringSchema', () => {
  it('accepte une date ISO AAAA-MM-JJ', () => {
    const parsed = dateStringSchema.safeParse('2026-05-01');
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toBe('2026-05-01');
  });

  it('accepte une date bissextile', () => {
    expect(dateStringSchema.safeParse('2028-02-29').success).toBe(true);
  });

  it('refuse un format autre que AAAA-MM-JJ', () => {
    for (const value of ['01-05-2026', '2026/05/01', '2026-05-01T00:00:00Z', '1er mai 2026', '']) {
      expect(dateStringSchema.safeParse(value).success).toBe(false);
    }
  });

  it('refuse un mois invalide avec le message « Date invalide »', () => {
    const parsed = dateStringSchema.safeParse('2026-13-01');
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toBe('Date invalide');
  });

  it('refuse un jour invalide', () => {
    expect(dateStringSchema.safeParse('2026-00-10').success).toBe(false);
    expect(dateStringSchema.safeParse('2026-05-00').success).toBe(false);
  });

  it('refuse un jour qui n’existe pas dans le mois (roulage silencieux de Date.parse)', () => {
    // Date.parse('2026-02-30') renvoie le 2 mars : la validation calendrier
    // doit comparer année/mois/jour reconstruits.
    for (const value of ['2026-02-30', '2026-04-31', '2027-02-29', '2026-06-31']) {
      const parsed = dateStringSchema.safeParse(value);
      expect(parsed.success).toBe(false);
      if (parsed.success) continue;
      expect(parsed.error.issues[0]?.message).toBe('Date invalide');
    }
  });

  it('accepte le dernier jour de chaque mois, y compris 29 février d’une année bissextile', () => {
    for (const value of ['2026-01-31', '2026-02-28', '2026-04-30', '2028-02-29', '2026-12-31']) {
      expect(dateStringSchema.safeParse(value).success).toBe(true);
    }
  });

  it('refuse les valeurs non chaînes', () => {
    expect(dateStringSchema.safeParse(20_260_501).success).toBe(false);
    expect(dateStringSchema.safeParse(null).success).toBe(false);
  });
});

describe('optionalText', () => {
  it('valeur manquante → chaîne vide par défaut', () => {
    const parsed = optionalText(10).safeParse(undefined);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toBe('');
  });

  it('retire les espaces superflus', () => {
    const parsed = optionalText(10).safeParse('  bonjour  ');
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toBe('bonjour');
  });

  it('accepte une chaîne vide', () => {
    expect(optionalText(10).safeParse('').success).toBe(true);
  });

  it('respecte la longueur maximale (exactement max → ok, max+1 → refus)', () => {
    expect(optionalText(5).safeParse('abcde').success).toBe(true);
    expect(optionalText(5).safeParse('abcdef').success).toBe(false);
  });

  it('refuse les valeurs non chaînes', () => {
    expect(optionalText(10).safeParse(42).success).toBe(false);
    expect(optionalText(10).safeParse(null).success).toBe(false);
  });
});

describe('marketQuerySchema', () => {
  it('accepte une requête vide', () => {
    const parsed = marketQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it('accepte un marché valide et le conserve', () => {
    const parsed = marketQuerySchema.safeParse({ market: 'BJ' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.market).toBe('BJ');
  });

  it('refuse un marché invalide', () => {
    const parsed = marketQuerySchema.safeParse({ market: 'TG' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['market']);
  });

  it('ignore les paramètres inconnus (objet non strict, usage query Express)', () => {
    const parsed = marketQuerySchema.safeParse({ market: 'CI', page: '2' });
    expect(parsed.success).toBe(true);
  });
});

describe('idParamsSchema', () => {
  it('accepte un paramètre id valide', () => {
    const parsed = idParamsSchema.safeParse({ id: 'room-1' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.id).toBe('room-1');
  });

  it('exige le paramètre id', () => {
    const parsed = idParamsSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['id']);
  });

  it('refuse un id vide ou composé d’espaces', () => {
    expect(idParamsSchema.safeParse({ id: '' }).success).toBe(false);
    expect(idParamsSchema.safeParse({ id: '   ' }).success).toBe(false);
  });

  it('refuse un id trop long', () => {
    expect(idParamsSchema.safeParse({ id: 'a'.repeat(201) }).success).toBe(false);
  });

  it('ignore les paramètres inconnus (non strict)', () => {
    expect(idParamsSchema.safeParse({ id: 'x', locale: 'fr' }).success).toBe(true);
  });
});
