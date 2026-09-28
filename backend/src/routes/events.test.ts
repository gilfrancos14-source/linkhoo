import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import eventsRouter from './events';
import { supabaseAdmin, supabasePublic } from '../config/supabase';

vi.hoisted(() => {
  process.env.ADMIN_JWT_SECRET = 'secret-de-test';
});

vi.mock('../config/supabase', () => ({
  supabasePublic: { from: vi.fn() },
  supabaseAdmin: { from: vi.fn() },
}));

type AnyFn = ReturnType<typeof vi.fn>;

interface FakeChain {
  select: AnyFn;
  eq: AnyFn;
  gte: AnyFn;
  order: AnyFn;
  insert: AnyFn;
  update: AnyFn;
  delete: AnyFn;
  single: AnyFn;
  maybeSingle: AnyFn;
  then: (onFulfilled: unknown, onRejected: unknown) => Promise<unknown>;
}

function fakeChain(result: { data?: unknown; error?: unknown }): FakeChain {
  const chain = {} as FakeChain;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(
      onFulfilled as (value: unknown) => unknown,
      onRejected as (reason: unknown) => unknown,
    );
  return chain;
}

const adminToken = () =>
  jwt.sign({ adminId: 'admin-1', email: 'admin@test.ci' }, process.env.ADMIN_JWT_SECRET!, {
    expiresIn: '1h',
  });

const validEvent = {
  market: 'CI',
  city: 'Abidjan',
  title: 'Salon immobilier',
  description: '',
  event_date: '2099-10-12',
  img: 'https://cdn.example.com/e.webp',
  alt: 'Stand',
};

let publicChain: FakeChain;
let adminChain: FakeChain;

const app = express();
app.use(express.json());
app.use('/api/events', eventsRouter);
app.use(
  (_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'internal' });
  },
);

beforeEach(() => {
  vi.clearAllMocks();
  publicChain = fakeChain({ data: [], error: null });
  adminChain = fakeChain({ data: null, error: null });
  vi.mocked(supabasePublic.from).mockReturnValue(publicChain as never);
  vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);
});

describe('GET /api/events', () => {
  it('400 sans market (villes CI/BJ mélangées)', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(400);
  });

  it('filtre les événements passés de plus de 7 jours pour le public', async () => {
    const res = await request(app).get('/api/events?market=CI');
    expect(res.status).toBe(200);

    const expectedCutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    expect(publicChain.gte).toHaveBeenCalledWith('event_date', expectedCutoff);
  });

  it('401 sur include_past=1 sans token admin', async () => {
    const res = await request(app).get('/api/events?market=CI&include_past=1');
    expect(res.status).toBe(401);
    expect(publicChain.gte).not.toHaveBeenCalled();
  });

  it('200 sur include_past=1 avec un token admin valide, sans filtre de date', async () => {
    const res = await request(app)
      .get('/api/events?market=CI&include_past=1')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(publicChain.gte).not.toHaveBeenCalled();
  });

  it('400 sur un paramètre inconnu', async () => {
    const res = await request(app).get('/api/events?market=CI&tri=date');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/events', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).post('/api/events').send(validEvent);
    expect(res.status).toBe(401);
  });

  it('400 sur un corps invalide même avec un token', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...validEvent, market: 'TG' });
    expect(res.status).toBe(400);
  });

  it('201 et insertion avec un id généré', async () => {
    adminChain = fakeChain({ data: { id: 'nouvel-id', ...validEvent }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validEvent);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('nouvel-id');
    expect(adminChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String), title: 'Salon immobilier' }),
    );
  });
});

describe('PUT /api/events/:id', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).put('/api/events/abc').send({ title: 'X' });
    expect(res.status).toBe(401);
  });

  it('400 sur un corps vide (mise à jour sans effet)', async () => {
    const res = await request(app)
      .put('/api/events/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('404 quand l’événement n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .put('/api/events/inconnu')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ title: 'X' });

    expect(res.status).toBe(404);
  });

  it('200 sur une mise à jour valide', async () => {
    adminChain = fakeChain({ data: { id: 'abc', title: 'X' }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .put('/api/events/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ title: 'X' });

    expect(res.status).toBe(200);
    expect(adminChain.update).toHaveBeenCalledWith({ title: 'X' });
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'abc');
  });
});

describe('DELETE /api/events/:id', () => {
  it('401 sans token admin', async () => {
    const res = await request(app).delete('/api/events/abc');
    expect(res.status).toBe(401);
  });

  it('404 quand l’événement n’existe pas', async () => {
    adminChain = fakeChain({ data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .delete('/api/events/inconnu')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

  it('204 sur une suppression valide', async () => {
    adminChain = fakeChain({ data: { id: 'abc' }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(adminChain as never);

    const res = await request(app)
      .delete('/api/events/abc')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(204);
    expect(adminChain.delete).toHaveBeenCalled();
    expect(adminChain.eq).toHaveBeenCalledWith('id', 'abc');
  });
});
