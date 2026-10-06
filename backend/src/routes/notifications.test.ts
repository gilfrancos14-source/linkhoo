import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import notificationsRouter from './notifications';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { supabaseAdmin } from '../config/supabase';
import { publishNotificationChanged } from '../utils/realtime';
import {
  buildTestApp,
  clerkBearer,
  defaultVerifyToken,
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(),
}));

// P1 #8 : publication Realtime neutralisée, assertion via le spy.
vi.mock('../utils/realtime', () => ({
  publishNotificationChanged: vi.fn(async () => {}),
}));

const app = buildTestApp('/api/notifications', notificationsRouter, {
  middlewares: [requireClerkAuth],
});

let rooms: FakeChain;
let gerants: FakeChain;
let notifications: FakeChain;
let clients: FakeChain;
let reservations: FakeChain;
let clientNotifications: FakeChain;

type TableName = 'rooms' | 'gerants' | 'notifications' | 'clients' | 'reservations' | 'client_notifications';

function stubTables(tables: Partial<Record<TableName, FakeChain | FakeChain[]>> = {}): void {
  useSupabaseTables(supabaseAdmin.from, {
    rooms,
    gerants,
    notifications,
    clients,
    reservations,
    client_notifications: clientNotifications,
    ...tables,
  });
}

const clientRow = { id: 'c1', email: 'jean@example.ci', nom: 'Kouassi', prenom: 'Jean' };

const validClientNotification = {
  type: 'reservation_confirmed',
  roomTitle: 'Studio',
  roomId: 'room-1',
  clientEmail: 'jean@example.ci',
  message: 'Votre réservation est confirmée',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  rooms = fakeChain({ data: null, error: null });
  gerants = fakeChain({ data: null, error: null });
  notifications = fakeChain({ data: null, error: null });
  clients = fakeChain({ data: null, error: null });
  reservations = fakeChain({ data: null, error: null });
  clientNotifications = fakeChain({ data: null, error: null });
  stubTables();
});

describe('GET /api/notifications', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('200 : fusionne les sources et trie par date décroissante', async () => {
    rooms = fakeChain({ data: [{ id: 'room-1' }], error: null });
    const byGerant = fakeChain({
      data: [
        { id: 'n1', date: '2026-01-02T00:00:00Z' },
        { id: 'n2', date: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    });
    const byRoom = fakeChain({
      data: [
        { id: 'n2', date: '2026-01-01T00:00:00Z' },
        { id: 'n3', date: '2026-01-03T00:00:00Z' },
      ],
      error: null,
    });
    stubTables({ notifications: [byGerant, byRoom] });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body.map((n: { id: string }) => n.id)).toEqual(['n3', 'n1', 'n2']);
  });

  it('200 : une seule source quand le gérant na aucune chambre', async () => {
    rooms = fakeChain({ data: [], error: null });
    notifications = fakeChain({
      data: [{ id: 'n1', date: '2026-01-01T00:00:00Z' }],
      error: null,
    });
    stubTables();

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(notifications.in).not.toHaveBeenCalled();
  });

  const reservationNotification = {
    id: 'n1',
    type: 'reservation',
    room_title: 'Studio Cocody',
    room_id: 'room-1',
    client_name: 'Jean Koffi',
    client_email: 'jean@example.ci',
    client_phone: '+225 07 00 00 00 00',
    message: 'Arrivée vers 18h',
    reservation_id: 'resa-1',
    date: '2026-01-05T00:00:00Z',
  };

  it("200 : masque l'identité du client pour un gérant non qualifié", async () => {
    rooms = fakeChain({ data: [{ id: 'room-1' }], error: null });
    notifications = fakeChain({ data: [reservationNotification], error: null });
    stubTables();

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      id: 'n1',
      type: 'reservation',
      client_name: null,
      client_email: null,
      client_phone: null,
      message: null,
    });
  });

  it('200 : révèle lidentité à un gérant vérifié + premium actif', async () => {
    rooms = fakeChain({ data: [{ id: 'room-1' }], error: null });
    gerants = fakeChain(
      {
        data: {
          is_verified: true,
          is_premium: true,
          premium_expires_at: '2099-01-01T00:00:00.000Z',
        },
        error: null,
      },
    );
    notifications = fakeChain({ data: [reservationNotification], error: null });
    stubTables();

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      client_name: 'Jean Koffi',
      client_email: 'jean@example.ci',
      client_phone: '+225 07 00 00 00 00',
      message: 'Arrivée vers 18h',
    });
  });

  it("200 : non qualifié → le texte des notifications de vérification reste lisible", async () => {
    rooms = fakeChain({ data: [], error: null });
    notifications = fakeChain({
      data: [
        {
          id: 'n2',
          type: 'verification_rejected',
          client_name: null,
          client_email: null,
          message: 'Votre demande a été rejetée : document illisible.',
          date: '2026-01-04T00:00:00Z',
        },
      ],
      error: null,
    });
    stubTables();

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body[0].message).toBe('Votre demande a été rejetée : document illisible.');
    expect(res.body[0].client_name).toBeNull();
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('400 sur un identifiant vide', async () => {
    const res = await request(app)
      .patch('/api/notifications/%20/read')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(400);
  });

  it('404 si la notification nexiste pas', async () => {
    const res = await request(app)
      .patch('/api/notifications/n1/read')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
  });

  it('404 pour la notification dun autre gérant sans chambre', async () => {
    notifications = fakeChain({
      data: { id: 'n1', gerant_id: 'autre_user', room_id: null },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .patch('/api/notifications/n1/read')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
  });

  it('404 si la chambre rattachée appartient à un autre gérant', async () => {
    const fetched = fakeChain({ data: { id: 'n1', gerant_id: null, room_id: 'room-9' }, error: null });
    const roomOfOther = fakeChain({ data: null, error: null });
    stubTables({ notifications: fetched, rooms: roomOfOther });

    const res = await request(app)
      .patch('/api/notifications/n1/read')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
    expect(roomOfOther.maybeSingle).toHaveBeenCalled();
  });

  it('200 : marque comme lue pour le propriétaire direct', async () => {
    const fetched = fakeChain({ data: { id: 'n1', gerant_id: 'user_1', room_id: null }, error: null });
    const updated = fakeChain({ data: { id: 'n1', read: true }, error: null });
    stubTables({ notifications: [fetched, updated] });

    const res = await request(app)
      .patch('/api/notifications/n1/read')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith({ read: true });
  });

  it('200 : propriétaire via sa chambre', async () => {
    const fetched = fakeChain({ data: { id: 'n1', gerant_id: null, room_id: 'room-1' }, error: null });
    const room = fakeChain({ data: { id: 'room-1' }, error: null });
    const updated = fakeChain({ data: { id: 'n1', read: true }, error: null });
    stubTables({ notifications: [fetched, updated], rooms: room });

    const res = await request(app)
      .patch('/api/notifications/n1/read')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(room.eq).toHaveBeenCalledWith('gerant_id', 'user_1');
  });
});

describe('GET /api/notifications/client', () => {
  it('200 : liste vide sans profil client', async () => {
    const res = await request(app)
      .get('/api/notifications/client')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('400 si lemail de la requête est invalide', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    stubTables();

    const res = await request(app)
      .get('/api/notifications/client?email=pas-un-mail')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Adresse email invalide');
  });

  it('403 si lemail demandé nest pas celui du client', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    stubTables();

    const res = await request(app)
      .get('/api/notifications/client?email=autre@example.ci')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
  });

  it('200 : renvoie les notifications du client', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    clientNotifications = fakeChain({
      data: [{ id: 'cn1', type: 'reservation_confirmed', read: false, date: '2026-01-01' }],
      error: null,
    });
    stubTables();

    const res = await request(app)
      .get('/api/notifications/client?email=Jean%40Example.ci')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(clientNotifications.eq).toHaveBeenCalledWith('client_email', 'jean@example.ci');
  });
});

