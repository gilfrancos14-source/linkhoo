import request from 'supertest';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import adminRouter from './admin';
import { supabaseAdmin } from '../config/supabase';
import { publishNotificationChanged } from '../utils/realtime';
import {
  adminToken,
  buildTestApp,
  fakeChain,
  supabaseStorage,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

// P1 #8 : les publications Realtime sont neutralisées, assertions via le spy.
vi.mock('../utils/realtime', () => ({
  publishNotificationChanged: vi.fn(async () => {}),
}));

const app = buildTestApp('/api/admin', adminRouter);

const ADMIN_HASH = bcrypt.hashSync('Admin123!', 4);
const FUTURE = '2099-01-01T00:00:00Z';

let gerants: FakeChain;
let rooms: FakeChain;
let reservations: FakeChain;
let admins: FakeChain;
let documents: FakeChain;
let notifications: FakeChain;
let clientNotifications: FakeChain;

type TableName =
  | 'gerants'
  | 'rooms'
  | 'reservations'
  | 'admins'
  | 'verification_documents'
  | 'notifications'
  | 'client_notifications';

function stubTables(tables: Partial<Record<TableName, FakeChain | FakeChain[]>> = {}): void {
  useSupabaseTables(supabaseAdmin.from, {
    gerants,
    rooms,
    reservations,
    admins,
    verification_documents: documents,
    notifications,
    client_notifications: clientNotifications,
    ...tables,
  });
}

function auth(token?: string) {
  const header: Record<string, string> = {};
  if (token) header.Authorization = `Bearer ${token}`;
  return header;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
  gerants = fakeChain({ data: null, error: null });
  rooms = fakeChain({ data: null, error: null });
  reservations = fakeChain({ data: null, error: null });
  admins = fakeChain({ data: null, error: null });
  documents = fakeChain({ data: null, error: null });
  notifications = fakeChain({ data: null, error: null });
  clientNotifications = fakeChain({ data: null, error: null });
  stubTables();
});

describe('POST /api/admin/login', () => {
  it('400 sur un corps invalide', async () => {
    const res = await request(app).post('/api/admin/login').send({ email: 'pas-un-email' });
    expect(res.status).toBe(400);
  });

  it('401 pour un email inconnu', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'inconnu@test.ci', password: 'Admin123!' });
    expect(res.status).toBe(401);
  });

  it('401 pour un mot de passe incorrect', async () => {
    admins = fakeChain({
      data: { id: 'a1', email: 'admin@test.ci', password_hash: ADMIN_HASH },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.ci', password: 'MauvaisMotDePasse' });
    expect(res.status).toBe(401);
  });

  it('200 : renvoie un jeton signé', async () => {
    admins = fakeChain({
      data: {
        id: 'a1',
        email: 'admin@test.ci',
        password_hash: ADMIN_HASH,
        nom: 'Admin',
        prenom: 'Test',
      },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.ci', password: 'Admin123!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.admin).toEqual({
      id: 'a1',
      email: 'admin@test.ci',
      nom: 'Admin',
      prenom: 'Test',
    });
  });
});

describe('requireAdminAuth', () => {
  it('401 sans en-tête Authorization', async () => {
    const res = await request(app).get('/api/admin/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Token d'authentification manquant");
  });

  it('401 sur un jeton fabriqué avec un autre secret', async () => {
    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', 'Bearer jeton-absurde');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token invalide ou expiré');
  });
});

describe('GET /api/admin/me', () => {
  it('404 si la ligne admin a disparu', async () => {
    const res = await request(app).get('/api/admin/me').set(auth(adminToken()));
    expect(res.status).toBe(404);
  });

  it('200 : renvoie le profil', async () => {
    admins = fakeChain({
      data: { id: 'admin-1', email: 'admin@test.ci', nom: 'Admin', prenom: 'Test' },
      error: null,
    });
    stubTables();

    const res = await request(app).get('/api/admin/me').set(auth(adminToken()));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.ci');
    expect(admins.eq).toHaveBeenCalledWith('id', 'admin-1');
  });
});

describe('POST /api/admin/change-password', () => {
  it('400 sur un nouveau mot de passe trop court', async () => {
    const res = await request(app)
      .post('/api/admin/change-password')
      .set(auth(adminToken()))
      .send({ currentPassword: 'Admin123!', newPassword: 'abc' });
    expect(res.status).toBe(400);
  });

  it('401 si le mot de passe actuel ne correspond pas', async () => {
    admins = fakeChain({
      data: { id: 'admin-1', password_hash: ADMIN_HASH },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .post('/api/admin/change-password')
      .set(auth(adminToken()))
      .send({ currentPassword: 'AncienFaux', newPassword: 'Nouveau123' });
    expect(res.status).toBe(401);
  });

  it('200 : hache le nouveau mot de passe', async () => {
    const fetchAdmin = fakeChain({ data: { id: 'admin-1', password_hash: ADMIN_HASH }, error: null });
    const updated = fakeChain({ data: null, error: null });
    stubTables({ admins: [fetchAdmin, updated] });

    const res = await request(app)
      .post('/api/admin/change-password')
      .set(auth(adminToken()))
      .send({ currentPassword: 'Admin123!', newPassword: 'Nouveau123' });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ password_hash: expect.stringMatching(/^\$2[aby]\$12\$/) }),
    );
  });
});

