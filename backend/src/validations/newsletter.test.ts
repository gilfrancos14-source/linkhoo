import { describe, expect, it } from 'vitest';
import { newsletterSubscribeSchema } from './newsletter';

describe('newsletterSubscribeSchema', () => {
  it('accepte une inscription avec marché', () => {
    const parsed = newsletterSubscribeSchema.safeParse({
      email: 'lecteur@exemple.ci',
      market: 'CI',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ email: 'lecteur@exemple.ci', market: 'CI' });
  });

  it('accepte une inscription sans marché', () => {
    const parsed = newsletterSubscribeSchema.safeParse({ email: 'lecteur@exemple.ci' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ email: 'lecteur@exemple.ci' });
  });

  it('normalise l’email (espaces retirés, minuscules)', () => {
    const parsed = newsletterSubscribeSchema.safeParse({ email: '  LECTEUR@Exemple.ci ' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.email).toBe('lecteur@exemple.ci');
  });

  it('exige un email', () => {
    expect(newsletterSubscribeSchema.safeParse({}).success).toBe(false);
    expect(newsletterSubscribeSchema.safeParse({ email: undefined }).success).toBe(false);
    expect(newsletterSubscribeSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('refuse un email invalide', () => {
    expect(newsletterSubscribeSchema.safeParse({ email: 'pas-un-email' }).success).toBe(false);
    expect(newsletterSubscribeSchema.safeParse({ email: 'lecteur@' }).success).toBe(false);
    expect(newsletterSubscribeSchema.safeParse({ email: 'x'.repeat(251) + '@e.ci' }).success).toBe(false);
  });

  it('détaille l’erreur sur l’email invalide', () => {
    const parsed = newsletterSubscribeSchema.safeParse({ email: 'pas-un-email' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path.includes('email'))).toBe(true);
  });

  it('n’accepte que CI et BJ comme marché', () => {
    expect(newsletterSubscribeSchema.safeParse({ email: 'a@b.ci', market: 'CI' }).success).toBe(true);
    expect(newsletterSubscribeSchema.safeParse({ email: 'a@b.ci', market: 'BJ' }).success).toBe(true);
    expect(newsletterSubscribeSchema.safeParse({ email: 'a@b.ci', market: 'XX' }).success).toBe(false);
    expect(newsletterSubscribeSchema.safeParse({ email: 'a@b.ci', market: 'ci' }).success).toBe(false);
    expect(newsletterSubscribeSchema.safeParse({ email: 'a@b.ci', market: 42 }).success).toBe(false);
  });

  it('refuse tout champ inconnu (strict)', () => {
    expect(
      newsletterSubscribeSchema.safeParse({ email: 'a@b.ci', source: 'footer' }).success,
    ).toBe(false);
    expect(newsletterSubscribeSchema.safeParse({ email: 'a@b.ci', nom: 'Koffi' }).success).toBe(false);
  });

  it('détaille les champs rejetés (strict)', () => {
    const parsed = newsletterSubscribeSchema.safeParse({ email: 'a@b.ci', source: 'footer' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });
});