describe('POST /api/notifications/client', () => {
  it('400 sur un type non autorisé', async () => {
    const res = await request(app)
      .post('/api/notifications/client')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validClientNotification, type: 'reservation' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Données de notification invalides');
  });

  it('403 si la chambre na pas été créée par lappelant', async () => {
    const res = await request(app)
      .post('/api/notifications/client')
      .set('Authorization', clerkBearer('user_1'))
      .send(validClientNotification);
    expect(res.status).toBe(403);
  });

  it('403 si le client na aucune réservation sur la chambre', async () => {
    rooms = fakeChain({ data: { id: 'room-1' }, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/notifications/client')
      .set('Authorization', clerkBearer('user_1'))
      .send(validClientNotification);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('aucune réservation');
  });

  it('201 : enregistre la notification', async () => {
    rooms = fakeChain({ data: { id: 'room-1' }, error: null });
    reservations = fakeChain({ data: { id: 'res-1' }, error: null });
    const created = fakeChain({ data: { id: 'cn1', ...validClientNotification }, error: null });
    stubTables({ client_notifications: created });

    const res = await request(app)
      .post('/api/notifications/client')
      .set('Authorization', clerkBearer('user_1'))
      .send(validClientNotification);

    expect(res.status).toBe(201);
    expect(created.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reservation_confirmed',
        room_id: 'room-1',
        client_email: 'jean@example.ci',
        id: expect.any(String),
      }),
    );
    expect(reservations.eq).toHaveBeenCalledWith('client_email', 'jean@example.ci');
    expect(publishNotificationChanged).toHaveBeenCalledWith('client');
  });
});

describe('PATCH /api/notifications/client/:id/read', () => {
  it('404 sans profil client', async () => {
    const res = await request(app)
      .patch('/api/notifications/client/cn1/read')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Profil client introuvable');
  });

  it('404 pour la notification dun autre client', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    clientNotifications = fakeChain({
      data: { id: 'cn1', client_email: 'autre@example.ci' },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .patch('/api/notifications/client/cn1/read')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
  });

  it('200 : marque comme lue', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    const fetched = fakeChain({ data: { id: 'cn1', client_email: 'jean@example.ci' }, error: null });
    const updated = fakeChain({ data: { id: 'cn1', read: true }, error: null });
    stubTables({ client_notifications: [fetched, updated] });

    const res = await request(app)
      .patch('/api/notifications/client/cn1/read')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith({ read: true });
  });
});