describe('GET /api/admin/stats', () => {
  it('200 : renvoie les agrégats calculés par la RPC admin_stats', async () => {
    const stats = {
      gerants: {
        total: 2,
        verified: 1,
        pendingVerifications: 1,
        premium: 1,
        byMarket: { CI: 1, BJ: 1 },
        newThisMonth: 1,
      },
      rooms: { total: 2, available: 1, unavailable: 1 },
      reservations: { total: 3, pending: 1, confirmed: 1, cancelled: 1, totalRevenue: 50000 },
    };
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: stats, error: null } as never);

    const res = await request(app).get('/api/admin/stats').set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(stats);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_stats');
    // Plus aucun chargement de table entière pour les statistiques.
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('500 si la RPC remonte une erreur', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'ERREUR_BDD' },
    } as never);

    const res = await request(app).get('/api/admin/stats').set(auth(adminToken()));

    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/gerants', () => {
  it('200 : liste paginée sans filtre', async () => {
    gerants = fakeChain({ data: [{ id: 'g1' }], error: null });
    stubTables();

    const res = await request(app).get('/api/admin/gerants').set(auth(adminToken()));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'g1' }]);
  });

  it('200 : applique les filtres market et verification_status', async () => {
    gerants = fakeChain({ data: [], error: null });
    stubTables();

    const res = await request(app)
      .get('/api/admin/gerants?market=CI&verification_status=pending')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(gerants.eq).toHaveBeenCalledWith('market', 'CI');
    expect(gerants.eq).toHaveBeenCalledWith('verification_status', 'pending');
  });

  it('200 : ignore un market inconnu', async () => {
    gerants = fakeChain({ data: [], error: null });
    stubTables();

    await request(app).get('/api/admin/gerants?market=TG').set(auth(adminToken()));
    expect(gerants.eq).not.toHaveBeenCalledWith('market', 'TG');
  });
});

describe('PATCH /api/admin/gerants/:id/verify', () => {
  it('400 sur un identifiant vide', async () => {
    const res = await request(app)
      .patch('/api/admin/gerants/%20/verify')
      .set(auth(adminToken()));
    expect(res.status).toBe(400);
  });

  it('404 si le gérant nexiste pas', async () => {
    const res = await request(app)
      .patch('/api/admin/gerants/g1/verify')
      .set(auth(adminToken()));
    expect(res.status).toBe(404);
  });

  it('200 : marque le profil comme vérifié', async () => {
    const fetched = fakeChain({ data: { id: 'g1' }, error: null });
    const updated = fakeChain({ data: { id: 'g1', is_verified: true }, error: null });
    stubTables({ gerants: [fetched, updated] });

    const res = await request(app)
      .patch('/api/admin/gerants/g1/verify')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(expect.objectContaining({ is_verified: true }));
  });
});

