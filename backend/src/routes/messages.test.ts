import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messagesRouter from './messages';
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

const app = buildTestApp('/api/messages', messagesRouter);

type ChainOrQueue = FakeChain | FakeChain[];

let clients: ChainOrQueue;
let gerants: ChainOrQueue;
let rooms: ChainOrQueue;
let conversations: ChainOrQueue;
let messages: ChainOrQueue;

type TableName = 'clients' | 'gerants' | 'rooms' | 'conversations' | 'messages';

function stubTables(tables: Partial<Record<TableName, ChainOrQueue>> = {}): void {
  useSupabaseTables(supabaseAdmin.from, {
    clients,
    gerants,
    rooms,
    conversations,
    messages,
    ...tables,
  });
}

const clientRow = {
  id: 'client-uuid-1',
  email: 'jean@example.ci',
  nom: 'Kouassi',
  prenom: 'Jean',
};

const conversationRow = {
  id: 'conv-1',
  room_id: 'room-1',
  client_id: 'user_client',
  gerant_id: 'user_gerant',
  client_name: 'Jean Kouassi',
  client_email: 'jean@example.ci',
  last_message_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

function stubInboxRpc(data: unknown): void {
  vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data, error: null } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  clients = fakeChain({ data: null, error: null });
  gerants = fakeChain({ data: null, error: null });
  rooms = fakeChain({ data: null, error: null });
  conversations = fakeChain({ data: null, error: null });
  messages = fakeChain({ data: null, error: null });
  stubTables();
});

describe('GET /api/messages/conversations', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/messages/conversations');
    expect(res.status).toBe(401);
  });

  it('403 sans profil client', async () => {
    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', clerkBearer('user_client'));
    expect(res.status).toBe(403);
  });

  it('200 : délègue au RPC messages_inbox côté client', async () => {
    clients = fakeChain({ data: { id: 'client-uuid-1' }, error: null });
    const page = { items: [conversationRow], total: 1, page: 1, limit: 30 };
    stubTables();
    stubInboxRpc(page);

    const res = await request(app)
      .get('/api/messages/conversations?page=1')
      .set('Authorization', clerkBearer('user_client'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(page);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('messages_inbox', {
      p_clerk_user_id: 'user_client',
      p_side: 'client',
      p_page: 1,
      p_limit: 30,
    });
  });

  it('400 sur des paramètres invalides', async () => {
    clients = fakeChain({ data: { id: 'client-uuid-1' }, error: null });
    stubTables();

    const res = await request(app)
      .get('/api/messages/conversations?page=0')
      .set('Authorization', clerkBearer('user_client'));
    expect(res.status).toBe(400);
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });
});

describe('GET /api/messages/gerant/conversations', () => {
  it('403 pour un client (pas de profil gérant)', async () => {
    const res = await request(app)
      .get('/api/messages/gerant/conversations')
      .set('Authorization', clerkBearer('user_client'));
    expect(res.status).toBe(403);
  });

  it('200 : délègue au RPC avec p_side gerant, sans gate premium', async () => {
    gerants = fakeChain({ data: { id: 'gerant-uuid-1' }, error: null });
    const page = { items: [], total: 0, page: 1, limit: 30 };
    stubTables();
    stubInboxRpc(page);

    const res = await request(app)
      .get('/api/messages/gerant/conversations')
      .set('Authorization', clerkBearer('user_gerant'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(page);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('messages_inbox', {
      p_clerk_user_id: 'user_gerant',
      p_side: 'gerant',
      p_page: 1,
      p_limit: 30,
    });
  });
});

describe('GET /api/messages/unread', () => {
  it("403 sans profil client (jeton gérant)", async () => {
    const res = await request(app)
      .get('/api/messages/unread')
      .set('Authorization', clerkBearer('user_gerant'));
    expect(res.status).toBe(403);
  });

  it('200 : renvoie le compteur non lu du client', async () => {
    clients = fakeChain({ data: { id: 'client-uuid-1' }, error: null });
    stubTables();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: 3, error: null } as never);

    const res = await request(app)
      .get('/api/messages/unread')
      .set('Authorization', clerkBearer('user_client'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 3 });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('messages_unread_total', {
      p_clerk_user_id: 'user_client',
      p_side: 'client',
    });
  });
});

describe('GET /api/messages/gerant/unread', () => {
  it('403 pour un client (pas de profil gérant)', async () => {
    const res = await request(app)
      .get('/api/messages/gerant/unread')
      .set('Authorization', clerkBearer('user_client'));
    expect(res.status).toBe(403);
  });

  it('200 : renvoie le compteur non lu du gérant', async () => {
    gerants = fakeChain({ data: { id: 'gerant-uuid-1' }, error: null });
    stubTables();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: 0, error: null } as never);

    const res = await request(app)
      .get('/api/messages/gerant/unread')
      .set('Authorization', clerkBearer('user_gerant'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0 });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('messages_unread_total', {
      p_clerk_user_id: 'user_gerant',
      p_side: 'gerant',
    });
  });
});

