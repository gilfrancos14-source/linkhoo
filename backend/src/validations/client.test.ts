import { describe, expect, it } from 'vitest';
import { clientCreateSchema, clientUpdateSchema } from './client';

const validClient = {
  clerk_user_id: 'user_1',
  email: 'client@exemple.ci',
  nom: 'Koffi',
  prenom: 'Aya',
  telephone: '+225 07 00 00 00',
};

describe('clientCreateSchema', () => {
  it('accepte un client complet', () => {
    expect(clientCreateSchema.safeParse(validClient).success).toBe(true);
  });

  it('applique les valeurs par défaut (nom, prénom, téléphone)', () => {
    const parsed = clientCreateSchema.safeParse({
      clerk_user_id: 'user_1',
      email: 'client@exemple.ci',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({
      clerk_user_id: 'user_1',
      email: 'client@exemple.ci',
      nom: '',
      prenom: '',
      telephone: '',
    });
  });

  it('normalise l’email (espaces retirés, minuscules)', () => {
    const parsed = clientCreateSchema.safeParse({ ...validClient, email: '  CLIENT@Exemple.ci ' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.email).toBe('client@exemple.ci');
  });

  it('exige un identifiant Clerk non vide', () => {
    expect(clientCreateSchema.safeParse({ ...validClient, clerk_user_id: undefined }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, clerk_user_id: '' }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, clerk_user_id: '   ' }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, clerk_user_id: 'x'.repeat(201) }).success).toBe(false);
  });

  it('refuse un email invalide ou absent', () => {
    expect(clientCreateSchema.safeParse({ ...validClient, email: undefined }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, email: 'pas-un-email' }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, email: 'a@b' }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, email: 'x'.repeat(251) + '@e.ci' }).success).toBe(false);
  });

  it('détaille l’erreur sur l’email invalide', () => {
    const parsed = clientCreateSchema.safeParse({ ...validClient, email: 'pas-un-email' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path.includes('email'))).toBe(true);
  });

  it('limite nom et prénom à 100 caractères', () => {
    expect(clientCreateSchema.safeParse({ ...validClient, nom: 'x'.repeat(100) }).success).toBe(true);
    expect(clientCreateSchema.safeParse({ ...validClient, nom: 'x'.repeat(101) }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, prenom: 'x'.repeat(101) }).success).toBe(false);
  });

  it('contrôle le format du téléphone', () => {
    expect(clientCreateSchema.safeParse({ ...validClient, telephone: '' }).success).toBe(true);
    expect(clientCreateSchema.safeParse({ ...validClient, telephone: '+2250700000000' }).success).toBe(true);
    expect(clientCreateSchema.safeParse({ ...validClient, telephone: '07 00 00 00' }).success).toBe(true);
    expect(clientCreateSchema.safeParse({ ...validClient, telephone: 'abc' }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, telephone: '07.00.00.00' }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, telephone: 'x'.repeat(31) }).success).toBe(false);
  });

  it('refuse tout champ inconnu (strict)', () => {
    expect(clientCreateSchema.safeParse({ ...validClient, role: 'admin' }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, id: 'c1' }).success).toBe(false);
    expect(clientCreateSchema.safeParse({ ...validClient, is_verified: true }).success).toBe(false);
  });

  it('détaille les champs rejetés (strict)', () => {
    const parsed = clientCreateSchema.safeParse({ ...validClient, role: 'admin' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });
});

describe('clientUpdateSchema', () => {
  it('accepte nom, prénom et téléphone', () => {
    expect(clientUpdateSchema.safeParse({ nom: 'Koffi' }).success).toBe(true);
    expect(clientUpdateSchema.safeParse({ prenom: 'Aya' }).success).toBe(true);
    expect(clientUpdateSchema.safeParse({ telephone: '+225 07 00 00 00' }).success).toBe(true);
    expect(clientUpdateSchema.safeParse({ nom: 'Koffi', prenom: 'Aya' }).success).toBe(true);
  });

  it('accepte un objet vide (le routeur refuse de son côté)', () => {
    expect(clientUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('n’injecte aucune valeur par défaut', () => {
    const parsed = clientUpdateSchema.parse({ nom: 'Koffi' });
    expect(parsed).toEqual({ nom: 'Koffi' });
    expect(parsed).not.toHaveProperty('prenom');
    expect(parsed).not.toHaveProperty('telephone');
  });

  it('refuse l’email et l’identifiant Clerk (strict)', () => {
    expect(clientUpdateSchema.safeParse({ email: 'nouveau@exemple.ci' }).success).toBe(false);
    expect(clientUpdateSchema.safeParse({ clerk_user_id: 'user_2' }).success).toBe(false);
    expect(clientUpdateSchema.safeParse({ nom: 'X', role: 'admin' }).success).toBe(false);
  });

  it('limite nom et prénom à 100 caractères', () => {
    expect(clientUpdateSchema.safeParse({ nom: 'x'.repeat(101) }).success).toBe(false);
    expect(clientUpdateSchema.safeParse({ prenom: 'x'.repeat(101) }).success).toBe(false);
  });

  it('contrôle uniquement la longueur du téléphone (pas de format)', () => {
    expect(clientUpdateSchema.safeParse({ telephone: 'abc' }).success).toBe(true);
    expect(clientUpdateSchema.safeParse({ telephone: '07.00.00.00' }).success).toBe(true);
    expect(clientUpdateSchema.safeParse({ telephone: 'x'.repeat(31) }).success).toBe(false);
    expect(clientUpdateSchema.safeParse({ telephone: 12345 }).success).toBe(false);
  });
});
