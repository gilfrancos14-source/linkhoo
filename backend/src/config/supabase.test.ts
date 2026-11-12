import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.hoisted(() => vi.fn((url: string, key: string, options?: unknown) => ({
  url,
  key,
  options,
  from: vi.fn(),
})));

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

const SUPABASE_URL = 'https://ilehya-test.supabase.co';
const ANON_KEY = 'anon-key-test';
const SERVICE_KEY = 'service-key-test';

/**
 * `config/supabase.ts` lit les variables d'environnement et jette à l'import :
 * chaque scénario repart donc d'un module vierge (resetModules).
 */
async function importSupabaseConfig() {
  vi.resetModules();
  return import('./supabase');
}

describe('config/supabase — pilote PostgreSQL (défaut)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SUPABASE_URL', SUPABASE_URL);
    vi.stubEnv('SUPABASE_ANON_KEY', ANON_KEY);
    vi.stubEnv('SUPABASE_SERVICE_KEY', SERVICE_KEY);
    vi.stubEnv('DATABASE_URL', 'postgresql://ilehya:secret@localhost:5432/ilehya');
    vi.stubEnv('DB_DRIVER', 'postgres');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('n’instancie pas le client supabase-js', async () => {
    const module = await importSupabaseConfig();

    expect(createClientMock).not.toHaveBeenCalled();
    expect(module.supabaseAdmin).toBeDefined();
    expect(module.supabasePublic).toBeDefined();
  });

  it('expose la même surface que supabase-js : from, rpc et storage', async () => {
    const module = await importSupabaseConfig();

    expect(typeof module.supabaseAdmin.from).toBe('function');
    expect(typeof module.supabaseAdmin.rpc).toBe('function');
    expect(typeof module.supabaseAdmin.storage.from).toBe('function');
    // Sans Supabase, les deux exports pointent sur le même adaptateur.
    expect(module.supabasePublic).toBe(module.supabaseAdmin);
  });

  it('expose les buckets de stockage attendus', async () => {
    const module = await importSupabaseConfig();

    expect(() => module.supabaseAdmin.storage.from('images')).not.toThrow();
    expect(() => module.supabaseAdmin.storage.from('verification-docs')).not.toThrow();
    expect(() => module.supabaseAdmin.storage.from('inconnu')).toThrow();
  });
});

describe('config/supabase — pilote Supabase (DB_DRIVER=supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SUPABASE_URL', SUPABASE_URL);
    vi.stubEnv('SUPABASE_ANON_KEY', ANON_KEY);
    vi.stubEnv('SUPABASE_SERVICE_KEY', SERVICE_KEY);
    vi.stubEnv('DB_DRIVER', 'supabase');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('crée le client public avec la clé de service et sans persistance de session', async () => {
    await importSupabaseConfig();

    expect(createClientMock).toHaveBeenCalledWith(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it('crée le client admin avec la clé de service et les mêmes options d’auth', async () => {
    await importSupabaseConfig();

    expect(createClientMock).toHaveBeenCalledWith(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it('exporte deux instances distinctes (public et admin)', async () => {
    const module = await importSupabaseConfig();

    expect(createClientMock).toHaveBeenCalledTimes(2);
    expect(module.supabasePublic).toBeDefined();
    expect(module.supabaseAdmin).toBeDefined();
    expect(module.supabasePublic).not.toBe(module.supabaseAdmin);
  });

  it('refuse de se monter sans SUPABASE_URL', async () => {
    vi.stubEnv('SUPABASE_URL', '');

    await expect(importSupabaseConfig()).rejects.toThrow(
      'SUPABASE_URL and SUPABASE_SERVICE_KEY are required',
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('se monte sans SUPABASE_ANON_KEY : la clé anon n’est plus utilisée', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const module = await importSupabaseConfig();

    expect(createClientMock).toHaveBeenCalledTimes(2);
    expect(createClientMock).toHaveBeenNthCalledWith(1, SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(module.supabasePublic).toBeDefined();
  });

  it('refuse de se monter sans SUPABASE_SERVICE_KEY', async () => {
    vi.stubEnv('SUPABASE_SERVICE_KEY', '');

    await expect(importSupabaseConfig()).rejects.toThrow(
      'SUPABASE_URL and SUPABASE_SERVICE_KEY are required',
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
