import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import contactRouter from './contact';
import { supabaseAdmin } from '../config/supabase';
import { sendContactEmail } from '../services/mailer';
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

const app = buildTestApp('/api/contact', contactRouter);

const payloadValide = {
  nom: 'Kouassi',
  prenom: 'Yao',
  email: 'yao@exemple.ci',
  telephone: '+225 07 11 22 33 44',
  pays: "Côte d'Ivoire",
  sujet: 'partenariat',
  message: "Bonjour, nous aimerions discuter d'un partenariat.",
  market: 'CI',
};

let messages: FakeChain;

beforeEach(() => {
  vi.clearAllMocks();
  messages = fakeChain({ data: null, error: null });
  useSupabaseTables(supabaseAdmin.from, { contact_messages: messages });
});

// Fichier réservé aux chemins d'échec : le routeur n'autorise que 5
// requêtes par IP et par tranche de 15 minutes, tous tests confondus.
describe('POST /api/contact — échecs', () => {
  it('400 sur un champ inconnu (strict)', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...payloadValide, source: 'pied-de-page' });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it('502 quand l\u2019envoi du mail échoue : le message passe en failed', async () => {
    const insertChain = fakeChain({ data: null, error: null });
    const updateChain = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, { contact_messages: [insertChain, updateChain] });
    vi.mocked(sendContactEmail).mockRejectedValueOnce(new Error('Resend a répondu 401'));

    const res = await request(app).post('/api/contact').send(payloadValide);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "L'envoi a échoué. Veuillez réessayer." });
    expect(insertChain.insert).toHaveBeenCalled();
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'Resend a répondu 401' }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', expect.any(String));
  });

  it('500 quand l\u2019enregistrement en base échoue', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      contact_messages: fakeChain({ data: null, error: { message: 'boom' } }),
    });

    const res = await request(app).post('/api/contact').send(payloadValide);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
    expect(sendContactEmail).not.toHaveBeenCalled();
  });
});
