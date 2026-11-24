import { describe, expect, it } from 'vitest';
import {
  createReceiptToken,
  numberToFrenchWords,
  renderReceiptHtml,
  verifyReceiptToken,
  type ReceiptData,
} from './receipt';

const data: ReceiptData = {
  receiptNumber: 'RCP-2026-240018',
  paymentReference: 'PAY-2026-11-24001847',
  clientName: 'Awa Koffi',
  reservationId: 'RES-8F3C21AB',
  amount: '189 000 FCFA',
  amountWords: 'cent quatre-vingt-neuf mille francs CFA',
  roomTitle: 'Appartement Cocody — Vue lagon',
  market: "Abidjan, Côte d'Ivoire (CI)",
  checkIn: '12 déc. 2026',
  checkOut: '18 déc. 2026',
  duration: '6 nuits',
  paymentMethod: 'Mobile Money · pawapay',
  paid: '189 000 FCFA',
  due: '0 FCFA',
  totalPaid: '189 000 FCFA',
  providerPaymentId: 'PP-8K3M2X9Q4L',
  hostName: 'Maison Bloom',
  paidAtShort: '24 nov. 2026',
};

describe('numberToFrenchWords', () => {
  it.each([
    [0, 'zéro'],
    [21, 'vingt et un'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [189_000, 'cent quatre-vingt-neuf mille'],
    [2_000_000, 'deux millions'],
  ])('écrit %i', (value, expected) => {
    expect(numberToFrenchWords(value)).toBe(expected);
  });
});

describe('jeton de reçu', () => {
  it('valide un jeton émis par le serveur', () => {
    const token = createReceiptToken('PAY-2026-11-24001847', 'RES-8F3C21AB');
    expect(verifyReceiptToken(token)).toMatchObject({
      reference: 'PAY-2026-11-24001847',
      reservation_id: 'RES-8F3C21AB',
    });
  });

  it('rejette un jeton falsifié', () => {
    const token = createReceiptToken('PAY-2026-11-24001847', 'RES-8F3C21AB');
    expect(verifyReceiptToken(`${token}x`)).toBeNull();
    expect(verifyReceiptToken('pas.un.jeton')).toBeNull();
  });
});

describe('renderReceiptHtml', () => {
  it('remplace les champs du gabarit par les données réelles', () => {
    const html = renderReceiptHtml(data);

    expect(html).toContain('RCP-2026-240018');
    expect(html).toContain('PAY-2026-11-24001847');
    expect(html).toContain('Awa Koffi');
    expect(html).toContain('189 000 FCFA');
    expect(html).toContain('cent quatre-vingt-neuf mille francs CFA');
    expect(html).toContain('PP-8K3M2X9Q4L');
  });

  it('échappe le HTML injecté dans les données', () => {
    const html = renderReceiptHtml({ ...data, clientName: '<script>alert(1)</script>' });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