describe('POST /api/messages/conversations', () => {
  it('400 sur un body invalide', async () => {
    clients = fakeChain({ data: clientRow, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', clerkBearer('user_client'))
      .send({});
    expect(res.status).toBe(400);
  });

  it("404 quand la chambre n'existe pas", async () => {
    clients = [fakeChain({ data: clientRow }), fakeChain({ data: clientRow })];
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', clerkBearer('user_client'))
      .send({ room_id: 'room-x' });
    expect(res.status).toBe(404);
  });

  it("400 quand la chambre n'a pas de gérant", async () => {
    clients = [fakeChain({ data: clientRow }), fakeChain({ data: clientRow })];
    rooms = fakeChain({ data: { id: 'room-1', gerant_id: null }, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', clerkBearer('user_client'))
      .send({ room_id: 'room-1' });
    expect(res.status).toBe(400);
  });

  it("403 quand le gérant de la chambre n'est pas vérifié", async () => {
    clients = [fakeChain({ data: clientRow }), fakeChain({ data: clientRow })];
    rooms = fakeChain({ data: { id: 'room-1', gerant_id: 'user_gerant' }, error: null });
    gerants = fakeChain({ data: { is_verified: false }, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', clerkBearer('user_client'))
      .send({ room_id: 'room-1' });
    expect(res.status).toBe(403);
  });

  it('200 : renvoie la conversation existante sans réinsérer', async () => {
    const existing = fakeChain({ data: conversationRow, error: null });
    clients = [fakeChain({ data: clientRow }), fakeChain({ data: clientRow })];
    rooms = fakeChain({ data: { id: 'room-1', gerant_id: 'user_gerant' }, error: null });
    gerants = fakeChain({ data: { is_verified: true }, error: null });
    conversations = existing;
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', clerkBearer('user_client'))
      .send({ room_id: 'room-1' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('conv-1');
    expect(existing.insert).not.toHaveBeenCalled();
  });

  it('201 : crée la conversation (profil + room + insert)', async () => {
    const insertChain = fakeChain({ data: conversationRow, error: null });
    clients = [fakeChain({ data: clientRow }), fakeChain({ data: clientRow })];
    rooms = fakeChain({ data: { id: 'room-1', gerant_id: 'user_gerant' }, error: null });
    gerants = fakeChain({ data: { is_verified: true }, error: null });
    conversations = [fakeChain({ data: null, error: null }), insertChain];
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', clerkBearer('user_client'))
      .send({ room_id: 'room-1' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('conv-1');
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        room_id: 'room-1',
        client_id: 'user_client',
        gerant_id: 'user_gerant',
        client_name: 'Jean Kouassi',
        client_email: 'jean@example.ci',
      }),
    );
  });

  it('200 : la course 23505 renvoie la conversation déjà créée', async () => {
    clients = [fakeChain({ data: clientRow }), fakeChain({ data: clientRow })];
    rooms = fakeChain({ data: { id: 'room-1', gerant_id: 'user_gerant' }, error: null });
    gerants = fakeChain({ data: { is_verified: true }, error: null });
    conversations = [
      fakeChain({ data: null, error: null }),
      fakeChain({ data: null, error: { code: '23505', message: 'duplicate key' } }),
      fakeChain({ data: conversationRow, error: null }),
    ];
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations')
      .set('Authorization', clerkBearer('user_client'))
      .send({ room_id: 'room-1' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('conv-1');
  });
});

describe('GET /api/messages/conversations/:id', () => {
  it("404 si la conversation n'existe pas", async () => {
    const res = await request(app)
      .get('/api/messages/conversations/conv-x')
      .set('Authorization', clerkBearer('user_client'));
    expect(res.status).toBe(404);
  });

  it("404 si l'utilisateur n'est pas participant", async () => {
    conversations = fakeChain({ data: conversationRow, error: null });
    stubTables();

    const res = await request(app)
      .get('/api/messages/conversations/conv-1')
      .set('Authorization', clerkBearer('user_intrus'));
    expect(res.status).toBe(404);
  });

  it('200 : renvoie la conversation + la chambre pour un participant', async () => {
    conversations = fakeChain({ data: conversationRow, error: null });
    rooms = fakeChain({
      data: { id: 'room-1', title: 'Studio Plateau', img: 'a.jpg', market: 'CI' },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .get('/api/messages/conversations/conv-1')
      .set('Authorization', clerkBearer('user_client'));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('conv-1');
    expect(res.body.room.title).toBe('Studio Plateau');
  });
});

describe('GET /api/messages/conversations/:id/messages', () => {
  it('200 : liste paginée du fil', async () => {
    conversations = fakeChain({ data: conversationRow, error: null });
    const rows = [{ id: 'm2', body: 'Bonjour', sender_role: 'client' }];
    messages = fakeChain({ data: rows, error: null });
    stubTables();

    const res = await request(app)
      .get('/api/messages/conversations/conv-1/messages?page=1&limit=50')
      .set('Authorization', clerkBearer('user_client'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
  });

  it('404 pour un non-participant', async () => {
    conversations = fakeChain({ data: conversationRow, error: null });
    stubTables();

    const res = await request(app)
      .get('/api/messages/conversations/conv-1/messages')
      .set('Authorization', clerkBearer('user_intrus'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/messages/conversations/:id/messages', () => {
  it('400 si le corps est vide', async () => {
    const res = await request(app)
      .post('/api/messages/conversations/conv-1/messages')
      .set('Authorization', clerkBearer('user_client'))
      .send({ body: '   ' });
    expect(res.status).toBe(400);
  });

  it('404 pour un non-participant', async () => {
    conversations = fakeChain({ data: conversationRow, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations/conv-1/messages')
      .set('Authorization', clerkBearer('user_intrus'))
      .send({ body: 'Bonjour' });
    expect(res.status).toBe(404);
  });

  it('201 : le client envoie, met à jour last_message_at et notifie le gérant', async () => {
    const updateChain = fakeChain({ data: null, error: null });
    const insertChain = fakeChain({
      data: {
        id: 'm1',
        conversation_id: 'conv-1',
        sender_role: 'client',
        body: 'Bonjour',
        read_at: null,
        created_at: '2026-02-01T10:00:00Z',
      },
      error: null,
    });
    conversations = [fakeChain({ data: conversationRow, error: null }), updateChain];
    messages = insertChain;
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations/conv-1/messages')
      .set('Authorization', clerkBearer('user_client'))
      .send({ body: 'Bonjour' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('m1');
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        sender_role: 'client',
        body: 'Bonjour',
      }),
    );
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_message_at: expect.any(String) }),
    );
  });

  it('201 : le gérant répond, notification vers le client', async () => {
    conversations = [fakeChain({ data: conversationRow, error: null }), fakeChain({ data: null })];
    messages = fakeChain({
      data: { id: 'm2', sender_role: 'gerant', body: 'Bonjour !' },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations/conv-1/messages')
      .set('Authorization', clerkBearer('user_gerant'))
      .send({ body: 'Bonjour !' });

    expect(res.status).toBe(201);
  });

  it("400 : numéro bloqué quand le gérant n'est pas vérifié", async () => {
    conversations = fakeChain({ data: conversationRow, error: null });
    gerants = fakeChain({ data: { is_verified: false }, error: null });
    messages = fakeChain({ data: null, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations/conv-1/messages')
      .set('Authorization', clerkBearer('user_client'))
      .send({ body: 'Appelez-moi au 07 12 34 56 78' });

    expect(res.status).toBe(400);
    expect(messages.insert).not.toHaveBeenCalled();
  });

  it('201 : numéro autorisé quand le gérant est vérifié', async () => {
    conversations = [
      fakeChain({ data: conversationRow, error: null }),
      fakeChain({ data: null, error: null }),
    ];
    gerants = fakeChain({ data: { is_verified: true }, error: null });
    messages = fakeChain({
      data: { id: 'm3', sender_role: 'client', body: 'Appelez-moi au 07 12 34 56 78' },
      error: null,
    });
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations/conv-1/messages')
      .set('Authorization', clerkBearer('user_client'))
      .send({ body: 'Appelez-moi au 07 12 34 56 78' });

    expect(res.status).toBe(201);
    expect(messages.insert).toHaveBeenCalled();
  });
});

describe('POST /api/messages/conversations/:id/read', () => {
  it('404 pour un non-participant', async () => {
    conversations = fakeChain({ data: conversationRow, error: null });
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations/conv-1/read')
      .set('Authorization', clerkBearer('user_intrus'));
    expect(res.status).toBe(404);
  });

  it('200 : marque les messages reçus comme lus et renvoie le compte', async () => {
    const updateChain = fakeChain({ data: [{ id: 'm9' }], error: null });
    conversations = fakeChain({ data: conversationRow, error: null });
    messages = updateChain;
    stubTables();

    const res = await request(app)
      .post('/api/messages/conversations/conv-1/read')
      .set('Authorization', clerkBearer('user_client'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 1 });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ read_at: expect.any(String) }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('sender_role', 'gerant');
    expect(updateChain.is).toHaveBeenCalledWith('read_at', null);
  });
});
