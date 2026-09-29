import { describe, expect, it } from 'vitest';
import { bootstrapSchema, roleSchema } from './auth';

describe('roleSchema', () => {
  it('accepte les deux rôles métier', () => {
    expect(roleSchema.safeParse('client').success).toBe(true);
    expect(roleSchema.safeParse('gerant').success).toBe(true);
  });

  it('refuse tout autre rôle', () => {
    for (const value of ['admin', 'Client', 'GERANT', 'gérant', 'superadmin', '', ' ']) {
      expect(roleSchema.safeParse(value).success).toBe(false);
    }
  });

  it('refuse les valeurs non chaînes', () => {
    expect(roleSchema.safeParse(42).success).toBe(false);
    expect(roleSchema.safeParse(null).success).toBe(false);
    expect(roleSchema.safeParse(undefined).success).toBe(false);
    expect(roleSchema.safeParse(['client']).success).toBe(false);
    expect(roleSchema.safeParse({ role: 'client' }).success).toBe(false);
  });

  it('détaille le code d’erreur de l’énumération', () => {
    const parsed = roleSchema.safeParse('admin');
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.code).toBe('invalid_value');
    expect(parsed.error.issues[0]?.path).toEqual([]);
  });

  it('n’accepte pas la casse mixte', () => {
    expect(roleSchema.safeParse('cLienT').success).toBe(false);
  });
});

describe('bootstrapSchema', () => {
  it('accepte un bootstrap client sans marché', () => {
    const parsed = bootstrapSchema.safeParse({ role: 'client' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ role: 'client' });
  });

  it('accepte un bootstrap client avec marché (marché ignoré par la route mais valide)', () => {
    const parsed = bootstrapSchema.safeParse({ role: 'client', market: 'BJ' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.market).toBe('BJ');
  });

  it('accepte un bootstrap gérant avec marché', () => {
    const parsed = bootstrapSchema.safeParse({ role: 'gerant', market: 'CI' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ role: 'gerant', market: 'CI' });
  });

  it('accepte un bootstrap gérant sans marché (contrainte portée par la route)', () => {
    expect(bootstrapSchema.safeParse({ role: 'gerant' }).success).toBe(true);
  });

  it('exige le champ role', () => {
    const parsed = bootstrapSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['role']);
  });

  it('refuse un rôle invalide avec le path du champ', () => {
    const parsed = bootstrapSchema.safeParse({ role: 'admin' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['role']);
  });

  it('refuse un marché hors CI/BJ', () => {
    const parsed = bootstrapSchema.safeParse({ role: 'gerant', market: 'TG' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['market']);
  });

  it('refuse un marché non chaîne', () => {
    expect(bootstrapSchema.safeParse({ role: 'gerant', market: 42 }).success).toBe(false);
    expect(bootstrapSchema.safeParse({ role: 'gerant', market: 'ci' }).success).toBe(false);
  });

  it('refuse un corps null ou non objet', () => {
    expect(bootstrapSchema.safeParse(null).success).toBe(false);
    expect(bootstrapSchema.safeParse('client').success).toBe(false);
    expect(bootstrapSchema.safeParse(['client']).success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = bootstrapSchema.safeParse({ role: 'client', nom: 'Koffi' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });

  describe('format de la réponse d’erreur (details = error.flatten(), utilisé par POST /api/auth/bootstrap)', () => {
    it('place le rôle invalide dans fieldErrors.role', () => {
      const parsed = bootstrapSchema.safeParse({ role: 'admin' });
      expect(parsed.success).toBe(false);
      if (parsed.success) return;
      const flat = parsed.error.flatten();
      expect(flat.formErrors).toEqual([]);
      expect(Array.isArray(flat.fieldErrors.role)).toBe(true);
      expect(flat.fieldErrors.role?.length).toBeGreaterThan(0);
    });

    it('place le marché invalide dans fieldErrors.market', () => {
      const parsed = bootstrapSchema.safeParse({ role: 'gerant', market: 'TG' });
      expect(parsed.success).toBe(false);
      if (parsed.success) return;
      const flat = parsed.error.flatten();
      expect(flat.fieldErrors.market?.[0]).toContain('CI');
    });

    it('place la clé inconnue dans formErrors', () => {
      const parsed = bootstrapSchema.safeParse({ role: 'client', extraneous: true });
      expect(parsed.success).toBe(false);
      if (parsed.success) return;
      const flat = parsed.error.flatten();
      expect(flat.formErrors.join(' ')).toContain('extraneous');
    });

    it('signale un corps non objet dans formErrors', () => {
      const parsed = bootstrapSchema.safeParse(null);
      expect(parsed.success).toBe(false);
      if (parsed.success) return;
      expect(parsed.error.flatten().formErrors.length).toBeGreaterThan(0);
    });
  });
});
