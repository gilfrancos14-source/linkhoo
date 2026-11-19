/**
 * Reprise des messages de contact dont l'envoi d'email a échoué.
 *
 * Bonnes pratiques appliquées :
 *   - backoff exponentiel borné (5 min → 15 min → 1 h → 6 h → 24 h, 5 essais) ;
 *   - réservation atomique (`status: processing`) pour ne jamais renvoyer deux
 *     fois le même message si plusieurs instances du backend tournent ;
 *   - libération des verrous abandonnés (crash d'un worker) après 10 min ;
 *   - opérations idempotentes : on ne reprend que `failed`, on n'écrit `sent`
 *     que si le verrou est toujours détenu ;
 *   - ticks chaînés avec un flag `running` : aucun chevauchement.
 */

import { supabaseAdmin } from '../config/supabase';
import { contactMessageSchema } from '../validations/contact';
import { sendContactEmail } from './mailer';

const TABLE = 'contact_messages';
const COLUMNS =
  'id, nom, prenom, email, telephone, pays, sujet, message, market, attempts, error, created_at';

export const CONTACT_MAX_ATTEMPTS = 5;
export const CONTACT_RETRY_BACKOFF_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const BATCH_SIZE = 20;

export const CONTACT_RETRY_INTERVAL_MS = 10 * 60 * 1000;
export const CONTACT_RETRY_INITIAL_DELAY_MS = 2 * 60 * 1000;

export function nextRetryDelay(attempts: number): number {
  const index = Math.min(Math.max(attempts - 1, 0), CONTACT_RETRY_BACKOFF_MS.length - 1);
  return CONTACT_RETRY_BACKOFF_MS[index];
}

interface FailedContactRow {
  id: string;
  nom: string;
  prenom: string | null;
  email: string;
  telephone: string | null;
  pays: string;
  sujet: string;
  message: string;
  market: string | null;
  attempts: number;
  error: string | null;
  created_at: string;
}

export interface ContactRetryResult {
  reclaimed: number;
  sent: number;
  failed: number;
  exhausted: number;
}

async function releaseStaleLocks(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - LOCK_TIMEOUT_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update({ status: 'failed', locked_at: null })
    .eq('status', 'processing')
    .lt('locked_at', cutoff)
    .select('id');
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}

async function fetchDueRows(nowIso: string): Promise<FailedContactRow[]> {
  // Deux builders distincts : les méthodes du builder Supabase sont mutables,
  // les réutiliser appliquerait les deux filtres aux deux requêtes.
  const buildQuery = () =>
    supabaseAdmin.from(TABLE).select(COLUMNS)
      .eq('status', 'failed')
      .lt('attempts', CONTACT_MAX_ATTEMPTS)
      .order('created_at', { ascending: true });

  // Deux requêtes simples plutôt qu'un `.or()` sur un timestamp : le format
  // PostgREST des filtres `or` sur TIMESTAMPTZ est source de confusion.
  const [neverTried, due] = await Promise.all([
    buildQuery().is('next_retry_at', null).limit(BATCH_SIZE),
    buildQuery().lte('next_retry_at', nowIso).limit(BATCH_SIZE),
  ]);
  if (neverTried.error) throw neverTried.error;
  if (due.error) throw due.error;

  const byId = new Map<string, FailedContactRow>();
  for (const row of [...(neverTried.data ?? []), ...(due.data ?? [])] as FailedContactRow[]) {
    byId.set(row.id, row);
  }
  return [...byId.values()].slice(0, BATCH_SIZE);
}

async function claim(row: FailedContactRow, nowIso: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update({ status: 'processing', locked_at: nowIso })
    .eq('id', row.id)
    .eq('status', 'failed')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/**
 * Un passage complet. Exporté pour les tests et un déclenchement manuel.
 */
export async function runContactRetries(now: Date = new Date()): Promise<ContactRetryResult> {
  const result: ContactRetryResult = { reclaimed: 0, sent: 0, failed: 0, exhausted: 0 };
  const nowIso = now.toISOString();

  result.reclaimed = await releaseStaleLocks(now);
  const rows = await fetchDueRows(nowIso);

  for (const row of rows) {
    if (!(await claim(row, nowIso))) continue;

    try {
      // Reconstitution d'une entrée valide : le message a déjà été validé à
      // l'insertion, mais on repasse par le schéma pour garder une seule source
      // de vérité (et neutraliser toute valeur `null` de la base).
      const input = contactMessageSchema.parse({
        nom: row.nom,
        prenom: row.prenom ?? undefined,
        email: row.email,
        telephone: row.telephone ?? undefined,
        pays: row.pays,
        sujet: row.sujet,
        message: row.message,
        market: row.market ?? undefined,
        website: '',
      });
      await sendContactEmail(input);

      const { error } = await supabaseAdmin
        .from(TABLE)
        .update({
          status: 'sent',
          sent_at: nowIso,
          locked_at: null,
          next_retry_at: null,
          error: null,
        })
        .eq('id', row.id)
        .eq('status', 'processing');
      if (error) throw error;
      result.sent += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Erreur inconnue';
      const attempts = row.attempts + 1;
      const exhausted = attempts >= CONTACT_MAX_ATTEMPTS;
      const { error: updateError } = await supabaseAdmin
        .from(TABLE)
        .update({
          status: 'failed',
          attempts,
          next_retry_at: exhausted ? null : new Date(now.getTime() + nextRetryDelay(attempts)).toISOString(),
          error: exhausted ? `Tentatives épuisées : ${reason}` : reason,
          locked_at: null,
        })
        .eq('id', row.id)
        .eq('status', 'processing');
      if (updateError) {
        console.error(`[contact:retry] mise à jour impossible (${row.id}) :`, updateError.message);
      }
      if (exhausted) result.exhausted += 1;
      else result.failed += 1;
    }
  }

  return result;
}

export interface ContactRetryJobsOptions {
  readonly initialDelayMs?: number;
  readonly intervalMs?: number;
}

/** Démarre l'ordonnanceur ; timers unref, retourne la fonction d'arrêt. */
export function startContactRetryJobs(options: ContactRetryJobsOptions = {}): () => void {
  const initialDelayMs = options.initialDelayMs ?? CONTACT_RETRY_INITIAL_DELAY_MS;
  const intervalMs = options.intervalMs ?? CONTACT_RETRY_INTERVAL_MS;

  let stopped = false;
  let running = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const result = await runContactRetries();
      if (result.sent || result.reclaimed || result.exhausted) {
        console.log('[contact:retry]', result);
      }
    } catch (error) {
      console.error(
        '[contact:retry] passage impossible :',
        error instanceof Error ? error.message : error,
      );
    } finally {
      running = false;
      if (!stopped) {
        timer = setTimeout(() => void tick(), intervalMs);
        timer.unref();
      }
    }
  };

  timer = setTimeout(() => void tick(), initialDelayMs);
  timer.unref();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