describe('PATCH /api/admin/gerants/:id/revoke-verification', () => {
  it('200 : réinitialise la vérification', async () => {
    const updated = fakeChain({ data: { id: 'g1', is_verified: false }, error: null });
    stubTables({ gerants: updated });

    const res = await request(app)
      .patch('/api/admin/gerants/g1/revoke-verification')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_verified: false, verification_status: 'none' }),
    );
  });
});

describe('GET /api/admin/gerants/:id/documents', () => {
  it('404 si le gérant nexiste pas', async () => {
    const res = await request(app)
      .get('/api/admin/gerants/g1/documents')
      .set(auth(adminToken()));
    expect(res.status).toBe(404);
  });

  it('200 : renouvelle les URL signées', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    documents = fakeChain({
      data: [{ id: 'doc-1', file_path: 'verification-docs/front.webp', file_url: 'ancienne' }],
      error: null,
    });
    stubTables();

    const res = await request(app)
      .get('/api/admin/gerants/g1/documents')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(supabaseStorage().createSignedUrl).toHaveBeenCalledWith(
      'verification-docs/front.webp',
      3600,
    );
    expect(res.body[0].file_url).toBe('https://storage.test/signed/fichier-test');
  });
});

describe('PATCH /api/admin/documents/:docId/review', () => {
  it('400 si le statut est inconnu', async () => {
    const res = await request(app)
      .patch('/api/admin/documents/doc-1/review')
      .set(auth(adminToken()))
      .send({ status: 'accepte' });
    expect(res.status).toBe(400);
  });

  it('404 si le document nexiste pas', async () => {
    const res = await request(app)
      .patch('/api/admin/documents/doc-1/review')
      .set(auth(adminToken()))
      .send({ status: 'approved' });
    expect(res.status).toBe(404);
  });

  it('200 : enregistre la revue', async () => {
    const found = fakeChain({ data: { id: 'doc-1', gerant_id: 'g1' }, error: null });
    const reviewed = fakeChain({ data: { id: 'doc-1', status: 'approved' }, error: null });
    stubTables({ verification_documents: [found, reviewed] });

    const res = await request(app)
      .patch('/api/admin/documents/doc-1/review')
      .set(auth(adminToken()))
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(reviewed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        rejection_reason: null,
        reviewed_by: 'admin@test.ci',
      }),
    );
  });
});

describe('PATCH /api/admin/gerants/:id/start-review', () => {
  it('400 si aucune demande nen attente', async () => {
    gerants = fakeChain({ data: { id: 'g1', verification_status: 'none' }, error: null });
    stubTables();

    const res = await request(app)
      .patch('/api/admin/gerants/g1/start-review')
      .set(auth(adminToken()));
    expect(res.status).toBe(400);
  });

  it('200 : passe en under_review', async () => {
    const fetched = fakeChain({ data: { id: 'g1', verification_status: 'pending' }, error: null });
    const updated = fakeChain({ data: { id: 'g1', verification_status: 'under_review' }, error: null });
    stubTables({ gerants: [fetched, updated] });

    const res = await request(app)
      .patch('/api/admin/gerants/g1/start-review')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ verification_status: 'under_review' }),
    );
  });
});

