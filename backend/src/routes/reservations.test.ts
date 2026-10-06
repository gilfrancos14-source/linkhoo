import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import reservationsRouter from './reservations';
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

// Les routes publient un « réveil » Realtime après chaque notification :
// neutralisé ici, les assertions le vérifient via ce spy.
vi.mock('../utils/realtime', () => ({
  publishNotificationChanged: vi.fn(async () => {}),
}));

const app = buildTestApp('/api/reservations', reservationsRouter);

const validReservation = {
  client_name: 'Jean Koffi',
  client_email: 'jean@example.ci',
  client_phone: '+225 07 00 00 00 00',
  room_id: 'room-1',
  room_title: 'Studio Cocody',
  date_debut: '2026-05-01',
  date_fin: '2026-05-04',
  duree_nombre: 3,
  duree_unite: 'nuit',
  montant: 150000,
};

const qualifiedGerant = {
  is_verified: true,
  is_premium: true,
  premium_expires_at: '2099-01-01T00:00:00.000Z',
};

const availableRoom = {
  id: 'room-1',
  disponible: true,
  title: 'Studio Cocody',
  price_num: 5000,
  price_unit: '/ nuit',
  gerant_id: 'user_1',
};

let gerants: FakeChain;
let rooms: FakeChain;
let reservations: FakeChain;
let clients: FakeChain;
let notifications: FakeChain;

type TableName = 'gerants' | 'rooms' | 'reservations' | 'clients' | 'notifications';

function stubTables(tables: Partial<Record<TableName, FakeChain | FakeChain[]>>): void {
  useSupabaseTables(supabaseAdmin.from, {
    gerants,
    rooms,
    reservations,
    clients,
    notifications,
    ...tables,
  });
}

function mockRpc(
  results: unknown[] | ((args: Record<string, unknown>) => unknown),
): void {
  const queue = Array.isArray(results) ? [...results] : null;
  const impl = Array.isArray(results) ? null : results;
  const rpcMock = vi.mocked(supabaseAdmin.rpc) as unknown as {
    mockImplementation(impl: (_name: string, args: Record<string, unknown>) => Promise<unknown>): unknown;
  };
  rpcMock.mockImplementation(async (_name, args) =>
    (queue ? queue.shift() : impl?.(args)) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  gerants = fakeChain({ data: null, error: null });
  rooms = fakeChain({ data: null, error: null });
  reservations = fakeChain({ data: null, error: null });
  clients = fakeChain({ data: null, error: null });
  notifications = fakeChain({ data: null, error: null });
  stubTables({});
});

