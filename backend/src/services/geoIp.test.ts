import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { clientIp, lookupCountry, marketFromRequest } from './geoIp';

function reqWithIp(ip: string): Request {
  return { ip, socket: { remoteAddress: ip } } as unknown as Request;
}

describe('geoIp', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignore les IP privées et locales', () => {
    expect(clientIp(reqWithIp('127.0.0.1'))).toBeNull();
    expect(clientIp(reqWithIp('::1'))).toBeNull();
    expect(clientIp(reqWithIp('192.168.1.4'))).toBeNull();
    expect(clientIp(reqWithIp('10.0.0.2'))).toBeNull();
  });

  it('nettoie le préfixe IPv4-mappé IPv6', () => {
    expect(clientIp(reqWithIp('::ffff:123.45.67.89'))).toBe('123.45.67.89');
  });

  it('résout le pays via ipwho.is puis le marché', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, country_code: 'ci' }),
    });

    const country = await lookupCountry('123.45.67.89');
    const result = await marketFromRequest(reqWithIp('123.45.67.89'));

    expect(country).toBe('CI');
    expect(result).toEqual({ countryCode: 'CI', market: 'CI' });
  });

  it('ne renvoie aucun marché pour un pays non couvert', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, country_code: 'US' }),
    });

    expect(await marketFromRequest(reqWithIp('8.8.8.8'))).toEqual({
      countryCode: 'US',
      market: null,
    });
  });

  it('ne bloque pas si le service est indisponible', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    expect(await lookupCountry('123.45.67.99')).toBeNull();
    expect(await marketFromRequest(reqWithIp('123.45.67.99'))).toEqual({
      countryCode: null,
      market: null,
    });
  });
});
