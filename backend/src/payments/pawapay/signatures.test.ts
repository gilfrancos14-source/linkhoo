import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSignatureBase,
  parseSignatureInput,
  PawapaySignatureService,
  type PawapayCallbackRequest,
} from './signatures';

const PARAMS =
  '("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="TEST_KEY";created=1714657551;expires=1714657611';

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    privateKey,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

function signedRequest(body: string, privateKey: ReturnType<typeof keyPair>['privateKey']) {
  const contentDigest = `sha-512=:${createHash('sha512').update(body).digest('base64')}:`;
  const headers: Record<string, string | string[] | undefined> = {
    'content-type': 'application/json; charset=UTF-8',
    'content-digest': contentDigest,
    'signature-date': '2024-05-02T16:45:51.131905Z',
  };

  const request: PawapayCallbackRequest = {
    method: 'POST',
    url: 'https://api.example.com/api/webhooks/pawapay',
    headers,
    rawBody: body,
  };

  const entry = parseSignatureInput(`sig-pp=${PARAMS}`)[0];
  const signatureBase = buildSignatureBase(request, entry);
  const signature = sign('sha256', Buffer.from(signatureBase, 'utf8'), privateKey).toString(
    'base64',
  );

  headers['signature-input'] = `sig-pp=${PARAMS}`;
  headers.signature = `sig-pp=:${signature}:`;

  return { request, entry, signatureBase };
}

function serviceFor(publicKeyPem: string) {
  return new PawapaySignatureService({
    now: () => 1_000_000,
    loadPublicKeys: async () => [{ id: 'TEST_KEY', key: publicKeyPem }],
  });
}

describe('buildSignatureBase', () => {
  it('construit la signature base RFC 9421 dans l’ordre des composants', () => {
    const { request, entry } = signedRequest('{}', keyPair().privateKey);
    const base = buildSignatureBase(request, entry);

    const lines = base.split('\n');
    expect(lines[0]).toBe('"@method": POST');
    expect(lines[1]).toBe('"@authority": api.example.com');
    expect(lines[2]).toBe('"@path": /api/webhooks/pawapay');
    expect(lines[6]).toBe(`"@signature-params": ${PARAMS}`);
  });
});

describe('PawapaySignatureService', () => {
  it('accepte une signature ECDSA P-256 valide', async () => {
    const { privateKey, publicKeyPem } = keyPair();
    const { request } = signedRequest(
      JSON.stringify({ depositId: 'd-1', status: 'COMPLETED' }),
      privateKey,
    );

    await expect(serviceFor(publicKeyPem).validateWebhookSignature(request)).resolves.toBeUndefined();
  });

  it('rejette un corps altéré (Content-Digest)', async () => {
    const { privateKey, publicKeyPem } = keyPair();
    const { request } = signedRequest('{"amount":"15"}', privateKey);
    const tampered: PawapayCallbackRequest = { ...request, rawBody: '{"amount":"999"}' };

    await expect(serviceFor(publicKeyPem).validateWebhookSignature(tampered)).rejects.toMatchObject({
      name: 'PawapaySignatureError',
      code: 'CONTENT_DIGEST_MISMATCH',
    });
  });

  it('rejette une signature falsifiée', async () => {
    const { privateKey, publicKeyPem } = keyPair();
    const { request } = signedRequest('{"depositId":"d-1"}', privateKey);
    request.headers.signature = 'sig-pp=:AAAA:';

    await expect(serviceFor(publicKeyPem).validateWebhookSignature(request)).rejects.toMatchObject({
      code: 'SIGNATURE_INVALID',
    });
  });

  it('rejette l’absence des en-têtes de signature', async () => {
    const { publicKeyPem } = keyPair();
    const request: PawapayCallbackRequest = {
      method: 'POST',
      url: 'https://api.example.com/api/webhooks/pawapay',
      headers: { 'content-type': 'application/json' },
      rawBody: '{}',
    };

    await expect(serviceFor(publicKeyPem).validateWebhookSignature(request)).rejects.toMatchObject({
      code: 'SIGNATURE_MISSING',
    });
  });

  it('rafraîchit les clés publiques si le keyid est inconnu (rotation)', async () => {
    const { privateKey, publicKeyPem } = keyPair();
    const { request } = signedRequest('{"depositId":"d-2"}', privateKey);

    const loadPublicKeys = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'TEST_KEY', key: publicKeyPem }]);

    const service = new PawapaySignatureService({ now: () => 1_000_000, loadPublicKeys });

    await expect(service.validateWebhookSignature(request)).resolves.toBeUndefined();
    expect(loadPublicKeys).toHaveBeenCalledTimes(2);
  });
});
