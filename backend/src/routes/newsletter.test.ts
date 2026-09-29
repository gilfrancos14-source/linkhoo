import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import newsletterRouter from './newsletter';
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

const app = buildTestApp('/api/newsletter', newsletterRouter);

let subscribers: FakeChain;

beforeEach(() => {
  vi.clearAllMocks();
  subscribers = fakeChain({ data: null, error: null });
  useSupabaseTables(supabaseAdmin.from, { newsletter_subscribers: subscribers });
});

describe('POST /api/newsletter', () => {
  it('400 sur une adresse email invalide', async () => {
    const res = await request(app).post('/api/newsletter').send({ email: 'pas-un-email' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Adresse email invalide' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('400 sur un champ inconnu (strict)', async () => {
    const res = await request(app)
      .post('/api/newsletter')
      .send({ email: 'lecteur@exemple.ci', source: 'pied-de-page' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Adresse email invalide' });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('201 : insère le nouvel abonné avec son marché', async () => {
    const fetchChain = fakeChain({ data: null, error: null });
    const insertChain = fakeChain({
      data: { id: 'n1', email: 'lecteur@exemple.ci', created_at: '2026-09-28' },
      error: null,
    });
    useSupabaseTables(supabaseAdmin.from, {
      newsletter_subscribers: [fetchChain, insertChain],
    });

    const res = await request(app)
      .post('/api/newsletter')
      .send({ email: 'LECTEUR@Exemple.ci', market: 'CI' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'n1', email: 'lecteur@exemple.ci', created_at: '2026-09-28' });
    expect(fetchChain.maybeSingle).toHaveBeenCalled();
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        email: 'lecteur@exemple.ci',
        market: 'CI',
        source: 'footer',
      }),
    );
  });

  it('201 : insère un abonné sans marché', async () => {
    const insertChain = fakeChain({
      data: { id: 'n2', email: 'lecteur@exemple.ci', created_at: '2026-09-28' },
      error: null,
    });
    useSupabaseTables(supabaseAdmin.from, {
      newsletter_subscribers: [fakeChain({ data: null, error: null }), insertChain],
    });

    const res = await request(app).post('/api/newsletter').send({ email: 'lecteur@exemple.ci' });

    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'lecteur@exemple.ci', market: null }),
    );
  });

  it('200 : répond « déjà inscrit » si l’abonnement est actif', async () => {
    const fetchChain = fakeChain({ data: { id: 'n1', unsubscribed_at: null }, error: null });
    useSupabaseTables(supabaseAdmin.from, { newsletter_subscribers: fetchChain });

    const res = await request(app).post('/api/newsletter').send({ email: 'lecteur@exemple.ci' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Vous êtes déjà inscrit.' });
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('200 : réactive l’abonnement d’un ancien désinscrit', async () => {
    const updateChain = fakeChain({ data: null, error: null });
    useSupabaseTables(supabaseAdmin.from, {
      newsletter_subscribers: [
        fakeChain({ data: { id: 'n1', unsubscribed_at: '2026-01-02' }, error: null }),
        updateChain,
      ],
    });

    const res = await request(app)
      .post('/api/newsletter')
      .send({ email: 'lecteur@exemple.ci', market: 'BJ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Merci ! Vous recevrez nos prochaines offres.' });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        unsubscribed_at: null,
        market: 'BJ',
        consent_at: expect.any(String),
      }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'n1');
  });

  it('200 : convertit la violation d’unicité en abonnement déjà existant', async () => {
    const insertChain = fakeChain({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    useSupabaseTables(supabaseAdmin.from, {
      newsletter_subscribers: [fakeChain({ data: null, error: null }), insertChain],
    });

    const res = await request(app).post('/api/newsletter').send({ email: 'lecteur@exemple.ci' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Vous êtes déjà inscrit.' });
  });

  it('500 quand la lecture initiale échoue', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      newsletter_subscribers: fakeChain({ data: null, error: { message: 'boom' } }),
    });

    const res = await request(app).post('/api/newsletter').send({ email: 'lecteur@exemple.ci' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });

  it('500 quand l’insertion échoue pour une autre raison', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      newsletter_subscribers: [
        fakeChain({ data: null, error: null }),
        fakeChain({ data: null, error: { code: 'XX000', message: 'boom' } }),
      ],
    });

    const res = await request(app).post('/api/newsletter').send({ email: 'lecteur@exemple.ci' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });

  it('500 quand la réactivation échoue', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      newsletter_subscribers: [
        fakeChain({ data: { id: 'n1', unsubscribed_at: '2026-01-02' }, error: null }),
        fakeChain({ data: null, error: { message: 'boom' } }),
      ],
    });

    const res = await request(app).post('/api/newsletter').send({ email: 'lecteur@exemple.ci' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });
  });

  it('429 : bloqué une fois la limite d’écritures atteinte', async () => {
    // Le limiteur de ce routeur n'autorise que 10 écritures par tranche de
    // 15 minutes : les tests précédents ont consommé la totalité du quota.
    let dernier = 0;
    for (let tentative = 0; tentative < 3; tentative += 1) {
      const res = await request(app).post('/api/newsletter').send({ email: 'quota@exemple.ci' });
      dernier = res.status;
      if (res.status === 429) break;
    }

    expect(dernier).toBe(429);
  });
});