describe('PATCH /api/admin/gerants/:id/approve-verification', () => {
  it('400 sans demande en cours', async () => {
    gerants = fakeChain({
      data: { id: 'g1', clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .patch('/api/admin/gerants/g1/approve-verification')
      .set(auth(adminToken()));
    expect(res.status).toBe(400);
  });

  it('200 : approuve et notifie le gérant', async () => {
    const fetched = fakeChain({
      data: { id: 'g1', clerk_user_id: 'user_1', verification_status: 'under_review' },
      error: null,
    });
    const updated = fakeChain({
      data: { id: 'g1', verification_status: 'approved', is_verified: true },
      error: null,
    });
    stubTables({ gerants: [fetched, updated] });

    const res = await request(app)
      .patch('/api/admin/gerants/g1/approve-verification')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_verified: true, verification_status: 'approved' }),
    );
    expect(notifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'verification_approved', gerant_id: 'user_1' }),
    );
    expect(publishNotificationChanged).toHaveBeenCalledWith('admin', 'gerant');
  });
});

describe('PATCH /api/admin/gerants/:id/reject-verification', () => {
  it('400 sans motif de rejet', async () => {
    const res = await request(app)
      .patch('/api/admin/gerants/g1/reject-verification')
      .set(auth(adminToken()))
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 sans demande en cours', async () => {
    gerants = fakeChain({
      data: { id: 'g1', clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .patch('/api/admin/gerants/g1/reject-verification')
      .set(auth(adminToken()))
      .send({ rejection_reason: 'Photo illisible' });
    expect(res.status).toBe(400);
  });

  it('200 : rejette et notifie le gérant', async () => {
    const fetched = fakeChain({
      data: { id: 'g1', clerk_user_id: 'user_1', verification_status: 'pending' },
      error: null,
    });
    const updated = fakeChain({
      data: { id: 'g1', verification_status: 'rejected' },
      error: null,
    });
    stubTables({ gerants: [fetched, updated] });

    const res = await request(app)
      .patch('/api/admin/gerants/g1/reject-verification')
      .set(auth(adminToken()))
      .send({ rejection_reason: 'Photo illisible' });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({
        verification_status: 'rejected',
        verification_rejection_reason: 'Photo illisible',
      }),
    );
    expect(notifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'verification_rejected' }),
    );
    expect(publishNotificationChanged).toHaveBeenCalledWith('admin', 'gerant');
  });
});

describe('GET /api/admin/verification/pending', () => {
  it('200 : liste les demandes en attente ou en révision', async () => {
    gerants = fakeChain({
      data: [{ id: 'g1', verification_status: 'pending', verification_submitted_at: FUTURE }],
      error: null,
    });
    stubTables();

    const res = await request(app)
      .get('/api/admin/verification/pending')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(gerants.in).toHaveBeenCalledWith('verification_status', ['pending', 'under_review']);
  });
});

