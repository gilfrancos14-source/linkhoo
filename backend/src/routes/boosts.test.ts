import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { Transaction } from 'fedapay';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import boostsRouter from './boosts';
import { supabaseAdmin } from '../config/supabase';
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

vi.mock('fedapay', () => ({
  FedaPay: { setApiKey: vi.fn(), setEnvironment: vi.fn(), setAccountId: vi.fn() },
  Transaction: { create: vi.fn(), retrieve: vi.fn() },
  Webhook: { constructEvent: vi.fn() },
}));

const app = buildTestApp('/api/boosts', boostsRouter);

// La vraie signature rpc de supabase-js exige un objet réponse complet
// (status, count…) : on caste une fois ici plutôt que partout dans les tests.
function mockRpc(result: unknown): void {
  const rpcMock = vi.mocked(supabaseAdmin.rpc) as unknown as {
    mockResolvedValue(value: unknown): unknown;
  };
  rpcMock.mockResolvedValue(result);
}

const BOOST_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE_END = new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString();

let gerants: FakeChain;
let rooms: FakeChain;
let boosts: FakeChain;
let transactions: FakeChain;

function stubTables(
  tables: Partial<{
    gerants: FakeChain | FakeChain[];
    rooms: FakeChain | FakeChain[];
    boosts: FakeChain | FakeChain[];
    premium_transactions: FakeChain | FakeChain[];
  }> = {}
): void {
  useSupabaseTables(supabaseAdmin.from, {
    gerants,
    rooms,
    boosts,
    premium_transactions: transactions,
    ...tables,
  });
}

const verifiedGerant = {
  id: 'g1',
  clerk_user_id: 'user_1',
  email: 'gerant@example.ci',
  market: 'CI',
  is_verified: true,
};

const ownedRoom = {
  id: 'room-1',
  title: 'Studio Plateau',
  market: 'CI',
  gerant_id: 'user_1',
  disponible: true,
};

const activeBoostRow = {
  id: 'b-1',
  market: 'CI',
  room_id: 'room-1',
  gerant_id: 'user_1',
  mode: 'cpi',
  status: 'active',
  budget_total: 1000,
  spent: 100,
  starts_at: new Date(Date.now() - 3600_000).toISOString(),
  ends_at: FUTURE,
  activated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  transaction_id: 'tx-uuid-1',
};

function initiateBody(overrides: Record<string, unknown> = {}) {
  return {
    room_id: 'room-1',
    mode: 'cpi',
    budget_total: 3000,
    starts_at: new Date().toISOString(),
    ends_at: FUTURE_END,
    ...overrides,
  };
}

function fedapayBoostTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 555,
    status: 'approved',
    amount: 3000,
    customer: { email: 'gerant@example.ci' },
    metadata: { clerk_user_id: 'user_1', market: 'CI', type: 'boost' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  gerants = fakeChain({ data: verifiedGerant, error: null });
  rooms = fakeChain({ data: ownedRoom, error: null });
  boosts = fakeChain({ data: activeBoostRow, error: null });
  transactions = fakeChain({ data: { id: 'pt-1', status: 'pending', activated_at: null }, error: null });
  stubTables();
  mockRpc({ data: [], error: null });
});

describe('GET /api/boosts/config', () => {
  it('expose les tarifs et budgets serveur', async () => {
    const res = await request(app).get('/api/boosts/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      currency: 'XOF',
      price_cpc: 50,
      price_cpi: 5,
      budgets: [1000, 3000, 5000],
      max_duration_days: 90,
    });
  });
});

describe('GET /api/boosts/featured', () => {
  it('retourne [] si la réponse n\'est pas un tableau (garde anti-crash)', async () => {
    stubTables({ boosts: fakeChain({ data: {}, error: null }) });
    const res = await request(app).get('/api/boosts/featured');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toEqual([]);
    expect(res.body.config.price_cpc).toBe(50);
  });

  it('mélange, filtre les chambres manquantes et plafonne à 6 emplacements', async () => {
    const rows = Array.from({ length: 9 }, (_, index) => ({
      id: `boost-${index}`,
      room_id: `room-${index}`,
      market: 'CI',
      mode: 'cpc',
      room: {
        id: `room-${index}`,
        title: `Chambre ${index}`,
        price: '50 000',
        price_num: 50000,
        price_unit: '/ mois',
        img: `/img/${index}.webp`,
        ville: 'Abidjan',
        quartier: 'Cocody',
        market: 'CI',
        category: 'Studio',
        disponible: index !== 7,
      },
    }));
    stubTables({ boosts: fakeChain({ data: rows, error: null }) });

    const res = await request(app).get('/api/boosts/featured');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(6);
    const ids = res.body.items.map((item: { room_id: string }) => item.room_id);
    expect(ids).not.toContain('room-7');
    expect(res.body.items[0]).toMatchObject({ title: expect.any(String), ville: 'Abidjan' });
  });
});