describe('POST /api/reservations', () => {
  it('400 sur un email invalide', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .send({ ...validReservation, client_email: 'pas-un-email' });
    expect(res.status).toBe(400);
  });

  it('400 si la date de fin n’est pas après la date de début', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .send({ ...validReservation, date_fin: '2026-05-01' });
    expect(res.status).toBe(400);
  });

  it('400 si la date de fin ne correspond pas à la durée', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .send({ ...validReservation, date_fin: '2026-05-08' });
    expect(res.status).toBe(400);
  });

  it('400 si l’unité demandée contredit le tarif de la chambre', async () => {
    rooms = fakeChain({ data: availableRoom, error: null });
    stubTables({});

    const res = await request(app).post('/api/reservations').send({
      ...validReservation,
      date_debut: '2026-05-01',
      date_fin: '2026-06-01',
      duree_nombre: 1,
      duree_unite: 'mois',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('/ nuit');
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('404 si la chambre n’existe pas', async () => {
    const res = await request(app).post('/api/reservations').send(validReservation);
    expect(res.status).toBe(404);
  });

  it('409 si la chambre n’est plus disponible', async () => {
    rooms = fakeChain({ data: { ...availableRoom, disponible: false }, error: null });
    stubTables({});

    const res = await request(app).post('/api/reservations').send(validReservation);
    expect(res.status).toBe(409);
  });

  it('201 : crée la réservation via RPC avec le montant recalculé', async () => {
    rooms = fakeChain({ data: availableRoom, error: null });
    stubTables({});
    mockRpc([{ data: [{ id: 'resa-1', statut: 'en_attente' }], error: null }]);

    const res = await request(app).post('/api/reservations').send(validReservation);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'resa-1', statut: 'en_attente' });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'create_reservation_checked',
      expect.objectContaining({
        p_room_id: 'room-1',
        p_montant: 15000,
        p_duree_nombre: 3,
        p_duree_unite: 'nuit',
      }),
    );
    // Le message libre du client a été retiré : plus aucun p_message envoyé.
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'create_reservation_checked',
      expect.not.objectContaining({ p_message: expect.anything() }),
    );
    expect(notifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reservation',
        reservation_id: 'resa-1',
        // Texte de la cloche gérant : généré par le serveur, jamais tapé par
        // le client.
        message: 'Nouvelle demande de réservation du 2026-05-01 au 2026-05-04.',
      }),
    );
    // P1 #8 : le front admin/gérant est réveillé en Realtime après l'insert.
    expect(publishNotificationChanged).toHaveBeenCalledWith('admin', 'gerant');
  });

  it('201 : chambre tarifée au mois → montant = prix × nombre de mois', async () => {
    rooms = fakeChain({ data: { ...availableRoom, price_num: 120000, price_unit: '/ mois' }, error: null });
    stubTables({});
    mockRpc([{ data: [{ id: 'resa-2', statut: 'en_attente' }], error: null }]);

    const res = await request(app).post('/api/reservations').send({
      ...validReservation,
      date_debut: '2026-05-01',
      date_fin: '2026-07-01',
      duree_nombre: 2,
      duree_unite: 'mois',
      montant: 1,
    });

    expect(res.status).toBe(201);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'create_reservation_checked',
      expect.objectContaining({ p_montant: 240000, p_duree_nombre: 2, p_duree_unite: 'mois' }),
    );
  });

  it('409 sur un conflit de dates renvoyé par le RPC', async () => {
    rooms = fakeChain({ data: availableRoom, error: null });
    stubTables({});
    mockRpc([{ data: null, error: { message: 'DATE_CONFLICT: chevauchement' } }]);

    const res = await request(app).post('/api/reservations').send(validReservation);
    expect(res.status).toBe(409);
  });

  it('201 : transmet la clé d’idempotence à la RPC et notifie', async () => {
    rooms = fakeChain({ data: availableRoom, error: null });
    stubTables({});
    mockRpc((args) => ({ data: [{ id: args.p_id, statut: 'en_attente' }], error: null }));

    const res = await request(app)
      .post('/api/reservations')
      .send({ ...validReservation, client_key: 'ck-idem-12345678' });

    expect(res.status).toBe(201);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'create_reservation_checked',
      expect.objectContaining({ p_client_key: 'ck-idem-12345678' }),
    );
    expect(notifications.insert).toHaveBeenCalledTimes(1);
  });

  it('200 : rejeu d’une soumission déjà acceptée (pas de doublon, pas de 2e notification)', async () => {
    const existing = { id: 'resa-1', client_key: 'ck-idem-12345678', statut: 'en_attente' };
    reservations = fakeChain({ data: existing, error: null });
    stubTables({});

    const res = await request(app)
      .post('/api/reservations')
      .send({ ...validReservation, client_key: 'ck-idem-12345678' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(existing);
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
    expect(notifications.insert).not.toHaveBeenCalled();
    expect(publishNotificationChanged).not.toHaveBeenCalled();
  });

  it('200 : course entre deux rejeux → la RPC renvoie la ligne gagnante, sans notification', async () => {
    rooms = fakeChain({ data: availableRoom, error: null });
    stubTables({});
    // La RPC détecte (dans la fonction SQL) qu'une requête concurrente a
    // déjà créé la réservation avec la même clé et renvoie cette ligne-là.
    mockRpc([{ data: [{ id: 'resa-concurrente', statut: 'en_attente' }], error: null }]);

    const res = await request(app)
      .post('/api/reservations')
      .send({ ...validReservation, client_key: 'ck-idem-12345678' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'resa-concurrente', statut: 'en_attente' });
    expect(notifications.insert).not.toHaveBeenCalled();
  });

  it('200 : le cas unique sur client_key renvoie la ligne gagnante, sans notification', async () => {
    rooms = fakeChain({ data: availableRoom, error: null });
    const winner = { id: 'resa-gagnante', client_key: 'ck-idem-12345678', statut: 'en_attente' };
    // 1er appel : pré-vérification (rien encore) ; 2e : récupération du gagnant.
    reservations = fakeChain({ data: null, error: null });
    stubTables({ reservations: [reservations, fakeChain({ data: winner, error: null })] });
    mockRpc([
      { data: null, error: { message: 'duplicate key value violates unique constraint "reservations_client_key_unique"' } },
    ]);

    const res = await request(app)
      .post('/api/reservations')
      .send({ ...validReservation, client_key: 'ck-idem-12345678' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(winner);
    expect(notifications.insert).not.toHaveBeenCalled();
  });
});

describe('GET /api/reservations', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/reservations');
    expect(res.status).toBe(401);
  });

  it('403 pour un gérant non qualifié (ni vérifié ni premium)', async () => {
    const res = await request(app)
      .get('/api/reservations')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
  });

  it('200 pour un gérant qualifié', async () => {
    gerants = fakeChain({ data: qualifiedGerant, error: null });
    rooms = fakeChain({ data: [{ id: 'room-1' }], error: null });
    reservations = fakeChain({ data: [{ id: 'resa-1', room_id: 'room-1' }], error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/reservations')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'resa-1', room_id: 'room-1' }]);
    expect(reservations.in).toHaveBeenCalledWith('room_id', ['room-1']);
  });

  it('200 avec une liste vide quand le gérant n’a aucune chambre', async () => {
    gerants = fakeChain({ data: qualifiedGerant, error: null });
    rooms = fakeChain({ data: [], error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/reservations')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/reservations/mine', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/reservations/mine');
    expect(res.status).toBe(401);
  });

  it('200 avec une liste vide sans profil client', async () => {
    const res = await request(app)
      .get('/api/reservations/mine')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('200 : lit les réservations du client connecté', async () => {
    clients = fakeChain({ data: { email: 'jean@example.ci' }, error: null });
    reservations = fakeChain({ data: [{ id: 'resa-1' }], error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/reservations/mine')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(reservations.eq).toHaveBeenCalledWith('client_email', 'jean@example.ci');
  });
});

describe('GET /api/reservations/client', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/reservations/client');
    expect(res.status).toBe(401);
  });

  it('400 sur une adresse email invalide en query', async () => {
    clients = fakeChain({ data: { email: 'jean@example.ci' }, error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/reservations/client?email=bidon')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(400);
  });

  it('403 si l’email demandé n’appartient pas au client connecté', async () => {
    clients = fakeChain({ data: { email: 'jean@example.ci' }, error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/reservations/client?email=autre@example.ci')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
  });

  it('200 pour ses propres réservations', async () => {
    clients = fakeChain({ data: { email: 'jean@example.ci' }, error: null });
    reservations = fakeChain({ data: [{ id: 'resa-1' }], error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/reservations/client?email=Jean%40example.ci')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'resa-1' }]);
  });
});

describe('PATCH /api/reservations/:id', () => {
  it('401 sans token', async () => {
    const res = await request(app).patch('/api/reservations/r1').send({ statut: 'confirmee' });
    expect(res.status).toBe(401);
  });

  it('400 sur un statut inconnu', async () => {
    const res = await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'terminee' });
    expect(res.status).toBe(400);
  });

  it('403 pour un gérant non qualifié', async () => {
    const res = await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'annulee' });
    expect(res.status).toBe(403);
  });

  it('404 si la réservation n’existe pas', async () => {
    gerants = fakeChain({ data: qualifiedGerant, error: null });
    stubTables({});

    const res = await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'annulee' });
    expect(res.status).toBe(404);
  });

  it('403 si la réservation appartient à une autre chambre', async () => {
    gerants = fakeChain({ data: qualifiedGerant, error: null });
    reservations = fakeChain({
      data: { id: 'r1', room_id: 'room-x', statut: 'en_attente' },
      error: null,
    });
    rooms = fakeChain({ data: { gerant_id: 'autre_user' }, error: null });
    stubTables({});

    const res = await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'annulee' });
    expect(res.status).toBe(403);
  });

  it('200 : confirme via le RPC', async () => {
    const gerantInfo = fakeChain({ data: { nom: 'Aya', phone: '+2250700000000' }, error: null });
    gerants = fakeChain({ data: qualifiedGerant, error: null });
    reservations = fakeChain({
      data: { id: 'r1', room_id: 'room-1', statut: 'en_attente' },
      error: null,
    });
    rooms = fakeChain({ data: { gerant_id: 'user_1' }, error: null });
    stubTables({ gerants: [gerants, gerantInfo] });
    mockRpc([{ data: [{ id: 'r1', statut: 'confirmee' }], error: null }]);

    const res = await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'confirmee' });

    expect(res.status).toBe(200);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('confirm_reservation_checked', {
      p_reservation_id: 'r1',
    });
    expect(res.body).toEqual(
      expect.objectContaining({ id: 'r1', statut: 'confirmee', gerant_prenom: null }),
    );
  });

  it('409 sur un conflit de dates lors de la confirmation', async () => {
    gerants = fakeChain({ data: qualifiedGerant, error: null });
    reservations = fakeChain({
      data: { id: 'r1', room_id: 'room-1', statut: 'en_attente' },
      error: null,
    });
    rooms = fakeChain({ data: { gerant_id: 'user_1' }, error: null });
    stubTables({});
    mockRpc([{ data: null, error: { message: 'DATE_CONFLICT' } }]);

    const res = await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'confirmee' });
    expect(res.status).toBe(409);
  });

  it('200 : annule la réservation par mise à jour directe', async () => {
    const gerantInfo = fakeChain({ data: { nom: 'Aya', phone: '+2250700000000' }, error: null });
    gerants = fakeChain({ data: qualifiedGerant, error: null });
    const cancelled = fakeChain({ data: { id: 'r1', statut: 'annulee' }, error: null });
    const current = fakeChain({
      data: { id: 'r1', room_id: 'room-1', statut: 'en_attente' },
      error: null,
    });
    rooms = fakeChain({ data: { gerant_id: 'user_1' }, error: null });
    stubTables({ gerants: [gerants, gerantInfo], reservations: [current, cancelled] });

    const res = await request(app)
      .patch('/api/reservations/r1')
      .set('Authorization', clerkBearer('user_1'))
      .send({ statut: 'annulee' });

    expect(res.status).toBe(200);
    expect(cancelled.update).toHaveBeenCalledWith(expect.objectContaining({ statut: 'annulee' }));
  });
});

