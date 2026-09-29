import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fedapayMock = vi.hoisted(() => ({
  setApiKey: vi.fn(),
  setEnvironment: vi.fn(),
  setAccountId: vi.fn(),
}));

vi.mock('fedapay', () => ({ FedaPay: fedapayMock }));

/**
 * Réévalue le module de configuration (et ses dépendances) : les appels à
 * FedaPay ne sont exécutés qu'à l'import, chaque scénario doit donc repartir
 * d'un module vierge.
 */
async function importFedapayConfig(): Promise<void> {
  vi.resetModules();
  await import('./fedapay');
}

describe('config/fedapay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('FEDAPAY_ENV', 'live');
    vi.stubEnv('FEDAPAY_PUBLIC_KEY', 'pk_test_public');
    vi.stubEnv('FEDAPAY_SECRET_KEY', 'sk_test_secret');
    vi.stubEnv('FEDAPAY_ACCOUNT_ID', '');
    vi.stubEnv('FEDAPAY_TIMEOUT_MS', '15000');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('applique la clé secrète et bascule en environnement live', async () => {
    await importFedapayConfig();

    expect(fedapayMock.setApiKey).toHaveBeenCalledWith('sk_test_secret');
    expect(fedapayMock.setEnvironment).toHaveBeenCalledWith('live');
    expect(fedapayMock.setAccountId).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('avertit quand les clés manquent mais configure tout de même l’environnement', async () => {
    vi.stubEnv('FEDAPAY_PUBLIC_KEY', '');
    vi.stubEnv('FEDAPAY_SECRET_KEY', '');

    await importFedapayConfig();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[fedapay]'));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('FEDAPAY_PUBLIC_KEY ou FEDAPAY_SECRET_KEY manquant'),
    );
    expect(fedapayMock.setApiKey).not.toHaveBeenCalled();
    expect(fedapayMock.setEnvironment).toHaveBeenCalledWith('live');
  });

  it('passe en sandbox quand FEDAPAY_ENV vaut sandbox', async () => {
    vi.stubEnv('FEDAPAY_ENV', 'sandbox');

    await importFedapayConfig();

    expect(fedapayMock.setEnvironment).toHaveBeenCalledWith('sandbox');
  });

  it('traite production comme live', async () => {
    vi.stubEnv('FEDAPAY_ENV', 'production');

    await importFedapayConfig();

    expect(fedapayMock.setEnvironment).toHaveBeenCalledWith('live');
  });

  it('normalise la casse de FEDAPAY_ENV', async () => {
    vi.stubEnv('FEDAPAY_ENV', 'SANDBOX');

    await importFedapayConfig();

    expect(fedapayMock.setEnvironment).toHaveBeenCalledWith('sandbox');
  });

  it('mappe une valeur inconnue de FEDAPAY_ENV sur sandbox', async () => {
    vi.stubEnv('FEDAPAY_ENV', 'recette');

    await importFedapayConfig();

    expect(fedapayMock.setEnvironment).toHaveBeenCalledWith('sandbox');
  });

  it('renseigne l’identifiant de compte seulement s’il est présent', async () => {
    vi.stubEnv('FEDAPAY_ACCOUNT_ID', 'acc_123');

    await importFedapayConfig();

    expect(fedapayMock.setAccountId).toHaveBeenCalledWith('acc_123');
  });

  it('applique le timeout axios (patchAxiosTimeout) à l’import', async () => {
    await importFedapayConfig();
    const axiosModule = await import('axios');

    expect(axiosModule.default.defaults.timeout).toBe(15000);
  });
});
