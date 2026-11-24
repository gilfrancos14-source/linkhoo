/**
 * Reçu de paiement au format HTML (même gabarit que recu-reservation.html).
 *
 * Le reçu est servi sur une URL signée : le jeton prouve que le lien vient du
 * serveur et évite d'exposer les données de la réservation à n'importe qui.
 * Le client ouvre le lien depuis son e-mail, puis télécharge/imprime en PDF
 * depuis le bouton du gabarit (le JavaScript ne fonctionne pas dans un e-mail).
 */

import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../lib/logger';
import { escapeHtml, sendReceiptEmail } from './mailer';

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'recu-reservation.html');
const TOKEN_TTL = '90d';

function secret(): string {
  const configured = process.env.PAYMENT_RETURN_SECRET || process.env.CLERK_SECRET_KEY;
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('PAYMENT_RETURN_SECRET ou CLERK_SECRET_KEY requis pour signer les reçus');
  }
  return configured || 'dev-receipt-secret';
}

interface ReceiptTokenPayload extends jwt.JwtPayload {
  reference: string;
  reservation_id: string;
}

export function createReceiptToken(reference: string, reservationId: string): string {
  return jwt.sign({ reference, reservation_id: reservationId }, secret(), {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyReceiptToken(token: string): ReceiptTokenPayload | null {
  try {
    const payload = jwt.verify(token, secret()) as ReceiptTokenPayload;
    if (typeof payload.reference !== 'string' || typeof payload.reservation_id !== 'string') {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function receiptUrl(reference: string, reservationId: string): string {
  const base = (process.env.APP_PUBLIC_URL ?? '').replace(/\/+$/, '');
  const token = createReceiptToken(reference, reservationId);
  return `${base}/api/receipts/${token}`;
}

// ── Écriture des nombres en français (montant en toutes lettres) ──

const UNITS = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'quatre-vingt'];

function underHundred(n: number): string {
  if (n < 20) return UNITS[n];
  const tens = Math.floor(n / 10);
  const units = n % 10;
  if (tens === 7) return `soixante-${UNITS[10 + units]}`;
  if (tens === 8 && units === 0) return 'quatre-vingts';
  if (tens === 8) return `quatre-vingt-${UNITS[units]}`;
  if (tens === 9) return `quatre-vingt-${UNITS[10 + units]}`;
  if (units === 1 && tens >= 2) return `${TENS[tens]} et un`;
  return units ? `${TENS[tens]}-${UNITS[units]}` : TENS[tens];
}

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const prefix = hundreds === 0 ? '' : hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cents`;
  if (!rest) return prefix;
  return prefix ? `${prefix} ${underHundred(rest)}` : underHundred(rest);
}

/** Convertit un entier positif en toutes lettres (jusqu'au milliard). */
export function numberToFrenchWords(value: number): string {
  const n = Math.abs(Math.trunc(value));
  if (n === 0) return 'zéro';
  if (n >= 1_000_000_000) return `${numberToFrenchWords(Math.floor(n / 1_000_000_000))} milliards ${numberToFrenchWords(n % 1_000_000_000)}`.trim();

  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;

  if (millions) parts.push(`${millions === 1 ? 'un million' : `${underThousand(millions)} millions`}`);
  if (thousands) parts.push(`${thousands === 1 ? 'mille' : `${underThousand(thousands)} mille`}`);
  if (rest) parts.push(underThousand(rest));
  return parts.join(' ');
}

// ── Données du reçu ──

export interface ReceiptData {
  readonly receiptNumber: string;
  readonly paymentReference: string;
  readonly clientName: string;
  readonly reservationId: string;
  readonly amount: string;
  readonly amountWords: string;
  readonly roomTitle: string;
  readonly market: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly duration: string;
  readonly paymentMethod: string;
  readonly paid: string;
  readonly due: string;
  readonly totalPaid: string;
  readonly providerPaymentId: string;
  readonly hostName: string;
  readonly paidAtShort: string;
}

const nf = new Intl.NumberFormat('fr-FR');

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(parsed);
}

const MARKET_LABELS: Record<string, string> = {
  CI: 'Abidjan, Côte d\'Ivoire (CI)', BJ: 'Cotonou, Bénin (BJ)',
  SN: 'Dakar, Sénégal (SN)', TG: 'Lomé, Togo (TG)', CM: 'Douala, Cameroun (CM)',
};

/** Charge et normalise les données d'un paiement de réservation réussi. */
export async function loadReceiptData(
  reference: string,
  reservationId: string,
): Promise<ReceiptData | null> {
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('reference, reservation_id, status, purpose, amount, amount_xof, currency, market, paid_at, provider_payment_id, provider')
    .eq('reference', reference)
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment || payment.purpose !== 'booking' || payment.reservation_id !== reservationId) return null;
  if (payment.status !== 'succeeded') return null;

  const { data: reservation } = await supabaseAdmin
    .from('reservations')
    .select('id, client_name, client_email, room_id, room_title, date_debut, date_fin, duree_nombre, duree_unite')
    .eq('id', reservationId)
    .maybeSingle();
  if (!reservation?.client_email) return null;

  let hostName = 'Hôte Linkhoo';
  if (reservation.room_id) {
    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('gerant_id')
      .eq('id', reservation.room_id)
      .maybeSingle();
    if (room?.gerant_id) {
      const { data: host } = await supabaseAdmin
        .from('gerants')
        .select('nom, prenom')
        .eq('clerk_user_id', room.gerant_id)
        .maybeSingle();
      const name = [host?.prenom, host?.nom].filter(Boolean).join(' ');
      if (name) hostName = name;
    }
  }

  const amountXof = Number(payment.amount_xof) || 0;
  const amount = nf.format(amountXof);
  const paidAt = payment.paid_at as string | null;
  const year = paidAt ? new Date(paidAt).getUTCFullYear() : new Date().getUTCFullYear();
  const durationUnit = reservation.duree_unite === 'mois' ? 'mois' : 'nuit';
  const count = Number(reservation.duree_nombre) || 0;

  return {
    receiptNumber: `RCP-${year}-${String(payment.reference).replace(/[^A-Z0-9]/g, '').slice(-6)}`,
    paymentReference: String(payment.reference),
    clientName: String(reservation.client_name || 'Client Linkhoo'),
    reservationId: String(reservation.id),
    amount: `${amount} FCFA`,
    amountWords: `${numberToFrenchWords(amountXof)} francs CFA`,
    roomTitle: String(reservation.room_title || 'Votre logement'),
    market: MARKET_LABELS[String(payment.market)] ?? String(payment.market ?? 'Linkhoo'),
    checkIn: formatDate(reservation.date_debut),
    checkOut: formatDate(reservation.date_fin),
    duration: count ? `${count} ${durationUnit}${count > 1 && durationUnit === 'nuit' ? 's' : ''}` : '—',
    paymentMethod: `Mobile Money · ${String(payment.provider || 'pawaPay')}`,
    paid: `${amount} FCFA`,
    due: '0 FCFA',
    totalPaid: `${amount} FCFA`,
    providerPaymentId: String(payment.provider_payment_id || '—'),
    hostName,
    paidAtShort: formatDate(paidAt),
  };
}

/** Remplace les valeurs du gabarit par les données réelles. */
export function renderReceiptHtml(data: ReceiptData): string {
  const values: Record<string, string> = {
    receipt_number: data.receiptNumber,
    payment_reference: data.paymentReference,
    client_name: data.clientName,
    reservation_id: data.reservationId,
    amount: data.amount,
    amount_words: data.amountWords,
    room_title: data.roomTitle,
    market: data.market,
    check_in: data.checkIn,
    check_out: data.checkOut,
    duration: data.duration,
    payment_method: data.paymentMethod,
    paid: data.paid,
    due: data.due,
    total_paid: data.totalPaid,
    provider_payment_id: data.providerPaymentId,
    host_name: data.hostName,
    paid_at_short: data.paidAtShort,
  };

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return template.replace(
    /data-field="([a-z_]+)"([^>]*)>([^<]*)</g,
    (match, field: string, attrs: string, current: string) => {
      const value = values[field] ?? current;
      return `data-field="${field}"${attrs}>${escapeHtml(value)}<`;
    },
  );
}

/** Envoie l'e-mail de confirmation avec le lien du reçu signé. */
export async function sendPaymentReceiptEmail(reference: string): Promise<void> {
  try {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('reference, reservation_id, status, purpose')
      .eq('reference', reference)
      .maybeSingle();
    if (!payment || payment.purpose !== 'booking' || payment.status !== 'succeeded') return;

    const data = await loadReceiptData(reference, String(payment.reservation_id));
    if (!data) return;

    const { data: reservation } = await supabaseAdmin
      .from('reservations')
      .select('client_email')
      .eq('id', payment.reservation_id)
      .maybeSingle();
    if (!reservation?.client_email) return;

    await sendReceiptEmail({
      to: String(reservation.client_email),
      clientName: data.clientName,
      amount: data.totalPaid,
      reservationId: data.reservationId,
      receiptUrl: receiptUrl(reference, String(payment.reservation_id)),
    });
  } catch (error) {
    logger.warn('[receipt] Envoi du reçu impossible (non bloquant)', { error });
  }
}
