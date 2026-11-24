import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('../config/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}));

vi.mock('../utils/realtime', () => ({
  publishNotificationChanged: mocks.publish,
}));

import {
  notifyGerant,
  notifyGerantNewMessage,
  notifyGerantPayoutRetry,
} from './gerantNotifications';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ insert: mocks.insert });
});

describe('notifications gérant', () => {
  it('insère la notification et publie le changement', async () => {
    expect(
      await notifyGerant({
        gerantId: 'gerant-1',
        type: 'message_received',
        message: 'Nouveau message',
        roomId: 'room-1',
      }),
    ).toBe(true);

    expect(mocks.from).toHaveBeenCalledWith('notifications');
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message_received',
        gerant_id: 'gerant-1',
        room_id: 'room-1',
        message: 'Nouveau message',
      }),
    );
    expect(mocks.publish).toHaveBeenCalledWith('gerant');
  });

  it("ne fait rien sans identifiant de gérant", async () => {
    expect(await notifyGerant({ gerantId: null, type: 'message_received', message: 'x' })).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('formate un nouveau message avec le nom du client et un extrait', async () => {
    await notifyGerantNewMessage({
      gerantId: 'gerant-1',
      clientName: 'Jean Kouassi',
      clientEmail: 'jean@example.ci',
      roomId: 'room-1',
      body: 'Bonjour, je souhaite réserver pour le week-end.',
    });

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message_received',
        client_name: 'Jean Kouassi',
        client_email: 'jean@example.ci',
        message:
          'Nouveau message de Jean Kouassi : « Bonjour, je souhaite réserver pour le week-end. »',
      }),
    );
  });

  it('tronce les messages longs et gère un nom de client absent', async () => {
    await notifyGerantNewMessage({
      gerantId: 'gerant-1',
      clientName: null,
      clientEmail: null,
      roomId: null,
      body: 'x'.repeat(200),
    });

    const inserted = mocks.insert.mock.calls[0][0] as { message: string };
    expect(inserted.message).toContain('Nouveau message de Un client');
    expect(inserted.message).toContain('…');
    expect(inserted.message.length).toBeLessThan(200);
  });

  it('formate la relance de reversement', async () => {
    await notifyGerantPayoutRetry({
      gerantId: 'gerant-1',
      reference: 'PAY-2026-0841',
      amount: 225000,
      currency: 'XOF',
    });

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payout_retry_started',
        message: expect.stringContaining('PAY-2026-0841'),
      }),
    );
    const inserted = mocks.insert.mock.calls[0][0] as { message: string };
    expect(inserted.message).toContain('225\u202f000 XOF');
  });
});
