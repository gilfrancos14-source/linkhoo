/**
 * Reversements Hub2 (PAY-OUT) — phase 4.
 *
 * `POST /transfers` est idempotent par `reference` côté Hub2 : rejouer le même
 * corps renvoie le transfert existant (HTTP 200 + `X-Idempotent-Replay`).
 * On s'appuie sur cette garantie plutôt que sur un rejeu local, et on garde
 * `payment_payouts.reference` unique en base.
 *
 * Aucun montant n'est décidé ici : le service de payout calcule le net et
 * fige la destination avant l'appel.
 */

import type {
  Hub2Config,
  Hub2Currency,
  TransferDestination,
  TransferStatus,
} from '../types';
import { hub2Request } from './client';
import { mapTransferStatus } from './mapping';

export interface CreateTransferInput {
  readonly reference: string;
  readonly amount: number;
  readonly currency: Hub2Currency;
  readonly description: string;
  readonly destination: TransferDestination;
}

export interface TransferResult {
  readonly id: string;
  readonly reference: string;
  /** Statut interne : jamais une valeur inconnue de Hub2. */
  readonly status: TransferStatus;
  /** Statut brut, conservé pour le diagnostic. */
  readonly providerStatus: string;
  readonly amount: number;
  readonly currency: string;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
}

interface TransferPayload {
  id?: unknown;
  reference?: unknown;
  status?: unknown;
  amount?: unknown;
  currency?: unknown;
  failureCause?: unknown;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeTransfer(raw: unknown): TransferResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as TransferPayload;

  const id = stringOrNull(payload.id);
  const providerStatus = stringOrNull(payload.status);
  if (!id || !providerStatus) return null;

  // Un statut inconnu ne doit pas faire croire à un échec : on retombe sur
  // `processing`, l'état le plus sûr (aucun nouvel envoi automatique).
  const status = mapTransferStatus(providerStatus) ?? 'processing';

  const failure =
    payload.failureCause && typeof payload.failureCause === 'object'
      ? (payload.failureCause as { code?: unknown; message?: unknown })
      : null;

  const amount = Number(payload.amount);

  return {
    id,
    reference: stringOrNull(payload.reference) ?? '',
    status,
    providerStatus,
    amount: Number.isFinite(amount) ? Math.trunc(amount) : 0,
    currency: stringOrNull(payload.currency) ?? '',
    failureCode: stringOrNull(failure?.code),
    failureMessage: stringOrNull(failure?.message),
  };
}

/**
 * Envoie un reversement.
 *
 * @throws Hub2Error — l'appelant distingue un refus définitif (4xx) d'une
 * issue incertaine (timeout, 5xx) : dans le second cas l'argent a pu partir.
 */
export async function createTransfer(
  config: Hub2Config,
  input: CreateTransferInput,
): Promise<TransferResult> {
  const response = await hub2Request<unknown>(config, '/transfers', {
    method: 'POST',
    body: {
      reference: input.reference,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      destination: input.destination,
    },
  });

  const transfer = normalizeTransfer(response);
  if (!transfer) {
    throw new Error('Réponse Hub2 illisible pour le transfert.');
  }
  return transfer;
}

/** Relit un transfert par son identifiant Hub2. */
export async function getTransfer(
  config: Hub2Config,
  transferId: string,
): Promise<TransferResult | null> {
  const response = await hub2Request<unknown>(
    config,
    `/transfers/${encodeURIComponent(transferId)}`,
    { retryOnTransient: true },
  );
  return normalizeTransfer(response);
}

/**
 * Retrouve un transfert par sa `reference` interne.
 *
 * Utile quand la création a échoué sans réponse : le transfert peut exister
 * malgré tout, et rejouer à l'aveugle vaudrait un double paiement.
 */
export async function findTransferByReference(
  config: Hub2Config,
  reference: string,
): Promise<TransferResult | null> {
  const response = await hub2Request<unknown>(
    config,
    `/transfers?reference=${encodeURIComponent(reference)}`,
    { retryOnTransient: true },
  );

  if (!Array.isArray(response)) return null;
  // Hub2 filtre normalement côté serveur, mais on ne fait jamais confiance à
  // un filtre ignoré : une référence différente serait un autre paiement.
  const match = response.find((item) => {
    if (!item || typeof item !== 'object') return false;
    return (item as { reference?: unknown }).reference === reference;
  });
  return normalizeTransfer(match ?? null);
}
