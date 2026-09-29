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

describe('config/supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SUPABASE_URL', SUPABASE_URL);
    vi.stubEnv('SUPABASE_ANON_KEY', ANON_KEY);
    vi.stubEnv('SUPABASE_SERVICE_KEY', SERVICE_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('crée le client public avec la clé anon et sans persistance de session', async () => {
    await importSupabaseConfig();

    expect(createClientMock).toHaveBeenCalledWith(SUPABASE_URL, ANON_KEY, {
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
      'SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY are required',
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('refuse de se monter sans SUPABASE_ANON_KEY', async () => {
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    await expect(importSupabaseConfig()).rejects.toThrow(
      'SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY are required',
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('refuse de se monter sans SUPABASE_SERVICE_KEY', async () => {
    vi.stubEnv('SUPABASE_SERVICE_KEY', '');

    await expect(importSupabaseConfig()).rejects.toThrow(
      'SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY are required',
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
