import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import contactRouter from './contact';
import { supabaseAdmin } from '../config/supabase';
import {
  buildTestApp,
  fakeChain,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('../services/mailer', () => ({
  sendContactEmail: vi.fn(async () => undefined),
}));

// Fichier dédié : le limiteur (5 messages / 15 min / IP) est un singleton
// partagé par module, donc isolé ici pour ne pas perturber les autres tests.
const app = buildTestApp('/api/contact', contactRouter);

const payloadValide = {
  nom: 'Test',
  email: 'quota@exemple.ci',
  pays: 'Togo',
  sujet: 'autre',
  message: 'Message de test pour la limite de débit.',
};

let messages: FakeChain;

beforeEach(() => {
  vi.clearAllMocks();
  messages = fakeChain({ data: null, error: null });
  useSupabaseTables(supabaseAdmin.from, { contact_messages: messages });
});

describe('POST /api/contact — limite de débit', () => {
  it('429 une fois la limite de 5 messages par tranche atteinte', async () => {
    let dernier = 0;
    for (let tentative = 0; tentative < 6; tentative += 1) {
      const res = await request(app).post('/api/contact').send(payloadValide);
      dernier = res.status;
      if (res.status === 429) break;
    }

    expect(dernier).toBe(429);
  });
});
