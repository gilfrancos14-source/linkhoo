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
 *   2. `processScheduledPayouts` « claim » la ligne (`scheduled →
 *      processing`) avant l'appel Hub2 : deux workers ne peuvent pas envoyer
 *      le même transfert. Le `reference` unique sert de seconde barrière.
 *   3. `applyTransferEvent` / `reconcileProcessingPayouts` closent le statut.
 *      Un `paid` n'est jamais rétrogradé par un événement tardif.
 *
 * Aucun reversement ne part sans destination vérifiée : la ligne reste
 * `scheduled` avec `failure_code = 'payout_details_missing'`, et le gérant
 * reçoit une notification l'invitant à renseigner ses coordonnées.
 */

import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../../config/supabase';
import type { MarketCode } from '../../config/markets';
import { getHub2Config, Hub2ConfigError } from '../config';
import { PaymentServiceError } from '../errors';
import { Hub2Error } from '../hub2/client';
import {
  createTransfer,
  findTransferByReference,
  getTransfer,
  type TransferResult,
} from '../hub2/transfers';
import type { EventKind } from '../hub2/mapping';
import type { Hub2Event } from '../hub2/webhooks';
import { getPaymentPolicy } from '../policies';
import { isHub2Provider } from '../provider';
import type {
  Hub2Currency,
  PayoutMethod,
  TransferDestination,
  TransferStatus,
} from '../types';

export const PAYOUT_BATCH_SIZE = 50;

/** Un transfert sans réponse est relu après ce délai avant tout nouvel envoi. */
export const PAYOUT_RECONCILE_MIN_AGE_MS = 10 * 60 * 1000;

/** Au-delà, un transfert introuvable côté Hub2 repart en file (`scheduled`). */
export const PAYOUT_UNCONFIRMED_RETRY_MS = 60 * 60 * 1000;

export const PAYOUT_SETTINGS_COLUMNS =
  'clerk_user_id, market, payout_method, payout_phone, payout_provider, payout_bank_code, payout_bank_name, payout_account_number, payout_holder_name, payout_verified_at';

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
  created_at: string;
  updated_at: string;
}

const PAYOUT_COLUMNS =
  'id, reference, reservation_id, gerant_clerk_user_id, market, gross_amount, commission_amount, refunded_amount, net_amount, currency, provider_transfer_id, destination_type, destination_phone, destination_provider, destination_bank_code, destination_bank_name, destination_account_number, destination_holder_name, status, scheduled_for, paid_at, failure_code, failure_message, created_at, updated_at';

/** Champs manquants pour construire une destination Hub2 valide. */
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

/** Vrai si le gérant a déclaré ET fait vérifier une destination complète. */
export function hasVerifiedPayoutDestination(settings: PayoutSettings): boolean {
  return Boolean(settings.payout_verified_at) && missingPayoutFields(settings).length === 0;
}

/**
 * Construit la destination attendue par `POST /transfers`.
 *
 * `country` est le marché du gérant (code ISO à deux lettres) : un gérant CI
 * est reversé en CI, jamais dans un autre pays.
 */
