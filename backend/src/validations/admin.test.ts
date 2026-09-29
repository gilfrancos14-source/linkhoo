import { describe, expect, it } from 'vitest';
import { adminLoginSchema, adminChangePasswordSchema } from './admin';

describe('adminLoginSchema', () => {
  it('accepte un email et un mot de passe valides', () => {
    const parsed = adminLoginSchema.safeParse({
      email: 'admin@test.ci',
      password: 'Admin123!',
    });
    expect(parsed.success).toBe(true);
  });

  it('refuse un email sans domaine', () => {
    const parsed = adminLoginSchema.safeParse({ email: 'admin@', password: 'Admin123!' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un mot de passe vide', () => {
    const parsed = adminLoginSchema.safeParse({ email: 'admin@test.ci', password: '' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un mot de passe trop long', () => {
    const parsed = adminLoginSchema.safeParse({
      email: 'admin@test.ci',
      password: 'x'.repeat(201),
    });
    expect(parsed.success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = adminLoginSchema.safeParse({
      email: 'admin@test.ci',
      password: 'Admin123!',
      remember: true,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('adminChangePasswordSchema', () => {
  const validBody = { currentPassword: 'Ancien123', newPassword: 'Nouveau123' };

  it('accepte un changement conforme', () => {
    const parsed = adminChangePasswordSchema.safeParse(validBody);
    expect(parsed.success).toBe(true);
  });

  it('exige le mot de passe actuel', () => {
    const parsed = adminChangePasswordSchema.safeParse({ newPassword: 'Nouveau123' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un nouveau mot de passe trop court', () => {
    const parsed = adminChangePasswordSchema.safeParse({ ...validBody, newPassword: 'abc' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['newPassword']);
  });

  it('refuse un nouveau mot de passe trop long', () => {
    const parsed = adminChangePasswordSchema.safeParse({
      ...validBody,
      newPassword: 'x'.repeat(201),
    });
    expect(parsed.success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = adminChangePasswordSchema.safeParse({ ...validBody, force: true });
    expect(parsed.success).toBe(false);
  });
});