describe('POST /api/boosts/impression et /click', () => {
  it('400 si visitor_id est trop court', async () => {
    const res = await request(app)
      .post('/api/boosts/impression')
      .send({ boost_id: BOOST_UUID, visitor_id: 'abc' });
    expect(res.status).toBe(400);
  });

  it('400 si boost_id n\'est pas un UUID', async () => {
    const res = await request(app)
      .post('/api/boosts/impression')
      .send({ boost_id: 'pas-un-uuid', visitor_id: 'visiteur-01' });
    expect(res.status).toBe(400);
  });

  it('404 si la campagne n\'existe pas', async () => {
    stubTables({ boosts: fakeChain({ data: null, error: null }) });
    const res = await request(app)
      .post('/api/boosts/impression')
      .send({ boost_id: BOOST_UUID, visitor_id: 'visiteur-01' });
    expect(res.status).toBe(404);
  });

  it('impression sur cpi : débite 5 F (montant calculé par le serveur)', async () => {
    mockRpc({
      data: [{ counted: true, billed: true, exhausted: false, remaining: 995 }],
      error: null,
    });

    const res = await request(app)
      .post('/api/boosts/impression')
      .send({ boost_id: BOOST_UUID, visitor_id: 'visiteur-01' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ counted: true, billed: true, exhausted: false, remaining: 995 });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('charge_boost', {
      p_boost_id: BOOST_UUID,
      p_kind: 'impression',
      p_visitor_id: 'visiteur-01',
      p_amount: 5,
    });
  });

  it('impression sur cpc : comptée mais gratuite (p_amount 0)', async () => {
    stubTables({
      boosts: fakeChain({ data: { id: 'b-1', mode: 'cpc', status: 'active' }, error: null }),
    });
    mockRpc({
      data: [{ counted: true, billed: false, exhausted: false, remaining: 1000 }],
      error: null,
    });

    const res = await request(app)
      .post('/api/boosts/impression')
      .send({ boost_id: BOOST_UUID, visitor_id: 'visiteur-01' });

    expect(res.status).toBe(200);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('charge_boost', expect.objectContaining({ p_amount: 0 }));
  });

  it('clic sur cpc : débite 50 F', async () => {
    stubTables({
      boosts: fakeChain({ data: { id: 'b-1', mode: 'cpc', status: 'active' }, error: null }),
    });
    mockRpc({
      data: [{ counted: true, billed: true, exhausted: false, remaining: 950 }],
      error: null,
    });

    const res = await request(app)
      .post('/api/boosts/click')
      .send({ boost_id: BOOST_UUID, visitor_id: 'visiteur-01' });

    expect(res.status).toBe(200);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('charge_boost', expect.objectContaining({ p_amount: 50 }));
  });

  it('épuisement remonté tel quel', async () => {
    mockRpc({
      data: [{ counted: false, billed: false, exhausted: true, remaining: 0 }],
      error: null,
    });
    const res = await request(app)
      .post('/api/boosts/click')
      .send({ boost_id: BOOST_UUID, visitor_id: 'visiteur-01' });
    expect(res.body.exhausted).toBe(true);
    expect(res.body.counted).toBe(false);
  });
});

