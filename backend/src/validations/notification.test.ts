import { describe, expect, it } from 'vitest';
import { clientNotificationCreateSchema, notificationCreateSchema } from './notification';

const allTypes = [
  'reservation',
  'reservation_confirmed',
  'reservation_rejected',
  'verification_submitted',
  'verification_approved',
  'verification_rejected',
  'reservation_cancelled',
] as const;

const validNotification = {
  type: 'reservation',
  roomTitle: 'Studio Cocody',
  roomId: 'room-1',
  clientName: 'Jean Kouassi',
  clientEmail: 'jean@example.ci',
  clientPhone: '+2250700000000',
  message: 'Arrivée prévue le soir.',
  reservationId: 'res-1',
};

const validClientNotification = {
  type: 'reservation_confirmed',
  roomTitle: 'Studio Cocody',
  roomId: 'room-1',
  clientEmail: 'jean@example.ci',
  message: 'Votre réservation est confirmée',
};

describe('notificationCreateSchema', () => {
  it('accepte une notification complète', () => {
    const parsed = notificationCreateSchema.safeParse(validNotification);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual(validNotification);
  });

  it('accepte les 7 types de notification', () => {
    for (const type of allTypes) {
      const parsed = notificationCreateSchema.safeParse({ ...validNotification, type });
      expect(parsed.success).toBe(true);
    }
  });

  it('accepte les seuls champs requis et applique les défauts', () => {
    const parsed = notificationCreateSchema.safeParse({
      type: 'reservation',
      roomTitle: 'Studio',
      roomId: 'room-1',
      clientName: 'Jean',
      clientEmail: 'jean@example.ci',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.clientPhone).toBe('');
    expect(parsed.data.message).toBe('');
    expect(parsed.data.reservationId).toBeUndefined();
  });

  it('refuse un type inconnu', () => {
    const parsed = notificationCreateSchema.safeParse({ ...validNotification, type: 'promo' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['type']);
  });

  it('refuse un type non chaîne', () => {
    expect(
      notificationCreateSchema.safeParse({ ...validNotification, type: 42 }).success,
    ).toBe(false);
  });

  it('exige roomTitle, roomId, clientName et clientEmail', () => {
    for (const field of ['roomTitle', 'roomId', 'clientName', 'clientEmail'] as const) {
      const payload: Record<string, unknown> = { ...validNotification };
      delete payload[field];
      const parsed = notificationCreateSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
      if (parsed.success) continue;
      expect(parsed.error.issues[0]?.path).toEqual([field]);
    }
  });

  it('normalise l’email du client en minuscules', () => {
    const parsed = notificationCreateSchema.safeParse({
      ...validNotification,
      clientEmail: 'Jean@Example.ci',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.clientEmail).toBe('jean@example.ci');
  });

  it('refuse un email client invalide', () => {
    const parsed = notificationCreateSchema.safeParse({
      ...validNotification,
      clientEmail: 'pas-un-mail',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['clientEmail']);
  });

  it('refuse un roomId vide ou non identifiant', () => {
    expect(
      notificationCreateSchema.safeParse({ ...validNotification, roomId: '' }).success,
    ).toBe(false);
    expect(
      notificationCreateSchema.safeParse({ ...validNotification, roomId: '   ' }).success,
    ).toBe(false);
  });

  it('refuse un roomTitle vide ou trop long', () => {
    expect(
      notificationCreateSchema.safeParse({ ...validNotification, roomTitle: '' }).success,
    ).toBe(false);
    expect(
      notificationCreateSchema.safeParse({ ...validNotification, roomTitle: '  ' }).success,
    ).toBe(false);
    expect(
      notificationCreateSchema.safeParse({
        ...validNotification,
        roomTitle: 'a'.repeat(301),
      }).success,
    ).toBe(false);
  });

  it('accepte un roomTitle de 300 caractères', () => {
    expect(
      notificationCreateSchema.safeParse({
        ...validNotification,
        roomTitle: 'a'.repeat(300),
      }).success,
    ).toBe(true);
  });

  it('refuse un clientName vide ou trop long', () => {
    expect(
      notificationCreateSchema.safeParse({ ...validNotification, clientName: '' }).success,
    ).toBe(false);
    expect(
      notificationCreateSchema.safeParse({
        ...validNotification,
        clientName: 'a'.repeat(201),
      }).success,
    ).toBe(false);
  });

  it('borne clientPhone à 30 caractères et le trimme', () => {
    expect(
      notificationCreateSchema.safeParse({
        ...validNotification,
        clientPhone: '1'.repeat(31),
      }).success,
    ).toBe(false);

    const parsed = notificationCreateSchema.safeParse({
      ...validNotification,
      clientPhone: '  +2250700000000  ',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.clientPhone).toBe('+2250700000000');
  });

  it('borne le message à 2000 caractères', () => {
    expect(
      notificationCreateSchema.safeParse({
        ...validNotification,
        message: 'a'.repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      notificationCreateSchema.safeParse({
        ...validNotification,
        message: 'a'.repeat(2000),
      }).success,
    ).toBe(true);
  });

  it('refuse un reservationId invalide quand il est fourni', () => {
    expect(
      notificationCreateSchema.safeParse({ ...validNotification, reservationId: '' }).success,
    ).toBe(false);
  });

  it('refuse un champ inconnu (strict)', () => {
    const parsed = notificationCreateSchema.safeParse({
      ...validNotification,
      read: true,
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });

  it('refuse un corps non objet', () => {
    expect(notificationCreateSchema.safeParse(null).success).toBe(false);
    expect(notificationCreateSchema.safeParse('reservation').success).toBe(false);
  });

  it('détaille les erreurs de champs (format details = error.flatten())', () => {
    const parsed = notificationCreateSchema.safeParse({
      ...validNotification,
      clientEmail: 'pas-un-mail',
      roomTitle: '',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const flat = parsed.error.flatten();
    expect(Object.keys(flat.fieldErrors).sort()).toEqual(['clientEmail', 'roomTitle']);
  });
});

describe('clientNotificationCreateSchema', () => {
  it('accepte une notification de confirmation', () => {
    const parsed = clientNotificationCreateSchema.safeParse(validClientNotification);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual(validClientNotification);
  });

  it('accepte les deux types autorisés', () => {
    for (const type of ['reservation_confirmed', 'reservation_rejected'] as const) {
      const parsed = clientNotificationCreateSchema.safeParse({
        ...validClientNotification,
        type,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('refuse un type hors des deux autorisés (contrairement au schéma gérant)', () => {
    for (const type of ['reservation', 'verification_approved', 'promo']) {
      const parsed = clientNotificationCreateSchema.safeParse({
        ...validClientNotification,
        type,
      });
      expect(parsed.success).toBe(false);
      if (parsed.success) continue;
      expect(parsed.error.issues[0]?.path).toEqual(['type']);
    }
  });

  it('accepte les seuls champs requis avec message par défaut', () => {
    const parsed = clientNotificationCreateSchema.safeParse({
      type: 'reservation_confirmed',
      roomTitle: 'Studio',
      roomId: 'room-1',
      clientEmail: 'jean@example.ci',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.message).toBe('');
  });

  it('exige clientEmail', () => {
    const payload: Record<string, unknown> = { ...validClientNotification };
    delete payload.clientEmail;
    const parsed = clientNotificationCreateSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.path).toEqual(['clientEmail']);
  });

  it('refuse un email invalide et normalise la casse', () => {
    expect(
      clientNotificationCreateSchema.safeParse({
        ...validClientNotification,
        clientEmail: 'jean@',
      }).success,
    ).toBe(false);

    const parsed = clientNotificationCreateSchema.safeParse({
      ...validClientNotification,
      clientEmail: '  JEAN@Example.ci ',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.clientEmail).toBe('jean@example.ci');
  });

  it('refuse roomId ou roomTitle vides', () => {
    expect(
      clientNotificationCreateSchema.safeParse({ ...validClientNotification, roomId: '' })
        .success,
    ).toBe(false);
    expect(
      clientNotificationCreateSchema.safeParse({ ...validClientNotification, roomTitle: '' })
        .success,
    ).toBe(false);
  });

  it('borne le message à 2000 caractères', () => {
    expect(
      clientNotificationCreateSchema.safeParse({
        ...validClientNotification,
        message: 'a'.repeat(2001),
      }).success,
    ).toBe(false);
  });

  it('refuse les champs réservés au schéma gérant (clientName, clientPhone…)', () => {
    for (const field of ['clientName', 'clientPhone', 'reservationId'] as const) {
      const parsed = clientNotificationCreateSchema.safeParse({
        ...validClientNotification,
        [field]: 'x',
      });
      expect(parsed.success).toBe(false);
      if (parsed.success) continue;
      expect(parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('refuse un corps non objet', () => {
    expect(clientNotificationCreateSchema.safeParse(null).success).toBe(false);
    expect(clientNotificationCreateSchema.safeParse([]).success).toBe(false);
  });
});
