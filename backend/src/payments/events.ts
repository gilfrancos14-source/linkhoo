/**
 * Persistance des événements webhook Hub2.
 *
 * `payment_events` est à la fois un journal d'audit et une file de reprise :
 *   - l'unicité (provider, provider_event_id) rend le rejeu inoffensif ;
 *   - `processed_at` reste NULL tant que le traitement métier n'a pas abouti,
 *     ce qui permet à un cron de reprendre les événements en échec.
 *
 * Le mode observation (`PAYMENTS_APPLY_EVENTS=false`, défaut) stocke
 * l'événement puis le marque traité sans rien activer. C'est la phase 1 : on
 * compare le flux réel Hub2 au modèle avant de créditer quoi que ce soit.
 */

import { supabaseAdmin } from '../config/supabase';
import type { Hub2Event } from './hub2/webhooks';

export interface RecordEventResult {
  /** `null` quand l'événement était déjà présent (doublon). */
  readonly id: string | null;
  readonly duplicate: boolean;
}

/** La migration 0030 n'est pas appliquée sur cette base. */
export class PaymentTableMissingError extends Error {
  constructor(table: string) {
    super(`Table ${table} absente : appliquez la migration 0030_paiements_hub2.sql.`);
    this.name = 'PaymentTableMissingError';
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string;
}

function isMissingTable(error: PostgrestLikeError): boolean {
  // 42P01 = undefined_table (Postgres). PostgREST peut aussi renvoyer PGRST205
  // quand la table est absente du cache de schéma.
  return error.code === '42P01' || error.code === 'PGRST205';
}

function isUniqueViolation(error: PostgrestLikeError): boolean {
  return error.code === '23505';
}

/**
 * Insère l'événement. Un doublon n'est pas une erreur : Hub2 a le droit de
 * rejouer un webhook, la réponse doit rester 2xx.
 */
export async function recordPaymentEvent(event: Hub2Event): Promise<RecordEventResult> {
  const { data, error } = await supabaseAdmin
    .from('payment_events')
    .insert({
      provider: 'hub2',
      provider_event_id: event.id,
      event_type: event.type,
      payload: event.payload,
    })
    .select('id')
    .single();

  if (error) {
    const pgError = error as PostgrestLikeError;
    if (isUniqueViolation(pgError)) return { id: null, duplicate: true };
    if (isMissingTable(pgError)) throw new PaymentTableMissingError('payment_events');
    throw new Error(`payment_events: ${pgError.message ?? 'insertion impossible'}`);
  }

  const id = data && typeof (data as { id?: unknown }).id === 'string'
    ? (data as { id: string }).id
    : null;
  return { id, duplicate: false };
}

/**
 * Marque l'événement traité.
 *
 * `processingError` sert de motif d'observation (`observation_mode`) ou
 * d'erreur métier ; il ne doit jamais contenir de donnée personnelle.
 */
export async function markPaymentEventProcessed(
  id: string | null,
  processingError: string | null = null,
): Promise<void> {
  if (!id) return;
  const { error } = await supabaseAdmin
    .from('payment_events')
    .update({ processed_at: new Date().toISOString(), processing_error: processingError })
    .eq('id', id);

  if (error) {
    const pgError = error as PostgrestLikeError;
    if (isMissingTable(pgError)) throw new PaymentTableMissingError('payment_events');
    throw new Error(`payment_events: ${pgError.message ?? 'mise à jour impossible'}`);
  }
}

/**
 * Conserve l'événement dans la file de reprise (`processed_at` reste NULL) et
 * note la raison de l'échec. Le compteur `attempts` est laissé au cron, qui
 * seul connaît le nombre de reprises déjà effectuées.
 */
export async function markPaymentEventFailed(id: string | null, reason: string): Promise<void> {
  if (!id) return;
  const { error } = await supabaseAdmin
    .from('payment_events')
    .update({ processing_error: reason })
    .eq('id', id);

  if (error) {
    const pgError = error as PostgrestLikeError;
    if (isMissingTable(pgError)) throw new PaymentTableMissingError('payment_events');
    throw new Error(`payment_events: ${pgError.message ?? 'mise à jour impossible'}`);
  }
}
