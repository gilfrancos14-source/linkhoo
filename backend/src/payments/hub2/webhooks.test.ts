import { describe, expect, it } from 'vitest';
import {
  Hub2WebhookError,
  computeSignature,
  extractProviderId,
  extractPurchaseReference,
  extractRefundId,
  extractTransferId,
  parseHub2Event,
  parseSignatureHeader,
  verifyHub2Signature,
} from './webhooks';

const SECRET = 'whsec_test_123';
const NOW = 1_700_000_000_000;
const S0 = String(Math.floor(NOW / 1000));
const BODY = JSON.stringify({
  id: 'evt_123',
  type: 'payment_intent.succeeded',
  createdAt: '2026-10-27T10:00:00.000Z',
  data: { id: 'pi_123', purchaseReference: 'PAY-2026-ABC123' },
});

function headerFor(body: string, s0 = S0, secret = SECRET): string {
  return `s1=${computeSignature(secret, s0, body)},s0=${s0}`;
}

function expectWebhookError(fn: () => void, code: string): void {
  try {
    fn();
    throw new Error('une erreur était attendue');
  } catch (error) {
    expect(error).toBeInstanceOf(Hub2WebhookError);
    expect((error as Hub2WebhookError).code).toBe(code);
  }
}

describe('parseSignatureHeader', () => {
  it('extrait s0 et toutes les signatures s1', () => {
    expect(parseSignatureHeader('s1=aaa,s0=123')).toEqual({ s0: '123', signatures: ['aaa'] });
    expect(parseSignatureHeader('s1=aaa,s0=123,s1=bbb').signatures).toEqual(['aaa', 'bbb']);
  });

  it('refuse un en-tête absent ou incomplet', () => {
    expectWebhookError(() => parseSignatureHeader(undefined), 'MISSING_SIGNATURE');
    expectWebhookError(() => parseSignatureHeader(''), 'MISSING_SIGNATURE');
    expectWebhookError(() => parseSignatureHeader('s1=aaa'), 'MALFORMED_SIGNATURE');
    expectWebhookError(() => parseSignatureHeader('s0=123'), 'MALFORMED_SIGNATURE');
  });
});

describe('verifyHub2Signature', () => {
  it('accepte une signature valide et récente', () => {
    expect(() =>
      verifyHub2Signature({
        rawBody: BODY,
        header: headerFor(BODY),
        secret: SECRET,
        now: NOW,
      }),
    ).not.toThrow();
  });

  it('accepte s0 en millisecondes', () => {
    expect(() =>
      verifyHub2Signature({
        rawBody: BODY,
        header: headerFor(BODY, String(NOW)),
        secret: SECRET,
        now: NOW,
      }),
    ).not.toThrow();
  });

  it('accepte une signature parmi plusieurs (rotation de secret)', () => {
    const header = `s1=deadbeef,s0=${S0},s1=${computeSignature(SECRET, S0, BODY)}`;
    expect(() =>
      verifyHub2Signature({ rawBody: BODY, header, secret: SECRET, now: NOW }),
    ).not.toThrow();
  });

  it('refuse un mauvais secret', () => {
    expectWebhookError(
      () =>
        verifyHub2Signature({
          rawBody: BODY,
          header: headerFor(BODY),
          secret: 'whsec_autre',
          now: NOW,
        }),
      'INVALID_SIGNATURE',
    );
  });

  it('refuse un corps modifié après signature', () => {
    expectWebhookError(
      () =>
        verifyHub2Signature({
          rawBody: `${BODY} `,
          header: headerFor(BODY),
          secret: SECRET,
          now: NOW,
        }),
      'INVALID_SIGNATURE',
    );
  });

  it('refuse un webhook de plus de 5 minutes (anti-rejeu)', () => {
    const old = String(Math.floor(NOW / 1000) - 301);
    expectWebhookError(
      () =>
        verifyHub2Signature({
          rawBody: BODY,
          header: headerFor(BODY, old),
          secret: SECRET,
          now: NOW,
        }),
      'STALE_SIGNATURE',
    );
  });

  it('refuse un horodatage trop en avance', () => {
    const future = String(Math.floor(NOW / 1000) + 301);
    expectWebhookError(
      () =>
        verifyHub2Signature({
          rawBody: BODY,
          header: headerFor(BODY, future),
          secret: SECRET,
          now: NOW,
        }),
      'STALE_SIGNATURE',
    );
  });

  it('refuse un s0 non numérique', () => {
    expectWebhookError(
      () =>
        verifyHub2Signature({
          rawBody: BODY,
          header: `s1=abc,s0=not-a-timestamp`,
          secret: SECRET,
          now: NOW,
        }),
      'MALFORMED_SIGNATURE',
    );
  });

  it('refuse un corps brut absent', () => {
    expectWebhookError(
      () =>
        verifyHub2Signature({
          rawBody: undefined,
          header: headerFor(BODY),
          secret: SECRET,
          now: NOW,
        }),
      'MISSING_RAW_BODY',
    );
  });
});