export function buildTransferDestination(
  settings: PayoutSettings,
): TransferDestination | null {
  if (missingPayoutFields(settings).length > 0 || !settings.payout_method) return null;

  const holder = settings.payout_holder_name!.trim();
  const phone = settings.payout_phone!.trim();

  if (settings.payout_method === 'mobile_money') {
    return {
      type: 'mobile_money',
      country: settings.market,
      msisdn: phone,
      provider: settings.payout_provider!.trim().toLowerCase(),
      recipientName: holder,
    };
  }

  return {
    type: 'bank_transfer',
    country: settings.market,
    accountNumber: settings.payout_account_number!.trim(),
    accountOwner: holder,
    bankCode: settings.payout_bank_code!.trim(),
    bankName: settings.payout_bank_name!.trim(),
    beneficiaryPhone: phone,
    recipientName: holder,
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
 * Crée les reversements dus, sans contacter Hub2.
 *
 * L'appel réseau est laissé à `processScheduledPayouts` : une panne Hub2 ne
 * doit pas empêcher la comptabilisation du dû.
 */
export async function scheduleDuePayouts(now: Date = new Date()): Promise<ScheduleResult> {
  if (!isHub2Provider()) {
    return { skipped: true, checked: 0, created: 0, blocked: 0 };
  }

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('id, room_id, date_debut, payment_id, refunded_amount')
    .eq('statut', 'confirmee')
    .eq('payment_status', 'paid')
    .not('payment_id', 'is', null)
    .not('date_debut', 'is', null)
    .lte('date_debut', todayUtc(now))
    .order('date_debut', { ascending: true })
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
    const dueAt = payoutDueAt(reservation.date_debut, policy.payoutDelayHours);
    if (!dueAt || dueAt.getTime() > now.getTime()) continue;

    const amounts = computePayoutAmounts({
      gross: Number(payment.amount),
      commissionPercent: policy.commissionPercent,
      refunded: Number(reservation.refunded_amount ?? 0),
    });
    if (!amounts) continue;

    const settings = settingsByGerant.get(gerantId);
    const destination = settings ? buildTransferDestination(settings) : null;
    const verified = settings ? hasVerifiedPayoutDestination(settings) : false;
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
      destination_bank_code: settings?.payout_bank_code ?? null,
      destination_bank_name: settings?.payout_bank_name ?? null,
      destination_account_number: settings?.payout_account_number ?? null,
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

function isDefinitiveProviderError(error: unknown): boolean {
  return (
    error instanceof Hub2ConfigError ||
    (error instanceof Hub2Error &&
      error.status !== null &&
      error.status >= 400 &&
      error.status < 500)
  );
}

function failureFromTransfer(transfer: TransferResult): {
  code: string;
  message: string;
} {
  return {
    code: transfer.failureCode ?? 'transfer_failed',
    message: (transfer.failureMessage ?? 'Reversement refusé par Hub2.').slice(0, 500),
  };
}

async function markPayoutPaid(payout: PayoutRow, transfer: TransferResult): Promise<void> {
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

/**
 * Envoie les reversements `scheduled`.
 *
 * Le statut est « claim » avant l'appel : si le process s'arrête entre le
 * claim et la réponse, la ligne reste `processing` et sera réconciliée, jamais
 * renvoyée à l'aveugle.
 */
export async function processScheduledPayouts(now: Date = new Date()): Promise<ProcessResult> {
  if (!isHub2Provider()) {
    return { skipped: true, checked: 0, sent: 0, paid: 0, failed: 0, deferred: 0 };
  }

  let config;
  try {
    config = getHub2Config();
  } catch (error) {
    if (error instanceof Hub2ConfigError) {
      console.warn(`[payout] Hub2 non configuré : ${error.code}`);
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
    const destination = settings ? buildTransferDestination(settings) : null;
    const verified = settings ? hasVerifiedPayoutDestination(settings) : false;

    if (!verified || !destination || !settings) {
      // Toujours en attente de coordonnées : on ne « claim » pas la ligne,
      // elle repassera au prochain tour (le gérant peut les compléter).
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

    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('payment_payouts')
      .update({
        status: 'processing',
        destination_type: settings.payout_method!,
        destination_phone: settings.payout_phone,
        destination_provider: settings.payout_provider,
        destination_bank_code: settings.payout_bank_code,
        destination_bank_name: settings.payout_bank_name,
        destination_account_number: settings.payout_account_number,
        destination_holder_name: settings.payout_holder_name,
        failure_code: null,
        failure_message: null,
        updated_at: claimedAt,
      })
      .eq('id', payout.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) continue; // un autre passage l'a déjà pris

    try {
      const transfer = await createTransfer(config, {
        reference: payout.reference,
        amount: Number(payout.net_amount),
        currency: payout.currency as Hub2Currency,
        description: `Reversement séjour ${payout.reservation_id ?? payout.reference}`,
        destination,
      });
      sent += 1;

      if (transfer.status === 'paid') {
        await markPayoutPaid(payout, transfer);
        paid += 1;
      } else if (transfer.status === 'failed') {
        const failure = failureFromTransfer(transfer);
        await markPayoutFailed(payout, failure.code, failure.message);
        failed += 1;
      } else {
        // `processing` : le webhook ou la réconciliation tranchera.
        const { error: updateError } = await supabaseAdmin
          .from('payment_payouts')
          .update({
            provider_transfer_id: transfer.id,
            failure_code: null,
            failure_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payout.id);
        if (updateError) throw updateError;
      }
    } catch (err) {
      if (isDefinitiveProviderError(err)) {
        await markPayoutFailed(
          payout,
          err instanceof Hub2Error ? err.code : 'payout_refused',
          err instanceof Error ? err.message : 'Reversement refusé.',
        );
        failed += 1;
        continue;
      }

      // Issue incertaine : l'argent a pu partir. On garde `processing` et on
      // laisse la réconciliation relire Hub2 par référence.
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

async function findPayoutByTransferId(transferId: string): Promise<PayoutRow | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_payouts')
    .select(PAYOUT_COLUMNS)
    .eq('provider_transfer_id', transferId)
    .maybeSingle();
  if (error) throw error;
  return (data as PayoutRow | null) ?? null;
}

/**
 * Applique un webhook `transfer.*`.
 *
 * Un `paid` est terminal : un `transfer.failed` livré en retard ne doit pas
 * « dé-payer » un gérant déjà crédité.
 */
export async function applyTransferEvent(
  event: Hub2Event,
  kind: EventKind,
  transferId: string | null,
): Promise<{ handled: boolean; reason?: string }> {
  if (!transferId) return { handled: false, reason: 'missing_reference' };

  const payout = await findPayoutByTransferId(transferId);
  if (!payout) return { handled: false, reason: 'payout_not_found' };
  if (payout.status === 'paid') return { handled: true };

  const providerStatus =
    typeof event.data.status === 'string' ? event.data.status : null;

  switch (kind) {
    case 'transfer_succeeded':
      await markPayoutPaid(payout, {
        id: transferId,
        reference: payout.reference,
        status: 'paid',
        providerStatus: providerStatus ?? 'successful',
        amount: Number(payout.net_amount),
        currency: payout.currency,
        failureCode: null,
        failureMessage: null,
      });
      return { handled: true };

    case 'transfer_failed': {
      const failure =
        event.data.failureCause && typeof event.data.failureCause === 'object'
          ? (event.data.failureCause as { code?: unknown; message?: unknown })
          : null;
      await markPayoutFailed(
        payout,
        typeof failure?.code === 'string' ? failure.code : 'transfer_failed',
        typeof failure?.message === 'string'
          ? failure.message
          : 'Reversement refusé par Hub2.',
      );
      return { handled: true };
    }

    case 'transfer_processing':
    default: {
      const { error } = await supabaseAdmin
        .from('payment_payouts')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', payout.id)
        .neq('status', 'paid');
      if (error) throw error;
      return { handled: true };
    }
  }
}

export interface ReconcilePayoutsResult {
  readonly skipped: boolean;
  readonly checked: number;
  readonly updated: number;
  readonly requeued: number;
}

/**
 * Relit les reversements restés `processing`.
 *
 * C'est le filet de sécurité d'un `POST /transfers` sans réponse : on cherche
 * d'abord par identifiant, puis par référence. Sans trace après une heure, la
 * ligne repart en `scheduled` — le rejeu est sûr, Hub2 déduplique par
 * `reference`.
 */
export async function reconcileProcessingPayouts(
  now: Date = new Date(),
): Promise<ReconcilePayoutsResult> {
  if (!isHub2Provider()) {
    return { skipped: true, checked: 0, updated: 0, requeued: 0 };
  }

  let config;
  try {
    config = getHub2Config();
  } catch (error) {
    if (error instanceof Hub2ConfigError) {
      console.warn(`[payout:reconcile] Hub2 non configuré : ${error.code}`);
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
    try {
      const transfer = payout.provider_transfer_id
        ? await getTransfer(config, payout.provider_transfer_id)
        : await findTransferByReference(config, payout.reference);

      if (transfer) {
        if (transfer.status === 'paid') {
          await markPayoutPaid(payout, transfer);
          updated += 1;
        } else if (transfer.status === 'failed') {
          const failure = failureFromTransfer(transfer);
          await markPayoutFailed(payout, failure.code, failure.message);
          updated += 1;
        } else {
          const { error: updateError } = await supabaseAdmin
            .from('payment_payouts')
            .update({
              provider_transfer_id: transfer.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payout.id);
          if (updateError) throw updateError;
          updated += 1;
        }
        continue;
      }

      const age = now.getTime() - new Date(payout.updated_at).getTime();
      if (age >= PAYOUT_UNCONFIRMED_RETRY_MS) {
        const { error: updateError } = await supabaseAdmin
          .from('payment_payouts')
          .update({
            status: 'scheduled',
            failure_code: 'unconfirmed',
            failure_message: 'Transfert introuvable chez Hub2 : nouvel essai programmé.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payout.id)
          .eq('status', 'processing');
        if (updateError) throw updateError;
        requeued += 1;
      }
    } catch (err) {
      console.error(
        `[payout:reconcile] ${payout.reference} :`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { skipped: false, checked: payouts.length, updated, requeued };
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

  const normalized = {
    payout_method: input.method,
    payout_phone: input.phone?.trim() || null,
    payout_provider: input.provider?.trim().toLowerCase() || null,
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