describe('POST /api/reservations/:id/cancel', () => {
  it('401 sans token', async () => {
    const res = await request(app).post('/api/reservations/r1/cancel');
    expect(res.status).toBe(401);
  });

  it('400 sur un identifiant vide', async () => {
    const res = await request(app)
      .post('/api/reservations/%20/cancel')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(400);
  });

  it('404 sans profil client', async () => {
    const res = await request(app)
      .post('/api/reservations/r1/cancel')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
  });

  it('403 si la réservation appartient à un autre client', async () => {
    clients = fakeChain({ data: { email: 'moi@example.ci' }, error: null });
    reservations = fakeChain({
      data: {
        id: 'r1',
        client_name: 'Autre',
        client_email: 'autre@example.ci',
        client_phone: '',
        room_id: 'room-1',
        room_title: 'Studio',
        date_debut: '2026-05-01',
        date_fin: '2026-05-04',
        statut: 'en_attente',
      },
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/reservations/r1/cancel')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
  });

  it('400 si la réservation est déjà annulée', async () => {
    clients = fakeChain({ data: { email: 'jean@example.ci' }, error: null });
    reservations = fakeChain({
      data: {
        id: 'r1',
        client_name: 'Jean',
        client_email: 'Jean@Example.ci',
        client_phone: '',
        room_id: 'room-1',
        room_title: 'Studio',
        date_debut: '2026-05-01',
        date_fin: '2026-05-04',
        statut: 'annulee',
      },
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/reservations/r1/cancel')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(400);
  });

  it('200 : annule et notifie le gérant', async () => {
    clients = fakeChain({ data: { email: 'jean@example.ci' }, error: null });
    reservations = fakeChain({
      data: {
        id: 'r1',
        client_name: 'Jean',
        client_email: 'jean@example.ci',
        client_phone: '+2250700000000',
        room_id: 'room-1',
        room_title: 'Studio',
        date_debut: '2026-05-01',
        date_fin: '2026-05-04',
        statut: 'en_attente',
      },
      error: null,
    });
    const updated = fakeChain({
      data: { id: 'r1', room_id: 'room-1', statut: 'annulee', created_at: '2026-01-01' },
      error: null,
    });
    rooms = fakeChain({ data: { gerant_id: 'user_1' }, error: null });
    stubTables({ reservations: [reservations, updated] });

    const res = await request(app)
      .post('/api/reservations/r1/cancel')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('annulee');
    expect(notifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reservation_cancelled', gerant_id: 'user_1' }),
    );
    expect(publishNotificationChanged).toHaveBeenCalledWith('admin', 'gerant');
  });
});

describe('GET /api/reservations/check', () => {
  it('400 sur des paramètres invalides', async () => {
    const res = await request(app).get('/api/reservations/check?room_id=room-1');
    expect(res.status).toBe(400);
  });

  it('200 sans conflit via la RPC has_date_conflict', async () => {
    mockRpc([{ data: false, error: null }]);

    const res = await request(app).get(
      '/api/reservations/check?room_id=room-1&date_debut=2026-05-01&date_fin=2026-05-04',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasConflict: false });
    // Le test de chevauchement est délégué au SQL : PostgREST tronque les
    // réponses brutes à 1000 lignes, ce qui produisait de faux « aucun conflit ».
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('has_date_conflict', {
      p_room_id: 'room-1',
      p_date_debut: '2026-05-01',
      p_date_fin: '2026-05-04',
      p_exclude_id: null,
    });
    expect(reservations.select).not.toHaveBeenCalled();
  });

  it('200 avec conflit sur des dates chevauchantes (RPC renvoie true)', async () => {
    mockRpc([{ data: true, error: null }]);

    const res = await request(app).get(
      '/api/reservations/check?room_id=room-1&date_debut=2026-05-01&date_fin=2026-05-04',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasConflict: true });
  });

  it('200 : repli sur la table si la RPC absente (integrity_migration.sql non exécutée)', async () => {
    reservations = fakeChain({
      data: [{ id: 'x', room_id: 'room-1', date_debut: '2026-05-03', date_fin: '2026-05-06', statut: 'confirmee' }],
      error: null,
    });
    stubTables({});
    mockRpc([
      { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.has_date_conflict(t, t, t, t)' } },
    ]);

    const res = await request(app).get(
      '/api/reservations/check?room_id=room-1&date_debut=2026-05-01&date_fin=2026-05-04',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasConflict: true });
    expect(reservations.limit).toHaveBeenCalledWith(1000);
  });
});
