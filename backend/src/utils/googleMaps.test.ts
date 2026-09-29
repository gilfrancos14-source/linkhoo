import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseGoogleMapsUrl } from './googleMaps';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function redirectResponse(status: number, location?: string): Response {
  return {
    status,
    url: '',
    headers: new Headers(location === undefined ? {} : { location }),
  } as unknown as Response;
}

function finalResponse(url: string): Response {
  return { status: 200, url, headers: new Headers() } as unknown as Response;
}

describe('parseGoogleMapsUrl — liens directs', () => {
  it('extrait les coordonnées d’un lien /maps/@lat,lng', async () => {
    await expect(parseGoogleMapsUrl('https://www.google.com/maps/@48.8584,2.2945,17z')).resolves.toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('extrait les coordonnées d’un lien place avec /@lat,lng', async () => {
    await expect(
      parseGoogleMapsUrl('https://www.google.com/maps/place/Tour-Eiffel/@48.8584,2.2945,17z'),
    ).resolves.toEqual({ lat: 48.8584, lng: 2.2945 });
  });

  it('extrait les coordonnées du motif data=!3d!4d', async () => {
    await expect(parseGoogleMapsUrl('https://maps.google.com/?saddr=!3d48.86!4d2.29')).resolves.toEqual({
      lat: 48.86,
      lng: 2.29,
    });
  });

  it('extrait les coordonnées du paramètre q=', async () => {
    await expect(parseGoogleMapsUrl('https://www.google.com/maps?q=5.32,-4.01')).resolves.toEqual({
      lat: 5.32,
      lng: -4.01,
    });
  });

  it('extrait les coordonnées du paramètre ll=', async () => {
    await expect(parseGoogleMapsUrl('https://www.google.com/maps?ll=6.13,-1.63')).resolves.toEqual({
      lat: 6.13,
      lng: -1.63,
    });
  });

  it('extrait les coordonnées du paramètre center=', async () => {
    await expect(parseGoogleMapsUrl('https://www.google.com/maps?center=6.13,-1.63')).resolves.toEqual({
      lat: 6.13,
      lng: -1.63,
    });
  });

  it('extrait les coordonnées du paramètre viewpoint=', async () => {
    await expect(parseGoogleMapsUrl('https://www.google.com/maps?viewpoint=1.35,103.82')).resolves.toEqual({
      lat: 1.35,
      lng: 103.82,
    });
  });

  it('décode un paramètre q encodé en %2C', async () => {
    await expect(parseGoogleMapsUrl('https://www.google.com/maps?q=48.85%2C2.29')).resolves.toEqual({
      lat: 48.85,
      lng: 2.29,
    });
  });

  it('accepte un lien sans schéma (https:// préfixé)', async () => {
    await expect(parseGoogleMapsUrl('www.google.com/maps/@1.23,4.56')).resolves.toEqual({ lat: 1.23, lng: 4.56 });
  });

  it('ignore les espaces autour du lien', async () => {
    await expect(parseGoogleMapsUrl('  https://www.google.com/maps/@1.23,4.56  ')).resolves.toEqual({
      lat: 1.23,
      lng: 4.56,
    });
  });

  it('accepte un hôte régional google.co.ci', async () => {
    await expect(parseGoogleMapsUrl('https://www.google.co.ci/maps/@5.35,-4.01')).resolves.toEqual({
      lat: 5.35,
      lng: -4.01,
    });
  });

  it('accepte un hôte maps.google.fr', async () => {
    await expect(parseGoogleMapsUrl('https://maps.google.fr/@48.85,2.29')).resolves.toEqual({
      lat: 48.85,
      lng: 2.29,
    });
  });
});

describe('parseGoogleMapsUrl — rejets', () => {
  it('refuse une chaîne vide ou blanche', async () => {
    await expect(parseGoogleMapsUrl('')).resolves.toBeNull();
    await expect(parseGoogleMapsUrl('    ')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un texte qui n’est pas une URL', async () => {
    await expect(parseGoogleMapsUrl('ceci nest pas un lien')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un hôte non-Google même avec des coordonnées', async () => {
    await expect(parseGoogleMapsUrl('https://example.com/maps/@48.85,2.29')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un service Google qui n’est pas Google Maps', async () => {
    await expect(parseGoogleMapsUrl('https://mail.google.com/mail/u/0')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse une recherche Google sans coordonnées exploitables', async () => {
    await expect(parseGoogleMapsUrl('https://www.google.com/search?q=locations')).resolves.toBeNull();
  });

  it('refuse des coordonnées hors bornes (lat > 90)', async () => {
    await expect(parseGoogleMapsUrl('https://www.google.com/maps/@999,12')).resolves.toBeNull();
  });

  it('refuse des coordonnées hors bornes via !3d!4d', async () => {
    await expect(parseGoogleMapsUrl('https://maps.google.com/?saddr=!3d0!4d999')).resolves.toBeNull();
  });
});

describe('parseGoogleMapsUrl — liens courts (redirections manuelles)', () => {
  it('suit les redirections jusqu’à la page finale et en extrait les coordonnées', async () => {
    const target = 'https://www.google.com/maps/place/Tour/@48.8584,2.2945,17z';
    fetchMock
      .mockResolvedValueOnce(redirectResponse(301, target))
      .mockResolvedValueOnce(finalResponse(target));

    await expect(parseGoogleMapsUrl('https://maps.app.goo.gl/abc')).resolves.toEqual({
      lat: 48.8584,
      lng: 2.2945,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://maps.app.goo.gl/abc',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'ilehya-verification/1.0' },
      }),
    );
  });

  it('résout aussi les liens goo.gl', async () => {
    const target = 'https://www.google.com/maps/@-4.01,5.32';
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, target))
      .mockResolvedValueOnce(finalResponse(target));

    await expect(parseGoogleMapsUrl('https://goo.gl/maps/xyz')).resolves.toEqual({ lat: -4.01, lng: 5.32 });
  });

  it('rejette une redirection vers un hôte non-Google (anti-SSRF)', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, 'https://evil.test/@1,2'));

    await expect(parseGoogleMapsUrl('https://maps.app.goo.gl/abc')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejette une page finale dont l’URL n’est plus hébergée par Google', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://www.google.com/ok'))
      .mockResolvedValueOnce(finalResponse('https://evil.test/page'));

    await expect(parseGoogleMapsUrl('https://maps.app.goo.gl/abc')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejette une redirection sans en-tête Location', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302));

    await expect(parseGoogleMapsUrl('https://maps.app.goo.gl/abc')).resolves.toBeNull();
  });

  it('rejette une chaîne de redirections trop longue (au-delà de 5 sauts)', async () => {
    fetchMock.mockImplementation(async () => redirectResponse(301, 'https://www.google.com/redirection'));

    await expect(parseGoogleMapsUrl('https://maps.app.goo.gl/abc')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('rejette un lien court qui aboutit à une page sans coordonnées', async () => {
    fetchMock.mockResolvedValueOnce(finalResponse('https://www.google.com/'));

    await expect(parseGoogleMapsUrl('https://goo.gl/maps/xyz')).resolves.toBeNull();
  });

  it('rejette une redirection dont l’en-tête Location est illisible', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, 'http://'));

    await expect(parseGoogleMapsUrl('https://maps.app.goo.gl/abc')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejette une page finale dont l’URL de réponse est illisible', async () => {
    fetchMock.mockResolvedValueOnce(finalResponse(':::'));

    await expect(parseGoogleMapsUrl('https://goo.gl/maps/xyz')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejette un lien court dont l’échec réseau', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(parseGoogleMapsUrl('https://maps.app.goo.gl/abc')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
