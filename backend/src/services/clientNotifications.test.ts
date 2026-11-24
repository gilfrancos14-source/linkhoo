import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  publish: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('../config/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: mocks.upsert,
      select: mocks.select,
      maybeSingle: mocks.maybeSingle,
    })),
  },
}));

vi.mock('../utils/realtime', () => ({
  publishNotificationChanged: mocks.publish,
}));

vi.mock('./mailer', () => ({
  sendClientNotificationEmail: mocks.sendEmail,
}));

import { notifyClient, notifyClientNewMessage } from './clientNotifications';

describe('notifications client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsert.mockReturnThis();
    mocks.select.mockReturnThis();
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'notif-1' }, error: null });
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it('insère la notification, publie le changement et envoie le mail', async () => {
    const created = await notifyClient({
      clientEmail: 'client@exemple.ci',
      type: 'reservation_confirmed',
      message: 'Votre réservation est confirmée.',
      roomId: 'room-1',
      roomTitle: 'Appartement Cocody',
    });

    expect(created).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reservation_confirmed',
        client_email: 'client@exemple.ci',
        room_id: 'room-1',
        room_title: 'Appartement Cocody',
      }),
      { onConflict: 'id', ignoreDuplicates: true },
    );
    expect(mocks.publish).toHaveBeenCalledWith('client');
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'client@exemple.ci' }),
    );
  });

  it('ne fait rien sans email client', async () => {
    expect(await notifyClient({ clientEmail: null, type: 'payment_failed', message: 'x' })).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('ignore un webhook rejoué (notification déjà présente)', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const created = await notifyClient({
      id: 'payment-PAY-123-succeeded',
      clientEmail: 'client@exemple.ci',
      type: 'payment_succeeded',
      message: 'Paiement confirmé.',
    });

    expect(created).toBe(false);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('n’envoie pas de mail pour un nouveau message', async () => {
    await notifyClientNewMessage({
      clientEmail: 'client@exemple.ci',
      roomId: 'room-1',
      body: 'Bonjour, la chambre est disponible.',
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'new_message' }),
      expect.anything(),
    );
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
