import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import adminRouter from './admin';
import { supabaseAdmin } from '../config/supabase';
import {
  adminToken,
  buildTestApp,
  fakeChain,
  useSupabaseTables,
} from '../testHelpers/supertestApp';

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
  process.env.STORAGE_PUBLIC_BASE_URL = 'https://ilehya.test/media';
});

vi.setConfig({ testTimeout: 20_000 });

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('../i18n/translations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../i18n/translations')>()),
  enqueueTranslations: vi.fn(async () => {}),
}));

const app = buildTestApp('/api/admin', adminRouter);
const AUTH = { Authorization: `Bearer ${adminToken()}` };
const LIMITED_AUTH = {
  Authorization: `Bearer ${adminToken({ adminId: 'admin-2', email: 'limite@test.ci' })}`,
};
const MEDIA = 'https://ilehya.test/media/images';

const payload = {
  title: 'Studio meublé Cocody',
  subtitle: 'Proche des universités',
  info: 'Eau et électricité incluses',
  price: '250 000 FCFA',
  price_num: 250000,
  price_unit: '/ mois',
  img: `${MEDIA}/studio.webp`,
  alt: 'Salon du studio',
  images: [`${MEDIA}/studio-1.webp`],
  description: 'Un studio confortable au cœur de Cocody.',
  capacity: '2 personnes',
  category: 'Studio',
  market: 'CI',
  pays: "Côte d'Ivoire",
  ville: 'Abidjan',
  quartier: 'Cocody',
  chambres: 1,
  douches: 1,
  disponible: true,
  date_dispo: '',
  conditions: 'Séjour minimum de 30 jours',
  equipments: ['wifi', 'climatisation'],
  restauration: 'petit_dejeuner_inclus',
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

describe('POST /api/admin/rooms', () => {
  it('401 sans authentification admin', async () => {
    const res = await request(app).post('/api/admin/rooms').send(payload);
    expect(res.status).toBe(401);
  });

  it('403 pour un admin sans la permission chambres', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      admins: fakeChain({
        data: { id: 'admin-2', email: 'limite@test.ci', is_superadmin: false, permissions: [] },
        error: null,
      }),
    });
    const res = await request(app).post('/api/admin/rooms').set(LIMITED_AUTH).send(payload);
    expect(res.status).toBe(403);
  });

  it('400 pour des données de chambre invalides', async () => {
    useSupabaseTables(supabaseAdmin.from, {});
    const res = await request(app).post('/api/admin/rooms').set(AUTH).send({ ...payload, title: '' });
    expect(res.status).toBe(400);
  });

  it('201 : insère une chambre appartenant au compte admin, avec équipements et restauration', async () => {
    const roomsChain = fakeChain({ data: { id: 'room-1', ...payload }, error: null });
    useSupabaseTables(supabaseAdmin.from, { rooms: roomsChain });

    const res = await request(app).post('/api/admin/rooms').set(AUTH).send(payload);

    expect(res.status).toBe(201);
    const inserted = (roomsChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(inserted).toMatchObject({
      admin_owner_id: 'admin-1',
      is_admin_owned: true,
      market: 'CI',
      title: payload.title,
      equipments: ['wifi', 'climatisation'],
      restauration: 'petit_dejeuner_inclus',
    });
    expect(inserted).not.toHaveProperty('gerantId');
  });

  it('applique les valeurs par défaut des équipements et de la restauration', async () => {
    const roomsChain = fakeChain({ data: { id: 'room-2' }, error: null });
    useSupabaseTables(supabaseAdmin.from, { rooms: roomsChain });
    const { equipments: _e, restauration: _r, ...minimal } = payload;

    const res = await request(app).post('/api/admin/rooms').set(AUTH).send(minimal);

    expect(res.status).toBe(201);
    const inserted = (roomsChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(inserted.equipments).toEqual([]);
    expect(inserted.restauration).toBe('aucune');
  });
});
