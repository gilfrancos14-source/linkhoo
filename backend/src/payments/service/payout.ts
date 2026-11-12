/**
 * Reversements aux gérants (phase 4).
 *
 * Principe : la plateforme encaisse 100 % du séjour, puis reverse le net au
 * gérant après `date_debut + payout_delay_hours` (24 h par défaut). La
 * commission est nulle aujourd'hui ; le calcul la prend quand même en compte
 * pour ne pas figer le modèle.
 *
 * Trois étapes, toutes idempotentes :
 *
 *   1. `scheduleDuePayouts` crée une ligne `payment_payouts` par réservation
 *      due. L'index unique partiel sur `reservation_id` empêche un doublon,
 *      même si deux passages se chevauchent.
 *   2. `processScheduledPayoutsPawapay` « claim » la ligne (`scheduled →
 *      processing`) avant l'appel pawaPay : deux workers ne peuvent pas envoyer
 *      le même transfert. Le `reference` unique sert de seconde barrière.
 *   3. `reconcileProcessingPayoutsPawapay` clôt le statut.
 *      Un `paid` n'est jamais rétrogradé par un événement tardif.
 *
 * Aucun reversement ne part sans destination vérifiée : la ligne reste
 * `scheduled` avec `failure_code = 'payout_details_missing'`, et le gérant
 * reçoit une notification l'invitant à renseigner ses coordonnées.
 */

import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../../config/supabase';
import type { MarketCode } from '../../config/markets';
import { getPawapayConfig, PawapayConfigError, PAWAPAY_MARKETS } from '../pawapay/config';
import { PawapayApiError } from '../pawapay/client';
import { formatPhoneNumberForPawapay } from '../pawapay/markets';
import {
  createPayout as createPawapayPayout,
  getPayout as getPawapayPayout,
} from '../pawapay/payouts';
import { PaymentServiceError } from '../errors';
import { fetchAllRows } from '../../utils/fetchAll';
import { getPaymentPolicy } from '../policies';
import { commissionPercentFor, commissionTierFor, COMMISSION_PERCENT_BY_TIER, type CommissionTier } from '../commissions';
import { isPawapayProvider } from '../provider';
import type { PayoutMethod, TransferStatus } from '../types';
import type { PawapayCurrency } from '../pawapay/types';

export const PAYOUT_BATCH_SIZE = 50;

/** Un transfert sans réponse est relu après ce délai avant tout nouvel envoi. */
export const PAYOUT_RECONCILE_MIN_AGE_MS = 10 * 60 * 1000;

/** Au-delà, un transfert introuvable côté pawaPay repart en file (`scheduled`). */
export const PAYOUT_UNCONFIRMED_RETRY_MS = 60 * 60 * 1000;

export const PAYOUT_SETTINGS_COLUMNS =
  'clerk_user_id, market, payout_method, payout_phone, payout_provider, payout_bank_code, payout_bank_name, payout_account_number, payout_holder_name, payout_verified_at, is_verified, is_premium, premium_expires_at';

export interface PayoutSettings {
  clerk_user_id: string;
  market: MarketCode;
  payout_method: PayoutMethod | null;
  payout_phone: string | null;
  payout_provider: string | null;
  payout_bank_code: string | null;
  payout_bank_name: string | null;
  payout_account_number: string | null;
  payout_holder_name: string | null;
  payout_verified_at: string | null;
  /** Statuts qui déterminent la commission prélevée (cf. `payments/commissions`). */
  is_verified: boolean | null;
  is_premium: boolean | null;
  premium_expires_at: string | null;
}

export interface PayoutSettingsInput {
  readonly method: PayoutMethod;
  readonly phone?: string | null;
  readonly provider?: string | null;
  readonly bank_code?: string | null;
  readonly bank_name?: string | null;
  readonly account_number?: string | null;
  readonly holder_name?: string | null;
}

export interface PayoutAmounts {
  readonly gross: number;
  readonly commission: number;
  readonly refunded: number;
  readonly net: number;
}

export interface PayoutRow {
  id: string;
  reference: string;
  reservation_id: string | null;
  gerant_clerk_user_id: string;
  market: string;
  gross_amount: number | string;
  commission_amount: number | string;
  refunded_amount: number | string;
  net_amount: number | string;
  currency: string;
  provider_transfer_id: string | null;
  destination_type: PayoutMethod;
  destination_phone: string | null;
  destination_provider: string | null;
  destination_bank_code: string | null;
  destination_bank_name: string | null;
  destination_account_number: string | null;
  destination_holder_name: string | null;
  status: TransferStatus;
  scheduled_for: string;
  paid_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  /** `reservation` = ancien versement auto, `withdrawal` = retrait demandé. */
  kind: 'reservation' | 'withdrawal';
  requested_at: string | null;
  created_at: string;
  updated_at: string;
}

