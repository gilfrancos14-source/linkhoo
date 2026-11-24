import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/config';
import { clearApiCache } from '../lib/api';
import { maquetteApi } from './maquetteApi';

describe('maquetteApi — propagation de la langue', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    clearApiCache();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await i18n.changeLanguage('fr');
  });

  it('envoie lang=en sur les catégories', async () => {
    await i18n.changeLanguage('en');
    await maquetteApi.categories('CI');

    expect(fetchMock.mock.calls[0][0]).toContain('/api/categories?market=CI&lang=en');
  });

  it('n’envoie pas lang en français', async () => {
    await i18n.changeLanguage('fr');
    await maquetteApi.categories('BJ');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/categories?market=BJ');
  });
});
