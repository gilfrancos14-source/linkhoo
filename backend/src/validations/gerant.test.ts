import { describe, expect, it } from 'vitest';
import {
  gerantCreateSchema,
  gerantUpdateSchema,
  verificationDocumentTypeSchema,
  propertyAddressSchema,
  verificationReviewSchema,
  verificationRejectSchema,
} from './gerant';

describe('gerantCreateSchema', () => {
  const validGerant = {
    clerk_user_id: 'user_1',
    email: 'gerant@example.ci',
    nom: 'Kouassi',
    prenom: 'Aya',
    market: 'CI' as const,
  };

  it('accepte un profil complet', () => {
    const parsed = gerantCreateSchema.safeParse(validGerant);
    expect(parsed.success).toBe(true);
  });

  it('applique les nom et prénom vides par défaut', () => {
    const parsed = gerantCreateSchema.safeParse({
      clerk_user_id: 'user_1',
      email: 'gerant@example.ci',
      market: 'BJ',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.nom).toBe('');
    expect(parsed.data.prenom).toBe('');
  });

  it('normalise lemail en minuscules', () => {
    const parsed = gerantCreateSchema.safeParse({ ...validGerant, email: 'Gerant@Example.ci' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.email).toBe('gerant@example.ci');
  });

  it('refuse un identifiant Clerk vide', () => {
    const parsed = gerantCreateSchema.safeParse({ ...validGerant, clerk_user_id: '   ' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un email invalide ou un marché inconnu', () => {
    expect(gerantCreateSchema.safeParse({ ...validGerant, email: 'pas-un-mail' }).success).toBe(false);
    expect(gerantCreateSchema.safeParse({ ...validGerant, market: 'TG' }).success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = gerantCreateSchema.safeParse({ ...validGerant, is_verified: true });
    expect(parsed.success).toBe(false);
  });
});

describe('gerantUpdateSchema', () => {
  it('accepte une mise à jour partielle', () => {
    const parsed = gerantUpdateSchema.safeParse({ nom: 'Nouveau', phone: '+2250700000000' });
    expect(parsed.success).toBe(true);
  });

  it('accepte un objet vide (tous les champs sont facultatifs)', () => {
    const parsed = gerantUpdateSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(Object.keys(parsed.data)).toHaveLength(0);
  });

  it('refuse un téléphone trop long', () => {
    const parsed = gerantUpdateSchema.safeParse({ phone: '0'.repeat(21) });
    expect(parsed.success).toBe(false);
  });

  it('refuse un marché inconnu', () => {
    const parsed = gerantUpdateSchema.safeParse({ market: 'TG' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un champ sensible inconnu (strict)', () => {
    const parsed = gerantUpdateSchema.safeParse({ is_verified: true });
    expect(parsed.success).toBe(false);
  });
});

describe('verificationDocumentTypeSchema', () => {
  it('accepte les quatre types de document', () => {
    for (const type of ['national_id', 'selfie', 'id_card_front', 'id_card_back']) {
      expect(verificationDocumentTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it('refuse un type inconnu', () => {
    expect(verificationDocumentTypeSchema.safeParse('passeport').success).toBe(false);
  });
});

describe('propertyAddressSchema', () => {
  it('accepte une simple URL Google Maps', () => {
    const parsed = propertyAddressSchema.safeParse({
      maps_url: 'https://www.google.com/maps/place/Test/@5.3,4.0,17z',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepte une URL accompagnée de coordonnées complètes', () => {
    const parsed = propertyAddressSchema.safeParse({
      maps_url: 'https://www.google.com/maps/place/Test/@5.3,4.0,17z',
      lat: 5.3,
      lng: 4.0,
    });
    expect(parsed.success).toBe(true);
  });

  it('refuse lat sans lng (et inversement)', () => {
    const latSeul = propertyAddressSchema.safeParse({
      maps_url: 'https://www.google.com/maps/place/Test/@5.3,4.0,17z',
      lat: 5.3,
    });
    expect(latSeul.success).toBe(false);
    if (latSeul.success) return;
    expect(latSeul.error.issues[0]?.message).toContain('ensemble');

    const lngSeul = propertyAddressSchema.safeParse({
      maps_url: 'https://www.google.com/maps/place/Test/@5.3,4.0,17z',
      lng: 4.0,
    });
    expect(lngSeul.success).toBe(false);
  });

  it('refuse des coordonnées hors échelle', () => {
    expect(
      propertyAddressSchema.safeParse({ maps_url: 'x', lat: 91, lng: 0 }).success,
    ).toBe(false);
    expect(
      propertyAddressSchema.safeParse({ maps_url: 'x', lat: 0, lng: 181 }).success,
    ).toBe(false);
  });

  it('refuse une URL vide ou un champ inconnu', () => {
    expect(propertyAddressSchema.safeParse({ maps_url: '   ' }).success).toBe(false);
    expect(
      propertyAddressSchema.safeParse({ maps_url: 'https://maps.example', ville: 'Abidjan' }).success,
    ).toBe(false);
  });
});

describe('verificationReviewSchema', () => {
  it('accepte les deux décisions', () => {
    expect(verificationReviewSchema.safeParse({ status: 'approved' }).success).toBe(true);
    expect(
      verificationReviewSchema.safeParse({ status: 'rejected', rejection_reason: 'Photo floue' }).success,
    ).toBe(true);
  });

  it('refuse un statut inconnu', () => {
    expect(verificationReviewSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('refuse un motif de rejet trop long', () => {
    const parsed = verificationReviewSchema.safeParse({
      status: 'rejected',
      rejection_reason: 'x'.repeat(501),
    });
    expect(parsed.success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = verificationReviewSchema.safeParse({ status: 'approved', reviewed_by: 'admin' });
    expect(parsed.success).toBe(false);
  });
});

describe('verificationRejectSchema', () => {
  it('accepte un motif non vide', () => {
    const parsed = verificationRejectSchema.safeParse({ rejection_reason: 'Pièce illisible' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.rejection_reason).toBe('Pièce illisible');
  });

  it('refuse un motif vide ou constitué d’espaces', () => {
    expect(verificationRejectSchema.safeParse({ rejection_reason: '' }).success).toBe(false);
    expect(verificationRejectSchema.safeParse({ rejection_reason: '    ' }).success).toBe(false);
  });

  it('refuse un motif trop long ou absent', () => {
    expect(
      verificationRejectSchema.safeParse({ rejection_reason: 'x'.repeat(501) }).success,
    ).toBe(false);
    expect(verificationRejectSchema.safeParse({}).success).toBe(false);
  });
});