const PAYOUT_COLUMNS =
  'id, reference, reservation_id, gerant_clerk_user_id, market, gross_amount, commission_amount, refunded_amount, net_amount, currency, provider_transfer_id, destination_type, destination_phone, destination_provider, destination_bank_code, destination_bank_name, destination_account_number, destination_holder_name, status, scheduled_for, paid_at, failure_code, failure_message, kind, requested_at, created_at, updated_at';

/** Champs manquants pour construire une destination pawaPay valide. */
export function missingPayoutFields(settings: PayoutSettings): string[] {
  const missing: string[] = [];
  if (!settings.payout_method) {
    missing.push('method');
    return missing;
  }

  if (settings.payout_method === 'mobile_money') {
    if (!settings.payout_phone?.trim()) missing.push('phone');
    if (!settings.payout_provider?.trim()) missing.push('provider');
  } else {
    if (!settings.payout_account_number?.trim()) missing.push('account_number');
    if (!settings.payout_bank_code?.trim()) missing.push('bank_code');
    if (!settings.payout_bank_name?.trim()) missing.push('bank_name');
    if (!settings.payout_phone?.trim()) missing.push('phone');
  }

  if (!settings.payout_holder_name?.trim()) missing.push('holder_name');
  return missing;
}

/** Vrai si le gérant a des coordonnées valides pour pawaPay. */
export function hasValidPawapayDestination(settings: PayoutSettings): boolean {
  if (settings.payout_method !== 'mobile_money') return false;
  if (!settings.payout_phone?.trim()) return false;
  if (!settings.payout_holder_name?.trim()) return false;

  const provider = settings.payout_provider?.trim().toUpperCase();
  if (!provider) return false;

  // L'opérateur doit exister sur le marché du gérant : un ancien libellé
  // (« orange ») serait refusé par pawaPay au moment du transfert.
  const allowed = PAWAPAY_MARKETS[settings.market]?.providers ?? [];
  if (!allowed.includes(provider)) return false;

  // Le numéro doit être convertible en MSISDN pawaPay (chiffres + indicatif).
  try {
    formatPhoneNumberForPawapay(settings.payout_phone, settings.market);
  } catch {
    return false;
  }
  return true;
}

/**
 * Construit la destination attendue par pawaPay.
 */
export function buildPawapayDestination(
  settings: PayoutSettings,
): { type: 'MMO'; accountDetails: { phoneNumber: string; provider: string } } | null {
  if (!hasValidPawapayDestination(settings)) return null;

  return {
    type: 'MMO',
    accountDetails: {
      phoneNumber: settings.payout_phone!.trim(),
      provider: settings.payout_provider!.trim().toUpperCase(),
    },
  };
}

/**
 * Calcule le net d'un reversement.
 *
 * Retourne `null` quand il n'y a rien à reverser (net nul ou négatif) : mieux
 * vaut ne pas créer de payout qu'insérer une ligne que la contrainte SQL
 * refuserait.
 */
export function computePayoutAmounts(input: {
  gross: number;
  commissionPercent: number;
  refunded: number;
}): PayoutAmounts | null {
  const gross = Math.trunc(Number(input.gross));
  if (!Number.isFinite(gross) || gross <= 0) return null;

  const percent = Number.isFinite(input.commissionPercent) ? input.commissionPercent : 0;
  const commission = Math.min(gross, Math.max(0, Math.round((gross * percent) / 100)));
  const refundedRaw = Math.trunc(Number(input.refunded));
  const refunded = Math.min(
    gross - commission,
    Math.max(0, Number.isFinite(refundedRaw) ? refundedRaw : 0),
  );
  const net = gross - commission - refunded;
  if (net <= 0) return null;

  return { gross, commission, refunded, net };
}

