import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import discoverRouter from './discover';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import { marketFromRequest, nearestMarketFromRequest } from '../services/geoIp';
import {
  buildTestApp,
  fakeChain,
  useSupabaseTables,
} from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('../services/geoIp', () => ({
  marketFromRequest: vi.fn(),
  nearestMarketFromRequest: vi.fn(),
}));

const app = buildTestApp('/api/discover', discoverRouter);

const ROOM = {
  id: 'room-1',
  title: 'Studio Cocody',
  img: '/images/room.jpg',
  ville: 'Abidjan',
  market: 'CI',
};

describe('GET /api/discover/local-rooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSupabaseTables(supabasePublic.from, {
      rooms: fakeChain({ data: [ROOM], error: null }),
    });
  });

  it('renvoie une liste vide si le pays est inconnu', async () => {
    vi.mocked(marketFromRequest).mockResolvedValue({ market: null, countryCode: null });

    const res = await request(app).get('/api/discover/local-rooms');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ market: null, rooms: [] });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('renvoie les chambres du marché détecté', async () => {
    vi.mocked(marketFromRequest).mockResolvedValue({ market: 'CI', countryCode: 'CI' });

    const res = await request(app).get('/api/discover/local-rooms?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.market).toBe('CI');
    expect(res.body.rooms).toHaveLength(1);
    expect(res.body.rooms[0].title).toBe('Studio Cocody');
  });

  it('refuse un limit hors bornes', async () => {
    const res = await request(app).get('/api/discover/local-rooms?limit=99');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/discover/neighbor-rooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSupabaseTables(supabasePublic.from, {
      rooms: fakeChain({ data: [ROOM], error: null }),
    });
  });

  it('renvoie les chambres du pays voisin', async () => {
    vi.mocked(nearestMarketFromRequest).mockResolvedValue({
      market: 'BJ',
      ownMarket: 'CI',
    });

    const res = await request(app).get('/api/discover/neighbor-rooms');

    expect(res.status).toBe(200);
    expect(res.body.market).toBe('BJ');
    expect(res.body.rooms).toHaveLength(1);
  });

  it('renvoie une liste vide si aucun voisin n’est trouvé', async () => {
    vi.mocked(nearestMarketFromRequest).mockResolvedValue({
      market: null,
      ownMarket: 'CI',
    });

    const res = await request(app).get('/api/discover/neighbor-rooms');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ market: null, rooms: [] });
  });
});
