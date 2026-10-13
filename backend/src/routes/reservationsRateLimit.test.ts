import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import reservationsRouter from './reservations';
import { supabaseAdmin } from '../config/supabase';
import {
  buildTestApp,
  fakeChain,
  useSupabaseTables,
} from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(),
}));

// Fichier dédié : le limiteur (10 POST / 15 min / IP) est un singleton
// partagé par module, isolé ici pour ne pas perturber les autres tests.
const app = buildTestApp('/api/reservations', reservationsRouter);

const payloadValide = {
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

beforeEach(() => {
  vi.clearAllMocks();
  const rooms = fakeChain({
    data: {
      id: 'room-1',
      disponible: true,
      title: 'Studio Cocody',
      price_num: 5000,
      price_unit: '/ nuit',
      gerant_id: 'user_1',
    },
    error: null,
  });
  useSupabaseTables(supabaseAdmin.from, {
    rooms,
    reservations: fakeChain({ data: null, error: null }),
    notifications: fakeChain({ data: null, error: null }),
  });
  vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
    data: [{ id: 'resa-1', statut: 'en_attente' }],
    error: null,
  } as never);
});

describe('POST /api/reservations — limite de débit', () => {
  it('429 une fois la limite de 10 créations par tranche atteinte', async () => {
    let dernier = 0;
    for (let tentative = 0; tentative < 12; tentative += 1) {
      const res = await request(app).post('/api/reservations').send(payloadValide);
      dernier = res.status;
      if (res.status === 429) break;
    }

    expect(dernier).toBe(429);
  });
});
