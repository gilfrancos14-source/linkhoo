import { describe, expect, it } from 'vitest';
import {
  reservationCreateSchema,
  reservationStatusSchema,
  reservationCheckQuerySchema,
  clientReservationQuerySchema,
} from './reservation';

const validReservation = {
  client_name: 'Jean Kouassi',
  client_email: 'jean@example.ci',
  client_phone: '+2250700000000',
  room_id: 'room-1',
  room_title: 'Studio Cocody',
  date_debut: '2026-05-01',
  date_fin: '2026-05-04',
  duree_nombre: 3,
  duree_unite: 'nuit',
  montant: 750000,
};

describe('reservationCreateSchema', () => {
  it('accepte une réservation complète', () => {
    const parsed = reservationCreateSchema.safeParse(validReservation);
    expect(parsed.success).toBe(true);
  });

  it('accepte une réservation sans téléphone', () => {
    const sansOptionnels: Record<string, unknown> = { ...validReservation };
    delete sansOptionnels.client_phone;
    const parsed = reservationCreateSchema.safeParse(sansOptionnels);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.client_phone).toBe('');
  });

  it('refuse le champ message (retiré du produit : strict rejette l\'inconnu)', () => {
    const parsed = reservationCreateSchema.safeParse({
      ...validReservation,
      message: 'Arrivée prévue le soir.',
    });
    expect(parsed.success).toBe(false);
  });

  it('normalise lemail en minuscules', () => {
    const parsed = reservationCreateSchema.safeParse({
      ...validReservation,
      client_email: 'Jean@Example.ci',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.client_email).toBe('jean@example.ci');
  });

  it('refuse une fin antérieure ou égale au début', () => {
    const equal = reservationCreateSchema.safeParse({ ...validReservation, date_fin: '2026-05-01' });
    expect(equal.success).toBe(false);
    if (equal.success) return;
    expect(equal.error.issues[0]?.path).toEqual(['date_fin']);

    const before = reservationCreateSchema.safeParse({ ...validReservation, date_fin: '2026-04-28' });
    expect(before.success).toBe(false);
  });

  it('exige la durée (nombre + unité)', () => {
    const sansNombre: Record<string, unknown> = { ...validReservation };
    delete sansNombre.duree_nombre;
    expect(reservationCreateSchema.safeParse(sansNombre).success).toBe(false);

    const sansUnite: Record<string, unknown> = { ...validReservation };
    delete sansUnite.duree_unite;
    expect(reservationCreateSchema.safeParse(sansUnite).success).toBe(false);
  });

  it('refuse une date de fin qui ne correspond pas à la durée', () => {
    const parsed = reservationCreateSchema.safeParse({ ...validReservation, date_fin: '2026-05-06' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['date_fin']);
  });

  it('accepte une durée en mois (date de fin = début + N mois)', () => {
    const parsed = reservationCreateSchema.safeParse({
      ...validReservation,
      date_debut: '2026-01-31',
      date_fin: '2026-02-28',
      duree_nombre: 1,
      duree_unite: 'mois',
    });
    expect(parsed.success).toBe(true);
  });

  it('clamp le jour au dernier jour du mois cible', () => {
    const parsed = reservationCreateSchema.safeParse({
      ...validReservation,
      date_debut: '2026-05-31',
      date_fin: '2026-06-30',
      duree_nombre: 1,
      duree_unite: 'mois',
    });
    expect(parsed.success).toBe(true);
  });

  it('refuse une durée hors plafond (366 nuits / 24 mois)', () => {
    expect(
      reservationCreateSchema.safeParse({ ...validReservation, duree_nombre: 367 }).success,
    ).toBe(false);

    const moisTropLong = reservationCreateSchema.safeParse({
      ...validReservation,
      date_debut: '2026-05-01',
      date_fin: '2028-05-01',
      duree_nombre: 25,
      duree_unite: 'mois',
    });
    expect(moisTropLong.success).toBe(false);
    if (moisTropLong.success) return;
    expect(moisTropLong.error.issues[0]?.path).toEqual(['duree_nombre']);
  });

  it('refuse un nombre de durée nul, négatif ou non entier', () => {
    expect(reservationCreateSchema.safeParse({ ...validReservation, duree_nombre: 0 }).success).toBe(false);
    expect(reservationCreateSchema.safeParse({ ...validReservation, duree_nombre: -2 }).success).toBe(false);
    expect(reservationCreateSchema.safeParse({ ...validReservation, duree_nombre: 2.5 }).success).toBe(false);
  });

  it('refuse une unité inconnue', () => {
    const parsed = reservationCreateSchema.safeParse({ ...validReservation, duree_unite: 'semaine' });
    expect(parsed.success).toBe(false);
  });

  it('refuse une date au format invalide', () => {
    const parsed = reservationCreateSchema.safeParse({ ...validReservation, date_debut: '2026-13-45' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un montant nul ou non entier', () => {
    expect(reservationCreateSchema.safeParse({ ...validReservation, montant: 0 }).success).toBe(false);
    expect(reservationCreateSchema.safeParse({ ...validReservation, montant: 10.5 }).success).toBe(false);
  });

  it('refuse un email invalide', () => {
    const parsed = reservationCreateSchema.safeParse({ ...validReservation, client_email: 'pas-un-mail' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un téléphone malformé mais accepte la chaîne vide', () => {
    expect(
      reservationCreateSchema.safeParse({ ...validReservation, client_phone: 'abc' }).success,
    ).toBe(false);
    expect(
      reservationCreateSchema.safeParse({ ...validReservation, client_phone: '' }).success,
    ).toBe(true);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = reservationCreateSchema.safeParse({ ...validReservation, statut: 'confirmee' });
    expect(parsed.success).toBe(false);
  });
});

describe('reservationStatusSchema', () => {
  it('accepte les deux transitions possibles', () => {
    expect(reservationStatusSchema.safeParse({ statut: 'confirmee' }).success).toBe(true);
    expect(reservationStatusSchema.safeParse({ statut: 'annulee' }).success).toBe(true);
  });

  it('refuse un statut non transitionnable', () => {
    const parsed = reservationStatusSchema.safeParse({ statut: 'en_attente' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = reservationStatusSchema.safeParse({ statut: 'confirmee', motif: 'x' });
    expect(parsed.success).toBe(false);
  });
});

describe('reservationCheckQuerySchema', () => {
  const validQuery = { room_id: 'room-1', date_debut: '2026-05-01', date_fin: '2026-05-04' };

  it('accepte une vérification avec exclusion', () => {
    const parsed = reservationCheckQuerySchema.safeParse({ ...validQuery, exclude_id: 'res-1' });
    expect(parsed.success).toBe(true);
  });

  it('accepte sans exclude_id', () => {
    const parsed = reservationCheckQuerySchema.safeParse(validQuery);
    expect(parsed.success).toBe(true);
  });

  it('exige room_id', () => {
    const parsed = reservationCheckQuerySchema.safeParse({
      date_debut: '2026-05-01',
      date_fin: '2026-05-04',
    });
    expect(parsed.success).toBe(false);
  });

  it('refuse un départ antérieur à l’arrivée', () => {
    const parsed = reservationCheckQuerySchema.safeParse({
      ...validQuery,
      date_debut: '2026-05-04',
      date_fin: '2026-05-01',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['date_fin']);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = reservationCheckQuerySchema.safeParse({ ...validQuery, statut: 'confirmee' });
    expect(parsed.success).toBe(false);
  });
});

describe('clientReservationQuerySchema', () => {
  it('accepte une requête vide (email facultatif)', () => {
    const parsed = clientReservationQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it('accepte un email valide et le normalise', () => {
    const parsed = clientReservationQuerySchema.safeParse({ email: 'Jean@Example.ci' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.email).toBe('jean@example.ci');
  });

  it('refuse un email invalide', () => {
    const parsed = clientReservationQuerySchema.safeParse({ email: 'jean@' });
    expect(parsed.success).toBe(false);
  });

  it('refuse un paramètre inconnu (strict)', () => {
    const parsed = clientReservationQuerySchema.safeParse({ limit: '10' });
    expect(parsed.success).toBe(false);
  });
});
