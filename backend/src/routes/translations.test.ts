import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import translationsRouter from './translations';
import { supabaseAdmin } from '../config/supabase';
import { buildTestApp, fakeChain, useSupabaseTables } from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

const app = buildTestApp('/api/translations', translationsRouter);

const validReport = {
  entityType: 'room',
  entityId: 'r1',
  locale: 'en',
  field: 'title',
  value: 'Corrected title',
};

beforeEach(() => {
  vi.clearAllMocks();
  useSupabaseTables(supabaseAdmin.from, {
    translations: fakeChain({ data: null, error: null }),
  });
});

describe('POST /api/translations/report', () => {
  it('204 : enregistre la correction', async () => {
    const res = await request(app).post('/api/translations/report').send(validReport);
    expect(res.status).toBe(204);
    expect(supabaseAdmin.from).toHaveBeenCalledWith('translations');
  });

  it('400 sur un signalement invalide', async () => {
    const res = await request(app)
      .post('/api/translations/report')
      .send({ ...validReport, locale: 'de' });
    expect(res.status).toBe(400);
  });
});