describe('POST /api/boosts/initiate', () => {
  it('401 sans token', async () => {
    const res = await request(app).post('/api/boosts/initiate').send(initiateBody());
    expect(res.status).toBe(401);
  });

  it('400 sur un budget hors tarification', async () => {
    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(initiateBody({ budget_total: 2000 }));
    expect(res.status).toBe(400);
  });

  it('400 si la fenêtre dépasse 90 jours', async () => {
    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(
        initiateBody({
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
        })
      );
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.details)).toContain('90 jours');
  });

  it('400 si la date de début est dans le passé', async () => {
    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(
        initiateBody({
          starts_at: '2020-01-01T00:00:00.000Z',
          ends_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        })
      );
    expect(res.status).toBe(400);
  });

  it('403 si le gérant n\'est pas vérifié', async () => {
    gerants = fakeChain({ data: { ...verifiedGerant, is_verified: false }, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(initiateBody());

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('vérification');
  });

  it('404 si la chambre n\'existe pas', async () => {
    rooms = fakeChain({ data: null, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(initiateBody());

    expect(res.status).toBe(404);
  });

  it('403 si la chambre appartient à un autre gérant', async () => {
    rooms = fakeChain({ data: { ...ownedRoom, gerant_id: 'user_autre' }, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(initiateBody());

    expect(res.status).toBe(403);
  });

  it('400 si une campagne est déjà active sur la chambre', async () => {
    stubTables({ boosts: fakeChain({ data: [{ id: 'b-live', status: 'active', created_at: new Date().toISOString() }], error: null }) });

    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(initiateBody());

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('déjà en cours');
  });

  it('409 si une tentative de paiement récente existe', async () => {
    stubTables({
      boosts: fakeChain({
        data: [{ id: 'b-pending', status: 'pending', created_at: new Date().toISOString() }],
        error: null,
      }),
    });

    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(initiateBody());

    expect(res.status).toBe(409);
  });

  it('succès : crée FedaPay, le ledger et la campagne pending', async () => {
    const generateToken = vi.fn().mockResolvedValue({ url: 'https://process.fedapay.com/tok' });
    vi.mocked(Transaction.create).mockResolvedValue({ id: 777, generateToken } as never);

    const liveCheck = fakeChain({ data: [], error: null });
    const insertChain = fakeChain({ data: { id: 'boost-new' }, error: null });
    stubTables({
      // 1er appel : vérification des campagnes en cours (aucune),
      // 2e appel : insertion de la campagne.
      boosts: [liveCheck, insertChain],
    });

    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(initiateBody());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      transaction_id: 777,
      payment_url: 'https://process.fedapay.com/tok',
      boost_id: 'boost-new',
    });
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3000,
        metadata: expect.objectContaining({ type: 'boost', clerk_user_id: 'user_1' }),
      })
    );
    expect(transactions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'boost', status: 'pending', amount: 3000 }),
      { onConflict: 'fedapay_transaction_id' }
    );
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', budget_total: 3000, room_id: 'room-1' })
    );
  });

  it('400 si l\'email du gérant est invalide', async () => {
    gerants = fakeChain({ data: { ...verifiedGerant, email: 'pas-un-email' }, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/boosts/initiate')
      .set('Authorization', clerkBearer('user_1'))
      .send(initiateBody());

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Email');
  });
});

describe('POST /api/boosts/confirm', () => {
  it('400 si la transaction n\'est pas de type boost', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(
      fedapayBoostTransaction({ metadata: { clerk_user_id: 'user_1', market: 'CI', type: 'premium' } }) as never
    );

    const res = await request(app)
      .post('/api/boosts/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 555 });

    expect(res.status).toBe(400);
  });

  it('403 si la transaction appartient à un autre gérant', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(fedapayBoostTransaction() as never);

    const res = await request(app)
      .post('/api/boosts/confirm')
      .set('Authorization', clerkBearer('user_2'))
      .send({ transaction_id: 555 });

    expect(res.status).toBe(403);
  });

  it('400 si le montant ne correspond à aucun budget', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(fedapayBoostTransaction({ amount: 1234 }) as never);

    const res = await request(app)
      .post('/api/boosts/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 555 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Montant');
  });

  it('400 avec status si le paiement est encore en attente', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(fedapayBoostTransaction({ status: 'pending' }) as never);

    const res = await request(app)
      .post('/api/boosts/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 555 });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('pending');
  });

  it('paiement refusé : la campagne est annulée', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(fedapayBoostTransaction({ status: 'declined' }) as never);
    const cancelChain = fakeChain({ data: [], error: null });
    stubTables({ boosts: cancelChain });

    const res = await request(app)
      .post('/api/boosts/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 555 });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('declined');
    expect(cancelChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' })
    );
  });

  it('succès : claim la transaction et renvoie la campagne active', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(fedapayBoostTransaction() as never);
    mockRpc({
      data: [{ already_activated: false, boost_id: BOOST_UUID }],
      error: null,
    });
    stubTables({
      boosts: fakeChain({
        data: { ...activeBoostRow, id: BOOST_UUID, status: 'active' },
        error: null,
      }),
    });

    const res = await request(app)
      .post('/api/boosts/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 555 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.already_activated).toBe(false);
    expect(res.body.boost.id).toBe(BOOST_UUID);
    expect(res.body.boost.display_status).toBe('live');
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('activate_boost_checked', {
      p_transaction_id: 'pt-1',
    });
  });

  it('409 si la campagne a été remplacée (BOOST_NOT_FOUND)', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(fedapayBoostTransaction() as never);
    mockRpc({
      data: null,
      error: { message: 'BOOST_NOT_FOUND' },
    });

    const res = await request(app)
      .post('/api/boosts/confirm')
      .set('Authorization', clerkBearer('user_1'))
      .send({ transaction_id: 555 });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/boosts/mine', () => {
  it('liste les campagnes du gérant avec état dérivé', async () => {
    stubTables({
      boosts: [
        // 1. rattrapage : aucune campagne en attente
        fakeChain({ data: [], error: null }),
        // 2. liste
        fakeChain({ data: [activeBoostRow], error: null }),
      ],
    });

    const res = await request(app).get('/api/boosts/mine').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: 'b-1',
      display_status: 'live',
      remaining: 900,
      status: 'active',
    });
    expect(Transaction.retrieve).not.toHaveBeenCalled();
  });

  it('rattrape un paiement approuvé non webhooké', async () => {
    vi.mocked(Transaction.retrieve).mockResolvedValue(fedapayBoostTransaction({ status: 'approved' }) as never);
    mockRpc({
      data: [{ already_activated: false, boost_id: BOOST_UUID }],
      error: null,
    });

    const pendingRow = {
      id: 'b-pending',
      market: 'CI',
      transaction_id: 'tx-uuid-1',
      transaction: { id: 'pt-1', fedapay_transaction_id: 777, status: 'pending' },
    };
    stubTables({
      boosts: [
        fakeChain({ data: [pendingRow], error: null }),
        fakeChain({ data: [], error: null }),
      ],
    });

    const res = await request(app).get('/api/boosts/mine').set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(Transaction.retrieve).toHaveBeenCalledWith(777);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('activate_boost_checked', {
      p_transaction_id: 'pt-1',
    });
  });
});