/** Date à partir de laquelle un séjour peut être reversé. */
export function payoutDueAt(
  dateDebut: string | null,
  payoutDelayHours: number,
): Date | null {
  if (!dateDebut || !/^\d{4}-\d{2}-\d{2}$/.test(dateDebut)) return null;
  const start = new Date(`${dateDebut}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  const delay = Number.isFinite(payoutDelayHours) ? Math.max(0, payoutDelayHours) : 0;
  return new Date(start.getTime() + delay * 60 * 60 * 1000);
}

/** Référence `OUT-…` conforme à la contrainte `payment_payouts.reference`. */
export function newPayoutReference(now: Date = new Date()): string {
  const time = now.getTime().toString(36).toUpperCase();
  const random = randomBytes(4).toString('hex').toUpperCase();
  return `OUT-${time}-${random}`;
}

function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function notifyGerant(
  gerantClerkUserId: string,
  type:
    | 'payout_scheduled'
    | 'payout_details_required'
    | 'payout_details_verified'
    | 'payout_paid'
    | 'payout_failed',
  message: string,
  reservationId: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin.from('notifications').insert({
    id: randomBytes(16).toString('hex'),
    type,
    room_title: null,
    room_id: null,
    client_name: null,
    client_email: null,
    client_phone: null,
    message,
    reservation_id: reservationId,
    gerant_id: gerantClerkUserId,
  });
  if (error) {
    console.error('[payout] notification impossible :', error.message);
  }
}

async function fetchSettingsFor(
  clerkUserIds: string[],
): Promise<Map<string, PayoutSettings>> {
  const map = new Map<string, PayoutSettings>();
  if (clerkUserIds.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from('gerants')
    .select(PAYOUT_SETTINGS_COLUMNS)
    .in('clerk_user_id', clerkUserIds);
  if (error) throw error;

  for (const row of (data as PayoutSettings[] | null) ?? []) {
    map.set(row.clerk_user_id, row);
  }
  return map;
}

interface DueReservation {
  id: string;
  room_id: string | null;
  date_debut: string | null;
  date_fin: string | null;
  payment_id: string | null;
  refunded_amount: number | string | null;
}

interface RoomForPayout {
  id: string;
  market: MarketCode;
  gerant_id: string | null;
}

interface PaymentForPayout {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
  gerant_clerk_user_id: string | null;
}

export interface ScheduleResult {
  readonly skipped: boolean;
  readonly checked: number;
  readonly created: number;
  readonly blocked: number;
}

/**
 * Crée les reversements dus pour pawaPay.
 */
export async function scheduleDuePayoutsPawapay(now: Date = new Date()): Promise<ScheduleResult> {
  if (!isPawapayProvider()) {
    return { skipped: true, checked: 0, created: 0, blocked: 0 };
  }

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('id, room_id, date_debut, date_fin, payment_id, refunded_amount')
    .eq('statut', 'confirmee')
    .in('payment_status', ['paid', 'partially_refunded'])
    .not('payment_id', 'is', null)
    .not('date_fin', 'is', null)
    // Le séjour doit être TERMINÉ : on ne paie plus le gérant au début du
    // séjour, mais une fois la date de fin passée (aucune annulation possible
    // entre-temps, `statut` reste `confirmee`).
    .lt('date_fin', todayUtc(now))
    .order('date_fin', { ascending: true })
    .limit(PAYOUT_BATCH_SIZE);

  if (error) throw error;

  const reservations = (data as DueReservation[] | null) ?? [];
  if (reservations.length === 0) {
    return { skipped: false, checked: 0, created: 0, blocked: 0 };
  }

  const roomIds = [...new Set(reservations.map((r) => r.room_id).filter(Boolean))] as string[];
  const paymentIds = [...new Set(reservations.map((r) => r.payment_id).filter(Boolean))] as string[];

  const [roomsResult, paymentsResult, existingResult] = await Promise.all([
    roomIds.length
      ? supabaseAdmin.from('rooms').select('id, market, gerant_id').in('id', roomIds)
      : Promise.resolve({ data: [], error: null }),
    paymentIds.length
      ? supabaseAdmin
          .from('payments')
          .select('id, status, amount, currency, gerant_clerk_user_id')
          .in('id', paymentIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from('payment_payouts')
      .select('reservation_id')
      .in('reservation_id', reservations.map((r) => r.id))
      .neq('status', 'canceled'),
  ]);

  if (roomsResult.error) throw roomsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (existingResult.error) throw existingResult.error;

  const rooms = new Map(
    ((roomsResult.data as RoomForPayout[] | null) ?? []).map((room) => [room.id, room]),
  );
  const payments = new Map(
    ((paymentsResult.data as PaymentForPayout[] | null) ?? []).map((payment) => [
      payment.id,
      payment,
    ]),
  );
  const alreadyScheduled = new Set(
    ((existingResult.data as { reservation_id: string | null }[] | null) ?? [])
      .map((row) => row.reservation_id)
      .filter((id): id is string => Boolean(id)),
  );

  const gerantIds = [
    ...new Set(
      [
        ...[...payments.values()].map((payment) => payment.gerant_clerk_user_id),
        ...[...rooms.values()].map((room) => room.gerant_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const settingsByGerant = await fetchSettingsFor(gerantIds);

  let created = 0;
  let blocked = 0;

  for (const reservation of reservations) {
    if (alreadyScheduled.has(reservation.id)) continue;

    const room = reservation.room_id ? rooms.get(reservation.room_id) : null;
    const payment = reservation.payment_id ? payments.get(reservation.payment_id) : null;
    if (!room || !payment || payment.status !== 'succeeded') continue;

    const gerantId = payment.gerant_clerk_user_id ?? room.gerant_id;
    if (!gerantId) continue;

    const policy = await getPaymentPolicy(room.market);
    const dueAt = payoutDueAt(
      reservation.date_fin ?? reservation.date_debut,
      policy.payoutDelayHours,
    );
    if (!dueAt || dueAt.getTime() > now.getTime()) continue;

    const settings = settingsByGerant.get(gerantId);
    // La commission dépend du statut du gérant (premium / vérifié), pas du
    // marché : cf. `payments/commissions`.
    const commissionPercent = commissionPercentFor(settings, now);

    const amounts = computePayoutAmounts({
      gross: Number(payment.amount),
      commissionPercent,
      refunded: Number(reservation.refunded_amount ?? 0),
    });
    if (!amounts) continue;

    const destination = settings ? buildPawapayDestination(settings) : null;
    const verified = settings ? hasValidPawapayDestination(settings) : false;
    const destinationType: PayoutMethod = settings?.payout_method ?? 'mobile_money';

    const { error: insertError } = await supabaseAdmin.from('payment_payouts').insert({
      reference: newPayoutReference(now),
      reservation_id: reservation.id,
      gerant_clerk_user_id: gerantId,
      market: room.market,
      gross_amount: amounts.gross,
      commission_amount: amounts.commission,
      refunded_amount: amounts.refunded,
      net_amount: amounts.net,
      currency: payment.currency,
      destination_type: destinationType,
      destination_phone: settings?.payout_phone ?? null,
      destination_provider: settings?.payout_provider ?? null,
      destination_bank_code: null,
      destination_bank_name: null,
      destination_account_number: null,
      destination_holder_name: settings?.payout_holder_name ?? null,
      status: 'scheduled',
      scheduled_for: dueAt.toISOString(),
      failure_code: verified && destination ? null : 'payout_details_missing',
      failure_message:
        verified && destination ? null : 'Coordonnées de reversement à compléter et vérifier.',
    });

    // 23505 = l'index unique sur `reservation_id` a tranché une course entre
    // deux passages : ce n'est pas une erreur, le payout existe déjà.
    if (insertError) {
      if (insertError.code !== '23505') throw insertError;
      continue;
    }

    created += 1;
    if (!verified || !destination) {
      blocked += 1;
      await notifyGerant(
        gerantId,
        'payout_details_required',
        'Un reversement vous attend : renseignez et faites vérifier vos coordonnées de paiement.',
        reservation.id,
      );
    } else {
      await notifyGerant(
        gerantId,
        'payout_scheduled',
        `Un reversement de ${amounts.net} ${payment.currency} est programmé.`,
        reservation.id,
      );
    }
  }

  return { skipped: false, checked: reservations.length, created, blocked };
}

export interface ProcessResult {
  readonly skipped: boolean;
  readonly checked: number;
  readonly sent: number;
  readonly paid: number;
  readonly failed: number;
  readonly deferred: number;
}

async function markPayoutPaid(payout: PayoutRow, transfer: { id: string }): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('payment_payouts')
    .update({
      status: 'paid',
      provider_transfer_id: transfer.id,
      paid_at: new Date().toISOString(),
      failure_code: null,
      failure_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payout.id)
    // `paid` est terminal : deux webhooks concurrents ne doivent pas produire
    // deux notifications ni réécrire l'horodatage de paiement.
    .neq('status', 'paid')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) return;

  await notifyGerant(
    payout.gerant_clerk_user_id,
    'payout_paid',
    `Reversement de ${Number(payout.net_amount)} ${payout.currency} envoyé.`,
    payout.reservation_id,
  );
}

async function markPayoutFailed(
  payout: PayoutRow,
  code: string,
  message: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('payment_payouts')
    .update({
      status: 'failed',
      failure_code: code.slice(0, 120),
      failure_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payout.id)
    // Un `transfer.failed` livré en retard ne rétrograde jamais un payout payé.
    .neq('status', 'paid')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) return;

  await notifyGerant(
    payout.gerant_clerk_user_id,
    'payout_failed',
    'Votre reversement a échoué : notre équipe le reprend en main.',
    payout.reservation_id,
  );
}

export interface ReconcilePayoutsResult {
  readonly skipped: boolean;
  readonly checked: number;
  readonly updated: number;
  readonly requeued: number;
}

export async function getPayoutSettings(
  clerkUserId: string,
): Promise<PayoutSettings | null> {
  const { data, error } = await supabaseAdmin
    .from('gerants')
    .select(PAYOUT_SETTINGS_COLUMNS)
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (error) throw error;
  return (data as PayoutSettings | null) ?? null;
}

/**
 * Enregistre les coordonnées déclarées par le gérant.
 *
 * Toute modification remet `payout_verified_at` à NULL : on ne reverse jamais
 * sur un numéro ajouté après la vérification.
 */
export async function savePayoutSettings(
  clerkUserId: string,
  input: PayoutSettingsInput,
): Promise<PayoutSettings> {
  const existing = await getPayoutSettings(clerkUserId);
  if (!existing) {
    throw new PaymentServiceError('GERANT_NOT_FOUND', 'Profil gérant introuvable.', 404);
  }

  // pawaPay ne sait pas virer sur un compte bancaire : accepter la saisie
  // créerait un retrait impossible à honorer.
  if (isPawapayProvider() && input.method !== 'mobile_money') {
    throw new PaymentServiceError(
      'PAYOUT_DETAILS_INCOMPLETE',
      'Le reversement pawaPay se fait uniquement par mobile money.',
      400,
    );
  }

  const normalized = {
    payout_method: input.method,
    payout_phone: input.phone?.trim() || null,
    // pawaPay attend des codes opérateur en majuscules (`ORANGE_CIV`).
    payout_provider: input.provider?.trim().toUpperCase() || null,
    payout_bank_code: input.bank_code?.trim() || null,
    payout_bank_name: input.bank_name?.trim() || null,
    payout_account_number: input.account_number?.trim() || null,
    payout_holder_name: input.holder_name?.trim() || null,
  };

  const changed = (
    ['payout_method', 'payout_phone', 'payout_provider', 'payout_bank_code',
      'payout_bank_name', 'payout_account_number', 'payout_holder_name'] as const
  ).some((key) => (existing[key] ?? null) !== (normalized[key] ?? null));

  const { data, error } = await supabaseAdmin
    .from('gerants')
    .update({
      ...normalized,
      payout_verified_at: changed ? null : existing.payout_verified_at,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', clerkUserId)
    .select(PAYOUT_SETTINGS_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new PaymentServiceError('GERANT_NOT_FOUND', 'Profil gérant introuvable.', 404);
  }
  return data as PayoutSettings;
}

/** Vérifie (ou révoque) les coordonnées d'un gérant — back-office. */
export async function setPayoutVerification(
  gerantId: string,
  verified: boolean,
): Promise<PayoutSettings> {
  const { data, error } = await supabaseAdmin
    .from('gerants')
    .select(PAYOUT_SETTINGS_COLUMNS)
    .eq('id', gerantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new PaymentServiceError('GERANT_NOT_FOUND', 'Profil gérant introuvable.', 404);
  }

  const settings = data as PayoutSettings;
  if (verified) {
    const missing = missingPayoutFields(settings);
    if (missing.length > 0) {
      throw new PaymentServiceError(
        'PAYOUT_DETAILS_INCOMPLETE',
        `Coordonnées incomplètes : ${missing.join(', ')}.`,
        400,
      );
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('gerants')
    .update({
      payout_verified_at: verified ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gerantId)
    .select(PAYOUT_SETTINGS_COLUMNS)
    .maybeSingle();
  if (updateError) throw updateError;
  return updated as PayoutSettings;
}

export async function listPayoutsForGerant(
  clerkUserId: string,
  limit = 50,
): Promise<PayoutRow[]> {
  const { data, error } = await supabaseAdmin
    .from('payment_payouts')
    .select(PAYOUT_COLUMNS)
    .eq('gerant_clerk_user_id', clerkUserId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw error;
  return (data as PayoutRow[] | null) ?? [];
}

// ============================================================
// Portefeuille gérant (solde + demande de retrait)
// ============================================================

export interface GerantBalance {
  /** Devise du marché du gérant. */
  readonly currency: string;
  /** Net cumulé des séjours terminés, payés et non annulés. */
  readonly earned: number;
  /** Montant retirable immédiatement. */
  readonly available: number;
  /** Retraits/versements en cours de traitement. */
  readonly pending: number;
  /** Montant déjà versé sur le compte du gérant. */
  readonly paid: number;
  readonly last_payout_at: string | null;
  /** Commission prélevée sur ses séjours (selon son statut). */
  readonly commission_percent: number;
  /** Case de la grille de commission appliquée. */
  readonly commission_tier: CommissionTier;
}

function toAmount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

interface BalanceReservation {
  id: string;
  room_id: string | null;
  date_fin: string | null;
  payment_id: string | null;
  refunded_amount: number | string | null;
}

interface BalanceRoom {
  id: string;
  market: MarketCode;
}

interface BalancePayment {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
}

interface BalancePayout {
  net_amount: number | string;
  currency: string | null;
  status: string;
  paid_at: string | null;
}

/**
 * Calcule le portefeuille d'un gérant.
 *
 * Le crédit vient des séjours **terminés** (`date_fin` passée) et **payés**,
 * jamais annulés. Les versements déjà créés (en cours ou payés) sont déduits :
 * le solde disponible ne peut donc pas être retiré deux fois.
 */
export async function computeGerantBalance(
  clerkUserId: string,
  now: Date = new Date(),
): Promise<GerantBalance> {
  const settings = await getPayoutSettings(clerkUserId);
  const defaultCurrency = settings
    ? PAWAPAY_MARKETS[settings.market]?.currency ?? 'XOF'
    : 'XOF';

  const rooms = await fetchAllRows<BalanceRoom>((from, to) =>
    supabaseAdmin
      .from('rooms')
      .select('id, market')
      .eq('gerant_id', clerkUserId)
      .order('id', { ascending: true })
      .range(from, to),
  );
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const roomIds = rooms.map((room) => room.id);

  let earned = 0;
  let currency: string = defaultCurrency;

  // La commission dépend du statut du gérant (premium / vérifié), pas du
  // marché : elle est identique pour tous ses séjours.
  const commissionTier = commissionTierFor(settings, now);
  const commissionPercent = COMMISSION_PERCENT_BY_TIER[commissionTier];

  if (roomIds.length > 0) {
    const completions = await fetchAllRows<BalanceReservation>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select('id, room_id, date_fin, payment_id, refunded_amount')
        .in('room_id', roomIds)
        .eq('statut', 'confirmee')
        .in('payment_status', ['paid', 'partially_refunded'])
        .not('payment_id', 'is', null)
        .not('date_fin', 'is', null)
        .lt('date_fin', now.toISOString().slice(0, 10))
        .order('id', { ascending: true })
        .range(from, to),
    );

    const paymentIds = [
      ...new Set(completions.map((row) => row.payment_id).filter((id): id is string => Boolean(id))),
    ];
    const payments = paymentIds.length > 0
      ? await fetchAllRows<BalancePayment>((from, to) =>
          supabaseAdmin
            .from('payments')
            .select('id, status, amount, currency')
            .in('id', paymentIds)
            .eq('status', 'succeeded')
            .order('id', { ascending: true })
            .range(from, to),
        )
      : [];
    const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));
    const policyByMarket = new Map<MarketCode, Awaited<ReturnType<typeof getPaymentPolicy>>>();

    for (const reservation of completions) {
      const payment = reservation.payment_id
        ? paymentsById.get(reservation.payment_id)
        : null;
      if (!payment) continue;

      const room = reservation.room_id ? roomsById.get(reservation.room_id) : undefined;
      const market: MarketCode = room?.market ?? settings?.market ?? 'CI';

      // Même règle que le reversement automatique : le séjour doit être
      // terminé ET le délai de sécurité écoulé. Sans cela, le solde
      // afficherait un montant retirable que le reversement ne créerait pas.
      let policy = policyByMarket.get(market);
      if (!policy) {
        policy = await getPaymentPolicy(market);
        policyByMarket.set(market, policy);
      }
      const dueAt = payoutDueAt(reservation.date_fin, policy.payoutDelayHours);
      if (!dueAt || dueAt.getTime() > now.getTime()) continue;

      const gross = toAmount(payment.amount);
      const commission = Math.min(gross, Math.max(0, Math.round((gross * commissionPercent) / 100)));
      const refunded = Math.min(
        gross - commission,
        Math.max(0, toAmount(reservation.refunded_amount)),
      );
      earned += Math.max(0, gross - commission - refunded);
      if (payment.currency) currency = payment.currency;
    }
  }

  const payouts = await fetchAllRows<BalancePayout>((from, to) =>
    supabaseAdmin
      .from('payment_payouts')
      .select('net_amount, currency, status, paid_at')
      .eq('gerant_clerk_user_id', clerkUserId)
      .in('status', ['scheduled', 'processing', 'paid'])
      .order('created_at', { ascending: true })
      .range(from, to),
  );

  let pending = 0;
  let paid = 0;
  let lastPayoutAt: string | null = null;

  for (const payout of payouts) {
    const amount = toAmount(payout.net_amount);
    if (payout.status === 'paid') {
      paid += amount;
      if (payout.paid_at && (!lastPayoutAt || payout.paid_at > lastPayoutAt)) {
        lastPayoutAt = payout.paid_at;
      }
    } else {
      pending += amount;
    }
    if (payout.currency) currency = payout.currency;
  }

  return {
    currency,
    earned,
    available: Math.max(0, earned - pending - paid),
    pending,
    paid,
    last_payout_at: lastPayoutAt,
    commission_percent: commissionPercent,
    commission_tier: commissionTier,
  };
}

export interface WithdrawalResult {
  readonly payout: PayoutRow;
  readonly balance: GerantBalance;
}

/**
 * Enregistre une demande de retrait et programme l'envoi pawaPay.
 *
 * Le montant est toujours revérifié côté serveur : le front ne peut pas
 * retirer plus que le solde calculé.
 */
export async function requestWithdrawal(
  clerkUserId: string,
  amount?: number,
): Promise<WithdrawalResult> {
  const settings = await getPayoutSettings(clerkUserId);
  if (!settings) {
    throw new PaymentServiceError('GERANT_NOT_FOUND', 'Profil gérant introuvable.', 404);
  }

  const destinationReady = hasValidPawapayDestination(settings);

  if (!destinationReady) {
    throw new PaymentServiceError(
      'PAYOUT_DETAILS_INCOMPLETE',
      'Complétez vos coordonnées de reversement avant de demander un retrait.',
      400,
      { missing_fields: missingPayoutFields(settings) },
    );
  }

  const balance = await computeGerantBalance(clerkUserId);
  if (balance.available <= 0) {
    throw new PaymentServiceError(
      'PAYOUT_NOTHING_TO_WITHDRAW',
      'Aucun montant disponible pour le moment.',
      400,
    );
  }

  const requested = amount === undefined ? balance.available : Math.trunc(amount);
  if (!Number.isFinite(requested) || requested <= 0 || requested > balance.available) {
    throw new PaymentServiceError(
      'PAYOUT_AMOUNT_INVALID',
      `Le montant doit être compris entre 1 et ${balance.available} ${balance.currency}.`,
      400,
      { available: balance.available, currency: balance.currency },
    );
  }

  const { data: active } = await supabaseAdmin
    .from('payment_payouts')
    .select('id')
    .eq('gerant_clerk_user_id', clerkUserId)
    .eq('kind', 'withdrawal')
    .in('status', ['scheduled', 'processing'])
    .maybeSingle();

  if (active) {
    throw new PaymentServiceError(
      'PAYOUT_WITHDRAWAL_PENDING',
      'Un retrait est déjà en cours de traitement.',
      409,
    );
  }

  const now = new Date();
  const { data, error } = await supabaseAdmin
    .from('payment_payouts')
    .insert({
      reference: newPayoutReference(now),
      reservation_id: null,
      gerant_clerk_user_id: clerkUserId,
      market: settings.market,
      gross_amount: requested,
      commission_amount: 0,
      refunded_amount: 0,
      net_amount: requested,
      currency: balance.currency,
      destination_type: settings.payout_method ?? 'mobile_money',
      destination_phone: settings.payout_phone,
      destination_provider: settings.payout_provider,
      destination_bank_code: settings.payout_bank_code,
      destination_bank_name: settings.payout_bank_name,
      destination_account_number: settings.payout_account_number,
      destination_holder_name: settings.payout_holder_name,
      status: 'scheduled',
      scheduled_for: now.toISOString(),
      kind: 'withdrawal',
      requested_at: now.toISOString(),
      failure_code: null,
      failure_message: null,
    })
    .select(PAYOUT_COLUMNS)
    .maybeSingle();

  if (error) {
    // 23505 : l'index unique partiel a bloqué un second retrait concurrent.
    if ((error as { code?: string }).code === '23505') {
      throw new PaymentServiceError(
        'PAYOUT_WITHDRAWAL_PENDING',
        'Un retrait est déjà en cours de traitement.',
        409,
      );
    }
    throw error;
  }
  if (!data) {
    throw new PaymentServiceError(
      'PAYOUT_UPDATE_FAILED',
      'Retrait enregistré sans identifiant.',
      500,
    );
  }

  const payout = data as PayoutRow;
  await notifyGerant(
    clerkUserId,
    'payout_scheduled',
    `Votre demande de retrait de ${requested} ${balance.currency} a été enregistrée.`,
    null,
  );

  return { payout, balance: await computeGerantBalance(clerkUserId) };
}

// ============================================================
// Envoi et réconciliation des reversements pawaPay
// ============================================================

function isDefinitivePawapayError(error: unknown): boolean {
  return (
    error instanceof PawapayConfigError ||
    (error instanceof PawapayApiError &&
      error.statusCode >= 400 &&
      error.statusCode < 500)
  );
}

/**
 * Envoie les retraits `scheduled` via pawaPay.
 *
 * Le même mécanisme de « claim » : le statut passe à `processing`
 * AVANT l'appel réseau. Si le process s'arrête entre-temps, la ligne est
 * réconciliée, jamais renvoyée à l'aveugle.
 */
export async function processScheduledPayoutsPawapay(
  now: Date = new Date(),
): Promise<ProcessResult> {
  if (!isPawapayProvider()) {
    return { skipped: true, checked: 0, sent: 0, paid: 0, failed: 0, deferred: 0 };
  }

  try {
    getPawapayConfig();
  } catch (error) {
    if (error instanceof PawapayConfigError) {
      console.warn(`[payout:pawapay] non configuré : ${error.code}`);
      return { skipped: true, checked: 0, sent: 0, paid: 0, failed: 0, deferred: 0 };
    }
    throw error;
  }

  const { data, error } = await supabaseAdmin
    .from('payment_payouts')
    .select(PAYOUT_COLUMNS)
    .eq('status', 'scheduled')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(PAYOUT_BATCH_SIZE);
  if (error) throw error;

  const payouts = (data as PayoutRow[] | null) ?? [];
  const settingsByGerant = await fetchSettingsFor([
    ...new Set(payouts.map((payout) => payout.gerant_clerk_user_id)),
  ]);

  let sent = 0;
  let paid = 0;
  let failed = 0;
  let deferred = 0;

  for (const payout of payouts) {
    const settings = settingsByGerant.get(payout.gerant_clerk_user_id);
    if (!settings || !hasValidPawapayDestination(settings)) {
      const { error: updateError } = await supabaseAdmin
        .from('payment_payouts')
        .update({
          failure_code: 'payout_details_missing',
          failure_message: 'Coordonnées de reversement à compléter et vérifier.',
          updated_at: now.toISOString(),
        })
        .eq('id', payout.id)
        .eq('status', 'scheduled');
      if (updateError) throw updateError;
      deferred += 1;
      continue;
    }

    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('payment_payouts')
      .update({
        status: 'processing',
        destination_type: 'mobile_money',
        destination_phone: settings.payout_phone,
        destination_provider: settings.payout_provider,
        destination_holder_name: settings.payout_holder_name,
        failure_code: null,
        failure_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payout.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) continue; // un autre passage l'a déjà pris

    try {
      const result = await createPawapayPayout({
        amount: Number(payout.net_amount),
        currency: payout.currency as PawapayCurrency,
        phoneNumber: formatPhoneNumberForPawapay(settings.payout_phone!, settings.market),
        provider: settings.payout_provider!.trim().toUpperCase(),
        paymentPayoutId: payout.id,
      });
      sent += 1;

      if (result.status === 'COMPLETED') {
        await markPayoutPaid(payout, { id: result.payoutId });
        paid += 1;
      } else if (result.status === 'FAILED' || result.status === 'REJECTED') {
        await markPayoutFailed(
          payout,
          result.status.toLowerCase(),
          result.failureReason?.failureMessage ?? 'Reversement refusé par pawaPay.',
        );
        failed += 1;
      } else {
        const { error: updateError } = await supabaseAdmin
          .from('payment_payouts')
          .update({
            provider_transfer_id: result.payoutId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payout.id);
        if (updateError) throw updateError;
      }
    } catch (err) {
      if (isDefinitivePawapayError(err)) {
        await markPayoutFailed(
          payout,
          err instanceof PawapayApiError ? 'pawapay_refused' : 'pawapay_config',
          err instanceof Error ? err.message : 'Reversement refusé.',
        );
        failed += 1;
        continue;
      }

      // Issue incertaine : l'argent a pu partir. On garde `processing` et la
      // réconciliation relira pawaPay par identifiant.
      const { error: updateError } = await supabaseAdmin
        .from('payment_payouts')
        .update({
          failure_code: 'unconfirmed',
          failure_message: (err instanceof Error ? err.message : 'Issue incertaine').slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payout.id);
      if (updateError) throw updateError;
    }
  }

  return { skipped: false, checked: payouts.length, sent, paid, failed, deferred };
}

/**
 * Relit les retraits pawaPay restés `processing`.
 */
export async function reconcileProcessingPayoutsPawapay(
  now: Date = new Date(),
): Promise<ReconcilePayoutsResult> {
  if (!isPawapayProvider()) {
    return { skipped: true, checked: 0, updated: 0, requeued: 0 };
  }

  try {
    getPawapayConfig();
  } catch (error) {
    if (error instanceof PawapayConfigError) {
      return { skipped: true, checked: 0, updated: 0, requeued: 0 };
    }
    throw error;
  }

  const cutoff = new Date(now.getTime() - PAYOUT_RECONCILE_MIN_AGE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('payment_payouts')
    .select(PAYOUT_COLUMNS)
    .eq('status', 'processing')
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(PAYOUT_BATCH_SIZE);
  if (error) throw error;

  const payouts = (data as PayoutRow[] | null) ?? [];
  let updated = 0;
  let requeued = 0;

  for (const payout of payouts) {
    if (!payout.provider_transfer_id) {
      const age = now.getTime() - new Date(payout.updated_at).getTime();
      if (age >= PAYOUT_UNCONFIRMED_RETRY_MS) {
        const { error: updateError } = await supabaseAdmin
          .from('payment_payouts')
          .update({
            status: 'scheduled',
            failure_code: 'unconfirmed',
            failure_message: 'Aucun identifiant pawaPay : nouvel essai programmé.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payout.id)
          .eq('status', 'processing');
        if (updateError) throw updateError;
        requeued += 1;
      }
      continue;
    }

    try {
      const resource = await getPawapayPayout(payout.provider_transfer_id);
      if (resource.status === 'COMPLETED') {
        await markPayoutPaid(payout, { id: resource.payoutId });
        updated += 1;
      } else if (resource.status === 'FAILED' || resource.status === 'REJECTED') {
        await markPayoutFailed(
          payout,
          resource.status.toLowerCase(),
          resource.failureReason?.failureMessage ?? 'Reversement refusé par pawaPay.',
        );
        updated += 1;
      } else {
        const { error: updateError } = await supabaseAdmin
          .from('payment_payouts')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', payout.id);
        if (updateError) throw updateError;
        updated += 1;
      }
    } catch (err) {
      if (err instanceof PaymentServiceError && err.status === 404) {
        await markPayoutFailed(payout, 'payout_not_found', 'Reversement introuvable chez pawaPay.');
        updated += 1;
      } else {
        console.error(
          `[payout:reconcile:pawapay] ${payout.reference} :`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return { skipped: false, checked: payouts.length, updated, requeued };
}
