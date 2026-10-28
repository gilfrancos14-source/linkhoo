/**
 * Lecture de l'état réel d'un paiement chez Hub2.
 *
 * Le webhook est le chemin nominal, mais le retour navigateur peut arriver
 * avant lui. Les deux flux (premium, réservation) ont donc besoin de la même
 * logique de secours :
 *
 *   1. `GET /payment-intents?purchaseReference=…` (source documentée) ;
 *   2. si l'intent est introuvable ou n'a pas réussi, `GET /payment-links/{id}`
 *      (hypothèse non documentée : un Payment Link peut ne pas propager
 *      `purchaseReference` à son intent — le lien, lui, est certain).
 *
 * L'identifiant retenu est celui du PAIEMENT (`pay_…`), pas celui de l'intent :
 * c'est ce que Hub2 attend pour un remboursement.
 */

import type { Hub2Config } from '../types';
import { hub2Request } from '../hub2/client';
import { mapPaymentStatus } from '../hub2/mapping';

export interface ProviderPayment {
  readonly id: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
}

export interface ProviderPaymentLookup {
  readonly payment: ProviderPayment | null;
  /** Dernier statut connu de l'intent, pour informer le payeur. */
  readonly latestStatus: string;
}

interface ProviderIntent {
  id?: unknown;
  status?: unknown;
  purchaseReference?: unknown;
  updatedAt?: unknown;
  amount?: unknown;
  currency?: unknown;
  payments?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function providerNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : null;
}

export function providerCurrency(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null;
}

function matchingIntents(payload: unknown, reference: string): ProviderIntent[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown } | null)?.data)
      ? (payload as { data: unknown[] }).data
      : [];

  return list
    .filter((item): item is ProviderIntent => isRecord(item))
    .filter((item) => item.purchaseReference === reference)
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
}

function pickSuccessfulIntent(payload: unknown, reference: string): ProviderIntent | null {
  return (
    matchingIntents(payload, reference).find(
      (item) => mapPaymentStatus(item.status) === 'succeeded',
    ) ?? null
  );
}

export function latestIntentStatus(payload: unknown, reference: string): string {
  const latest = matchingIntents(payload, reference)[0];
  return mapPaymentStatus(latest?.status) ?? 'pending';
}

/** Identifiant du paiement (et non de l'intent), avec repli sur l'intent. */
function intentPaymentId(intent: ProviderIntent): string | null {
  const attempts = Array.isArray(intent.payments) ? intent.payments : [];
  const records = attempts.filter(isRecord);
  const successful = records.find((item) => mapPaymentStatus(item.status) === 'succeeded');
  const chosen = successful ?? records[0];
  if (chosen && typeof chosen.id === 'string' && chosen.id.trim()) return chosen.id.trim();
  return typeof intent.id === 'string' ? intent.id : null;
}

function successfulAttempt(payload: Record<string, unknown>): Record<string, unknown> | null {
  const attempts = Array.isArray(payload.paymentAttempts) ? payload.paymentAttempts : [];
  return (
    attempts
      .filter(isRecord)
      .filter((item) => mapPaymentStatus(item.status) === 'succeeded')
      .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))[0] ?? null
  );
}

async function findLinkSuccess(
  config: Hub2Config,
  linkId: string,
): Promise<ProviderPayment | null> {
  const link = await hub2Request<Record<string, unknown>>(
    config,
    `/payment-links/${encodeURIComponent(linkId)}`,
    { retryOnTransient: true },
  );

  const attempt = successfulAttempt(link);
  if (attempt) {
    return {
      id: typeof attempt.id === 'string' ? attempt.id : null,
      amount: providerNumber(attempt.amount),
      currency: providerCurrency(attempt.currency),
    };
  }

  if (link.status === 'completed') {
    return {
      id: null,
      amount: providerNumber(link.amount),
      currency: providerCurrency(link.currency),
    };
  }

  return null;
}

/**
 * Cherche un encaissement réussi chez Hub2.
 *
 * Ne lève pas pour « pas encore payé » : renvoie `payment: null` et le dernier
 * statut, l'appelant décide du code HTTP (400 côté confirmation).
 */
export async function lookupProviderPayment(
  config: Hub2Config,
  reference: string,
  linkId: string | null,
): Promise<ProviderPaymentLookup> {
  const payload = await hub2Request<unknown>(
    config,
    `/payment-intents?purchaseReference=${encodeURIComponent(reference)}&perPage=5`,
    { retryOnTransient: true },
  );

  const intent = pickSuccessfulIntent(payload, reference);
  if (intent) {
    return {
      payment: {
        id: intentPaymentId(intent),
        amount: providerNumber(intent.amount),
        currency: providerCurrency(intent.currency),
      },
      latestStatus: 'succeeded',
    };
  }

  const latestStatus = latestIntentStatus(payload, reference);
  if (linkId) {
    const fromLink = await findLinkSuccess(config, linkId);
    if (fromLink) return { payment: fromLink, latestStatus: 'succeeded' };
  }

  return { payment: null, latestStatus };
}
