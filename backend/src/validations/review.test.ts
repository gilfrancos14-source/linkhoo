import { describe, expect, it } from 'vitest';
import { reviewCreateSchema, reviewRoomQuerySchema } from './review';

const validReview = {
  reservation_id: 'res-1',
  note_appartement: 5,
  note_gerant: 4,
  commentaire: 'Séjour très agréable.',
};

describe('reviewCreateSchema', () => {
  it('accepte un avis complet', () => {
    const parsed = reviewCreateSchema.safeParse(validReview);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual(validReview);
  });

  it('accepte les seuls champs requis avec commentaire par défaut', () => {
    const parsed = reviewCreateSchema.safeParse({
      reservation_id: 'res-1',
      note_appartement: 3,
      note_gerant: 3,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.commentaire).toBe('');
  });

  it('accepte les bornes 1 et 5 pour les deux notes', () => {
    expect(
      reviewCreateSchema.safeParse({ ...validReview, note_appartement: 1, note_gerant: 1 })
        .success,
    ).toBe(true);
    expect(
      reviewCreateSchema.safeParse({ ...validReview, note_appartement: 5, note_gerant: 5 })
        .success,
    ).toBe(true);
  });

  it('refuse une note hors bornes', () => {
    for (const note of [0, 6, -1]) {
      expect(
        reviewCreateSchema.safeParse({ ...validReview, note_appartement: note }).success,
      ).toBe(false);
      expect(reviewCreateSchema.safeParse({ ...validReview, note_gerant: note }).success).toBe(
        false,
      );
    }
  });

  it('refuse une note non entière', () => {
    const parsed = reviewCreateSchema.safeParse({ ...validReview, note_appartement: 4.5 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['note_appartement']);
  });

  it('refuse une note de type chaîne', () => {
    const parsed = reviewCreateSchema.safeParse({ ...validReview, note_gerant: '5' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['note_gerant']);
  });

  it('exige les deux notes', () => {
    const sansAppartement: Record<string, unknown> = { ...validReview };
    delete sansAppartement.note_appartement;
    expect(reviewCreateSchema.safeParse(sansAppartement).success).toBe(false);

    const sansGerant: Record<string, unknown> = { ...validReview };
    delete sansGerant.note_gerant;
    expect(reviewCreateSchema.safeParse(sansGerant).success).toBe(false);
  });

  it('exige une réservation identifiée', () => {
    const parsed = reviewCreateSchema.safeParse({ ...validReview, reservation_id: '' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['reservation_id']);

    const sansReservation: Record<string, unknown> = { ...validReview };
    delete sansReservation.reservation_id;
    expect(reviewCreateSchema.safeParse(sansReservation).success).toBe(false);
  });

  it('trimme le commentaire et le borne à 2000 caractères', () => {
    const parsed = reviewCreateSchema.safeParse({
      ...validReview,
      commentaire: '  Bien  ',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.commentaire).toBe('Bien');

    expect(
      reviewCreateSchema.safeParse({ ...validReview, commentaire: 'a'.repeat(2001) }).success,
    ).toBe(false);
    expect(
      reviewCreateSchema.safeParse({ ...validReview, commentaire: 'a'.repeat(2000) }).success,
    ).toBe(true);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = reviewCreateSchema.safeParse({ ...validReview, note: 5 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });

  it('refuse un corps non objet', () => {
    expect(reviewCreateSchema.safeParse(null).success).toBe(false);
    expect(reviewCreateSchema.safeParse('res-1').success).toBe(false);
  });

  it('détaille toutes les erreurs de notes (format details = error.flatten())', () => {
    const parsed = reviewCreateSchema.safeParse({
      ...validReview,
      note_appartement: 0,
      note_gerant: 9,
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const flat = parsed.error.flatten();
    expect(Object.keys(flat.fieldErrors).sort()).toEqual(['note_appartement', 'note_gerant']);
    expect(flat.formErrors).toEqual([]);
  });
});

describe('reviewRoomQuerySchema', () => {
  it('accepte une requête avec room_id', () => {
    const parsed = reviewRoomQuerySchema.safeParse({ room_id: 'room-1' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ room_id: 'room-1' });
  });

  it('exige room_id', () => {
    const parsed = reviewRoomQuerySchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['room_id']);
  });

  it('refuse un room_id vide ou composé d’espaces', () => {
    expect(reviewRoomQuerySchema.safeParse({ room_id: '' }).success).toBe(false);
    expect(reviewRoomQuerySchema.safeParse({ room_id: '   ' }).success).toBe(false);
  });

  it('refuse un room_id trop long', () => {
    expect(reviewRoomQuerySchema.safeParse({ room_id: 'a'.repeat(201) }).success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = reviewRoomQuerySchema.safeParse({ room_id: 'room-1', limit: '5' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });

  it('refuse une valeur non chaîne', () => {
    expect(reviewRoomQuerySchema.safeParse({ room_id: 1 }).success).toBe(false);
    expect(reviewRoomQuerySchema.safeParse({ room_id: null }).success).toBe(false);
  });
});
