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
  nom: 'Diop',
  prenom: 'Awa',
  email: 'awa@exemple.ci',
  telephone: '+221 77 123 45 67',
  pays: 'Sénégal',
  sujet: 'reservation',
  message: 'Bonjour, je souhaite réserver une chambre pour mars.',
  market: 'CI',
};

let messages: FakeChain;

beforeEach(() => {
  vi.clearAllMocks();
  messages = fakeChain({ data: null, error: null });
  useSupabaseTables(supabaseAdmin.from, { contact_messages: messages });
});

// Fichier réservé aux cas « nominaux » : le routeur n'autorise que 5
// requêtes par IP et par tranche de 15 minutes, tous tests confondus.
describe('POST /api/contact', () => {
  it('400 sur une adresse email invalide', async () => {
    const res = await request(app).post('/api/contact').send({ ...payloadValide, email: 'pas-un-email' });

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it('400 sur un pays hors liste (strict)', async () => {
    const res = await request(app).post('/api/contact').send({ ...payloadValide, pays: 'France' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Pays invalide.' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un message trop court', async () => {
    const res = await request(app).post('/api/contact').send({ ...payloadValide, message: 'Court' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Le message doit contenir au moins 10 caractères.' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('201 silencieux sur le pot de miel : ni écriture ni envoi', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...payloadValide, website: 'https://spam.example' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Votre message a bien été envoyé.' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it('201 : enregistre en pending, envoie le mail puis passe en sent', async () => {
    const insertChain = fakeChain({ data: null, error: null });
    const updateChain = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, { contact_messages: [insertChain, updateChain] });

    const res = await request(app).post('/api/contact').send(payloadValide);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: 'Votre message a bien été envoyé.',
      id: expect.any(String),
    });
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        nom: 'Diop',
        prenom: 'Awa',
        email: 'awa@exemple.ci',
        pays: 'Sénégal',
        sujet: 'reservation',
        message: payloadValide.message,
        market: 'CI',
        status: 'pending',
      }),
    );
    expect(sendContactEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'awa@exemple.ci', pays: 'Sénégal', sujet: 'reservation' }),
    );
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', sent_at: expect.any(String) }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', expect.any(String));
  });
});