describe('parseHub2Event', () => {
  it('normalise un événement complet', () => {
    const event = parseHub2Event(BODY);
    expect(event.id).toBe('evt_123');
    expect(event.type).toBe('payment_intent.succeeded');
    expect(event.data).toEqual({ id: 'pi_123', purchaseReference: 'PAY-2026-ABC123' });
    expect(event.payload).toMatchObject({ id: 'evt_123' });
    expect(event.createdAt).toBe('2026-10-27T10:00:00.000Z');
  });

  it('déduplique par empreinte quand l’id manque', () => {
    const withoutId = JSON.stringify({ type: 'payment_intent.succeeded', data: {} });
    const first = parseHub2Event(withoutId);
    const second = parseHub2Event(withoutId);
    expect(first.id).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.id).toBe(second.id);
  });

  it('refuse un JSON invalide, un corps vide ou un type absent', () => {
    expectWebhookError(() => parseHub2Event('{'), 'INVALID_JSON');
    expectWebhookError(() => parseHub2Event('   '), 'INVALID_JSON');
    expectWebhookError(() => parseHub2Event('[]'), 'INVALID_EVENT');
    expectWebhookError(() => parseHub2Event('{"data":{}}'), 'INVALID_EVENT');
  });

  it('accepte un data absent sans planter', () => {
    const event = parseHub2Event('{"id":"evt_1","type":"transfer.succeeded"}');
    expect(event.data).toEqual({});
  });
});

describe('extractPurchaseReference', () => {
  it('lit la référence à la racine de data', () => {
    expect(extractPurchaseReference(parseHub2Event(BODY))).toBe('PAY-2026-ABC123');
  });

  it('la retrouve dans un objet imbriqué (remboursement)', () => {
    const event = parseHub2Event(
      JSON.stringify({
        id: 'evt_r',
        type: 'payment_refund.successful',
        data: { id: 'refund_1', payment: { purchaseReference: 'PAY-2026-XYZ789' } },
      }),
    );
    expect(extractPurchaseReference(event)).toBe('PAY-2026-XYZ789');
  });

  it('renvoie null quand elle est absente', () => {
    expect(extractPurchaseReference(parseHub2Event('{"id":"e","type":"transfer.succeeded","data":{}}')))
      .toBeNull();
  });
});

describe('extractProviderId', () => {
  it('privilégie l’identifiant métier puis retombe sur id', () => {
    expect(
      extractProviderId(
        parseHub2Event('{"id":"e","type":"x","data":{"paymentId":"pi_1","id":"other"}}'),
      ),
    ).toBe('pi_1');
    expect(extractProviderId(parseHub2Event('{"id":"e","type":"x","data":{"id":"pi_2"}}')))
      .toBe('pi_2');
    expect(extractProviderId(parseHub2Event('{"id":"e","type":"x","data":{}}'))).toBeNull();
  });

  it('extrait le paiement réellement réussi d’un intent', () => {
    const event = parseHub2Event(
      JSON.stringify({
        id: 'e',
        type: 'payment_intent.succeeded',
        data: {
          id: 'pi_1',
          payments: [
            { id: 'pay_failed', status: 'failed' },
            { id: 'pay_ok', status: 'successful' },
          ],
        },
      }),
    );
    expect(extractProviderId(event)).toBe('pay_ok');
  });

  it('extrait la tentative réussie d’un Payment Link', () => {
    const event = parseHub2Event(
      JSON.stringify({
        id: 'e',
        type: 'payment_links.paid',
        data: {
          id: 'pl_1',
          paymentAttempts: [{ id: 'pay_ok', status: 'successful' }],
        },
      }),
    );
    expect(extractProviderId(event)).toBe('pay_ok');
  });
});

describe('extractRefundId', () => {
  it('lit l’identifiant numérique du remboursement', () => {
    const event = parseHub2Event(
      JSON.stringify({
        id: 'e',
        type: 'payment_refund.successful',
        data: { id: 1234, status: 'successful', paymentId: 'pay_1' },
      }),
    );
    expect(extractRefundId(event)).toBe('1234');
  });

  it('préfère refundId et ne confond jamais le paiement d’origine', () => {
    const event = parseHub2Event(
      JSON.stringify({
        id: 'e',
        type: 'payment_refund.failed',
        data: { refundId: 'r_9', id: 1, paymentId: 'pay_1' },
      }),
    );
    expect(extractRefundId(event)).toBe('r_9');
  });

  it('renvoie null sans identifiant exploitable', () => {
    const event = parseHub2Event(
      JSON.stringify({ id: 'e', type: 'refund.failed', data: { paymentId: 'pay_1' } }),
    );
    expect(extractRefundId(event)).toBeNull();
  });
});

describe('extractTransferId', () => {
  it('lit transferId à la racine de data', () => {
    const event = parseHub2Event(
      JSON.stringify({
        id: 'e',
        type: 'transfer.succeeded',
        data: { transferId: 'tr_1', status: 'successful' },
      }),
    );
    expect(extractTransferId(event)).toBe('tr_1');
  });

  it('lit l’identifiant imbriqué dans data.transfer', () => {
    const event = parseHub2Event(
      JSON.stringify({
        id: 'e',
        type: 'transfer.failed',
        data: { transfer: { id: 'tr_2' } },
      }),
    );
    expect(extractTransferId(event)).toBe('tr_2');
  });

  it('renvoie null sans identifiant', () => {
    const event = parseHub2Event(
      JSON.stringify({ id: 'e', type: 'transfer.processing', data: { status: 'pending' } }),
    );
    expect(extractTransferId(event)).toBeNull();
  });
});