describe('PATCH /api/boosts/:id/schedule', () => {
  const scheduleBody = {
    starts_at: new Date().toISOString(),
    ends_at: FUTURE_END,
  };

  it('404 si la campagne n\'existe pas', async () => {
    stubTables({ boosts: fakeChain({ data: null, error: null }) });
    const res = await request(app)
      .patch(`/api/boosts/${BOOST_UUID}/schedule`)
      .set('Authorization', clerkBearer('user_1'))
      .send(scheduleBody);
    expect(res.status).toBe(404);
  });

  it('403 si la campagne appartient à un autre gérant', async () => {
    stubTables({
      boosts: fakeChain({
        data: { ...activeBoostRow, gerant_id: 'user_autre' },
        error: null,
      }),
    });
    const res = await request(app)
      .patch(`/api/boosts/${BOOST_UUID}/schedule`)
      .set('Authorization', clerkBearer('user_1'))
      .send(scheduleBody);
    expect(res.status).toBe(403);
  });

  it('409 si la campagne est épuisée', async () => {
    stubTables({
      boosts: fakeChain({
        data: { ...activeBoostRow, status: 'exhausted', spent: 1000, budget_total: 1000 },
        error: null,
      }),
    });
    const res = await request(app)
      .patch(`/api/boosts/${BOOST_UUID}/schedule`)
      .set('Authorization', clerkBearer('user_1'))
      .send(scheduleBody);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('épuisé');
  });

  it('409 si la campagne est encore en attente de paiement', async () => {
    stubTables({
      boosts: fakeChain({ data: { ...activeBoostRow, status: 'pending' }, error: null }),
    });
    const res = await request(app)
      .patch(`/api/boosts/${BOOST_UUID}/schedule`)
      .set('Authorization', clerkBearer('user_1'))
      .send(scheduleBody);
    expect(res.status).toBe(409);
  });

  it('reprogramme le solde restant sans repayer', async () => {
    const fetchChain = fakeChain({ data: { ...activeBoostRow, id: BOOST_UUID }, error: null });
    const updateChain = fakeChain({ data: { ...activeBoostRow, ...scheduleBody, id: BOOST_UUID }, error: null });
    stubTables({ boosts: [fetchChain, updateChain] });

    const res = await request(app)
      .patch(`/api/boosts/${BOOST_UUID}/schedule`)
      .set('Authorization', clerkBearer('user_1'))
      .send(scheduleBody);

    expect(res.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        starts_at: scheduleBody.starts_at,
        ends_at: scheduleBody.ends_at,
      })
    );
    expect(res.body.boost.id).toBe(BOOST_UUID);
  });
});