describe('GET /api/admin/reservations', () => {
  it('200 : délègue filtrage et pagination à la RPC admin_reservations', async () => {
    const payload = {
      items: [
        {
          id: 'r1',
          client_name: 'Jean',
          room_title: 'Studio',
          statut: 'en_attente',
          gerant_id: 'user_1',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      counts: { total: 1, pending: 1, confirmed: 0, cancelled: 0 },
    };
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: payload, error: null } as never);

    const res = await request(app).get('/api/admin/reservations').set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_reservations', {
      p_statut: null,
      p_search: null,
      p_page: 1,
      p_limit: 20,
    });
    // La qualification des gérants et la pagination sont désormais en SQL :
    // aucune table n'est chargée en mémoire.
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('200 : transmet statut, recherche et pagination à la RPC', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { items: [], total: 0, page: 2, limit: 50 },
      error: null,
    } as never);

    const res = await request(app)
      .get('/api/admin/reservations?statut=confirmee&search=paul&page=2&limit=50')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('admin_reservations', {
      p_statut: 'confirmee',
      p_search: 'paul',
      p_page: 2,
      p_limit: 50,
    });
  });

  it('200 : accepte statut=all sans filtre côté SQL', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { items: [], total: 0, page: 1, limit: 20 },
      error: null,
    } as never);

    const res = await request(app)
      .get('/api/admin/reservations?statut=all')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      'admin_reservations',
      expect.objectContaining({ p_statut: 'all' }),
    );
  });

  it('400 sur une page ou une limite hors bornes', async () => {
    const tropPetite = await request(app)
      .get('/api/admin/reservations?page=0')
      .set(auth(adminToken()));
    expect(tropPetite.status).toBe(400);

    const tropGrande = await request(app)
      .get('/api/admin/reservations?limit=500')
      .set(auth(adminToken()));
    expect(tropGrande.status).toBe(400);

    const statutInconnu = await request(app)
      .get('/api/admin/reservations?statut=virgule')
      .set(auth(adminToken()));
    expect(statutInconnu.status).toBe(400);

    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('500 si la RPC remonte une erreur', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'ERREUR_BDD' },
    } as never);

    const res = await request(app).get('/api/admin/reservations').set(auth(adminToken()));

    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/reservations/:id/check-availability', () => {
  function reservationRow(disponible: boolean, statut = 'en_attente') {
    return {
      id: 'res1',
      statut,
      room_title: 'Studio',
      room_id: 'room-1',
      client_email: 'jean@example.ci',
      rooms: { gerant_id: 'user_1', disponible },
    };
  }

  it('404 si la réservation nexiste pas', async () => {
    const res = await request(app)
      .post('/api/admin/reservations/res1/check-availability')
      .set(auth(adminToken()));
    expect(res.status).toBe(404);
  });

  it('400 si la réservation a déjà été traitée', async () => {
    reservations = fakeChain({ data: reservationRow(true, 'confirmee'), error: null });
    stubTables();

    const res = await request(app)
      .post('/api/admin/reservations/res1/check-availability')
      .set(auth(adminToken()));
    expect(res.status).toBe(400);
  });

  it('200 : annule si la chambre nest plus disponible', async () => {
    const fetched = fakeChain({ data: reservationRow(false), error: null });
    const updated = fakeChain({ data: null, error: null });
    stubTables({ reservations: [fetched, updated] });

    const res = await request(app)
      .post('/api/admin/reservations/res1/check-availability')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ statut: 'annulee', reason: 'chambre_non_disponible' });
    expect(updated.update).toHaveBeenCalledWith(expect.objectContaining({ statut: 'annulee' }));
    expect(clientNotifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reservation_rejected' }),
    );
    expect(publishNotificationChanged).toHaveBeenCalledWith('client');
  });

  it('200 : confirme quand le RPC ne détecte aucun conflit', async () => {
    reservations = fakeChain({ data: reservationRow(true), error: null });
    stubTables();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: null, error: null } as never);

    const res = await request(app)
      .post('/api/admin/reservations/res1/check-availability')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ statut: 'confirmee', reason: null });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('confirm_reservation_checked', {
      p_reservation_id: 'res1',
    });
    expect(clientNotifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reservation_confirmed' }),
    );
    expect(publishNotificationChanged).toHaveBeenCalledWith('client');
  });

  it('200 : annule sur conflit de dates signalement par le RPC', async () => {
    const fetched = fakeChain({ data: reservationRow(true), error: null });
    const updated = fakeChain({ data: null, error: null });
    stubTables({ reservations: [fetched, updated] });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'DATE_CONFLICT: plage déjà prise' },
    } as never);

    const res = await request(app)
      .post('/api/admin/reservations/res1/check-availability')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ statut: 'annulee', reason: 'conflit_dates' });
    expect(updated.update).toHaveBeenCalledWith(expect.objectContaining({ statut: 'annulee' }));
    expect(clientNotifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reservation_rejected' }),
    );
    expect(publishNotificationChanged).toHaveBeenCalledWith('client');
  });

  it('404 : le RPC renvoie NOT_FOUND', async () => {
    reservations = fakeChain({ data: reservationRow(true), error: null });
    stubTables();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'NOT_FOUND' },
    } as never);

    const res = await request(app)
      .post('/api/admin/reservations/res1/check-availability')
      .set(auth(adminToken()));
    expect(res.status).toBe(404);
  });

  it('500 : erreur RPC inattendue remontée à errorHandler', async () => {
    reservations = fakeChain({ data: reservationRow(true), error: null });
    stubTables();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: 'ERREUR_BDD' },
    } as never);

    const res = await request(app)
      .post('/api/admin/reservations/res1/check-availability')
      .set(auth(adminToken()));
    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/notifications', () => {
  it('200 : liste vide si tous les gérants sont qualifiés', async () => {
    gerants = fakeChain({
      data: [
        {
          clerk_user_id: 'user_1',
          is_verified: true,
          is_premium: true,
          premium_expires_at: FUTURE,
        },
      ],
      error: null,
    });
    stubTables();

    const res = await request(app).get('/api/admin/notifications').set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ notifications: [], unread_count: 0 });
  });

  it('200 : compte les non lues des chambres des gérants non qualifiés', async () => {
    gerants = fakeChain({
      data: [{ clerk_user_id: 'user_1', is_verified: true, is_premium: false, premium_expires_at: null }],
      error: null,
    });
    rooms = fakeChain({ data: [{ id: 'room-1' }], error: null });
    notifications = fakeChain({
      data: [
        { id: 'n1', type: 'reservation', read: false, date: '2026-01-01' },
        { id: 'n2', type: 'reservation_cancelled', read: true, date: '2026-01-02' },
      ],
      error: null,
    });
    stubTables();

    const res = await request(app).get('/api/admin/notifications').set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body.unread_count).toBe(1);
    expect(res.body.notifications).toHaveLength(2);
  });
});

describe('PATCH /api/admin/notifications/:id/read', () => {
  it('404 si la notification nexiste pas', async () => {
    const res = await request(app)
      .patch('/api/admin/notifications/n1/read')
      .set(auth(adminToken()));
    expect(res.status).toBe(404);
  });

  it('200 : marque comme lue', async () => {
    notifications = fakeChain({ data: { id: 'n1', read: true }, error: null });
    stubTables();

    const res = await request(app)
      .patch('/api/admin/notifications/n1/read')
      .set(auth(adminToken()));

    expect(res.status).toBe(200);
    expect(notifications.update).toHaveBeenCalledWith({ read: true });
  });
});

describe('PATCH /api/admin/rooms/:id/promo-group', () => {
  it('400 sur un groupe de promesse inconnu', async () => {
    const res = await request(app)
      .patch('/api/admin/rooms/room-1/promo-group')
      .set(auth(adminToken()))
      .send({ promo_group: 'promo_20' });
    expect(res.status).toBe(400);
  });

  it('404 si la chambre nexiste pas', async () => {
    const res = await request(app)
      .patch('/api/admin/rooms/room-1/promo-group')
      .set(auth(adminToken()))
      .send({ promo_group: 'promo_15' });
    expect(res.status).toBe(404);
  });

  it('200 : applique le groupe de promesse', async () => {
    const fetched = fakeChain({ data: { id: 'room-1' }, error: null });
    const updated = fakeChain({ data: { id: 'room-1', promo_group: 'promo_15' }, error: null });
    stubTables({ rooms: [fetched, updated] });

    const res = await request(app)
      .patch('/api/admin/rooms/room-1/promo-group')
      .set(auth(adminToken()))
      .send({ promo_group: 'promo_15', promo_start: '2026-01-01', promo_end: '2026-01-31' });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ promo_group: 'promo_15', promo_start: '2026-01-01' }),
    );
  });

  it('200 : retire le groupe en envoyant null', async () => {
    const fetched = fakeChain({ data: { id: 'room-1' }, error: null });
    const updated = fakeChain({ data: { id: 'room-1', promo_group: null }, error: null });
    stubTables({ rooms: [fetched, updated] });

    const res = await request(app)
      .patch('/api/admin/rooms/room-1/promo-group')
      .set(auth(adminToken()))
      .send({ promo_group: null });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ promo_group: null, promo_start: null, promo_end: null }),
    );
  });
});
