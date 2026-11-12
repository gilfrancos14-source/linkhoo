import { supabaseAdmin } from '../../config/supabase';
import { PaymentServiceError } from '../errors';

/**
 * Vue administrateur des reversements aux gérants.
 *
 * Le back-office doit pouvoir voir ce qui est parti, ce qui est en attente et
 * ce qui a échoué — et surtout **relancer** un reversement en échec : sans
 * cela, un transfert bloqué (numéro mobile money erroné, solde pawaPay
 * insuffisant) resterait bloqué jusqu'à l'intervention d'un développeur.
 */

export type AdminPayoutStatus = 'scheduled' | 'processing' | 'paid' | 'failed' | 'canceled';

export interface AdminPayoutRow {
  id: string;
  reference: string;
  reservation_id: string | null;
  kind: string;
  gerant_clerk_user_id: string;
  gerant_email: string | null;
  gerant_name: string | null;
  market: string;
  gross_amount: number;
  commission_amount: number;
  refunded_amount: number;
  net_amount: number;
  currency: string;
  destination_type: string;
  destination_phone: string | null;
  destination_provider: string | null;
  destination_holder_name: string | null;
  status: AdminPayoutStatus;
  scheduled_for: string;
  paid_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  requested_at: string | null;
  created_at: string;
}

export type AdminPayoutScope = 'all' | 'attention' | 'failed' | 'scheduled' | 'processing' | 'paid';

export interface ListAdminPayoutsInput {
  scope?: AdminPayoutScope;
  market?: string;
  limit?: number;
}

export interface AdminPayoutCounts {
  total: number;
  failed: number;
  scheduled: number;
  processing: number;
  paid: number;
}

export interface ListAdminPayoutsResult {
  items: AdminPayoutRow[];
  counts: AdminPayoutCounts;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const PAYOUT_COLUMNS =
  'id, reference, reservation_id, kind, gerant_clerk_user_id, market, gross_amount, ' +
  'commission_amount, refunded_amount, net_amount, currency, destination_type, ' +
  'destination_phone, destination_provider, destination_holder_name, status, ' +
  'scheduled_for, paid_at, failure_code, failure_message, requested_at, created_at';

interface PayoutDbRow {
  id: string;
  reference: string;
  reservation_id: string | null;
  kind: string | null;
  gerant_clerk_user_id: string;
  market: string;
  gross_amount: number | string;
  commission_amount: number | string;
  refunded_amount: number | string;
  net_amount: number | string;
  currency: string;
  destination_type: string;
  destination_phone: string | null;
  destination_provider: string | null;
  destination_holder_name: string | null;
  status: AdminPayoutStatus;
  scheduled_for: string;
  paid_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  requested_at: string | null;
  created_at: string;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scopeFilter(scope: AdminPayoutScope): { column?: string; values?: AdminPayoutStatus[] } {
  switch (scope) {
    case 'failed':
      return { values: ['failed'] };
    case 'scheduled':
      return { values: ['scheduled'] };
    case 'processing':
      return { values: ['processing'] };
    case 'paid':
      return { values: ['paid'] };
    case 'attention':
      // Ce qui demande une action : les échecs, et les programmés dont les
      // coordonnées de reversement manquent (le job les rebloquera).
      return { values: ['failed'] };
    default:
      return {};
  }
}

export async function listAdminPayouts(
  input: ListAdminPayoutsInput = {},
): Promise<ListAdminPayoutsResult> {
  const scope = input.scope ?? 'attention';
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const { data: countRows, error: countError } = await supabaseAdmin
    .from('payment_payouts')
    .select('status, failure_code');
  if (countError) throw countError;

  const counts: AdminPayoutCounts = {
    total: 0,
    failed: 0,
    scheduled: 0,
    processing: 0,
    paid: 0,
  };
  for (const row of (countRows as { status: AdminPayoutStatus; failure_code: string | null }[] | null) ??
    []) {
    if (row.status === 'failed') counts.failed += 1;
    else if (row.status === 'scheduled') counts.scheduled += 1;
    else if (row.status === 'processing') counts.processing += 1;
    else if (row.status === 'paid') counts.paid += 1;
    if (row.status !== 'canceled') counts.total += 1;
  }

  const filter = scopeFilter(scope);
  let query = supabaseAdmin
    .from('payment_payouts')
    .select(PAYOUT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (filter.values) query = query.in('status', filter.values);
  if (input.market) query = query.eq('market', input.market);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data as PayoutDbRow[] | null) ?? [];
  const gerantIds = [...new Set(rows.map((row) => row.gerant_clerk_user_id))];

  const { data: gerants, error: gerantsError } = await supabaseAdmin
    .from('gerants')
    .select('clerk_user_id, email, nom, prenom')
    .in('clerk_user_id', gerantIds.length > 0 ? gerantIds : ['']);
  if (gerantsError) throw gerantsError;

  const gerantById = new Map(
    ((gerants as { clerk_user_id: string; email: string | null; nom: string | null; prenom: string | null }[] | null) ??
      []).map((gerant) => [gerant.clerk_user_id, gerant]),
  );

  const items: AdminPayoutRow[] = rows.map((row) => {
    const gerant = gerantById.get(row.gerant_clerk_user_id);
    return {
      id: row.id,
      reference: row.reference,
      reservation_id: row.reservation_id,
      kind: row.kind ?? 'reservation',
      gerant_clerk_user_id: row.gerant_clerk_user_id,
      gerant_email: gerant?.email ?? null,
      gerant_name: [gerant?.prenom, gerant?.nom].filter(Boolean).join(' ') || null,
      market: row.market,
      gross_amount: toNumber(row.gross_amount),
      commission_amount: toNumber(row.commission_amount),
      refunded_amount: toNumber(row.refunded_amount),
      net_amount: toNumber(row.net_amount),
      currency: row.currency,
      destination_type: row.destination_type,
      destination_phone: row.destination_phone,
      destination_provider: row.destination_provider,
      destination_holder_name: row.destination_holder_name,
      status: row.status,
      scheduled_for: row.scheduled_for,
      paid_at: row.paid_at,
      failure_code: row.failure_code,
      failure_message: row.failure_message,
      requested_at: row.requested_at,
      created_at: row.created_at,
    };
  });

  return { items, counts };
}

/**
 * Remet un reversement en file d'attente.
 *
 * Seul un reversement en échec (ou bloqué pour coordonnées manquantes) peut
 * être relancé : un versement en cours ne doit pas être dupliqué, un
 * versement payé est définitif.
 */
export async function retryAdminPayout(id: string): Promise<AdminPayoutRow> {
  const { data: existing, error: readError } = await supabaseAdmin
    .from('payment_payouts')
    .select('id, status, failure_code')
    .eq('id', id)
    .maybeSingle();
  if (readError) throw readError;

  const row = existing as { id: string; status: AdminPayoutStatus; failure_code: string | null } | null;
  if (!row) {
    throw new PaymentServiceError('PAYOUT_NOT_FOUND', 'Reversement introuvable.', 404);
  }
  if (row.status === 'paid') {
    throw new PaymentServiceError(
      'PAYOUT_ALREADY_PAID',
      'Ce reversement a déjà été versé : il ne peut pas être relancé.',
      409,
    );
  }
  if (row.status === 'processing') {
    throw new PaymentServiceError(
      'PAYOUT_IN_PROGRESS',
      'Ce reversement est en cours de traitement.',
      409,
    );
  }
  if (row.status === 'canceled') {
    throw new PaymentServiceError(
      'PAYOUT_CANCELED',
      'Ce reversement a été annulé : relancez le séjour concerné.',
      409,
    );
  }

  const { data, error } = await supabaseAdmin
    .from('payment_payouts')
    .update({
      status: 'scheduled',
      failure_code: null,
      failure_message: null,
      scheduled_for: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(PAYOUT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new PaymentServiceError('PAYOUT_UPDATE_FAILED', 'Relance impossible.', 500);
  }

  const updated = data as PayoutDbRow;
  return {
    id: updated.id,
    reference: updated.reference,
    reservation_id: updated.reservation_id,
    kind: updated.kind ?? 'reservation',
    gerant_clerk_user_id: updated.gerant_clerk_user_id,
    gerant_email: null,
    gerant_name: null,
    market: updated.market,
    gross_amount: toNumber(updated.gross_amount),
    commission_amount: toNumber(updated.commission_amount),
    refunded_amount: toNumber(updated.refunded_amount),
    net_amount: toNumber(updated.net_amount),
    currency: updated.currency,
    destination_type: updated.destination_type,
    destination_phone: updated.destination_phone,
    destination_provider: updated.destination_provider,
    destination_holder_name: updated.destination_holder_name,
    status: updated.status,
    scheduled_for: updated.scheduled_for,
    paid_at: updated.paid_at,
    failure_code: updated.failure_code,
    failure_message: updated.failure_message,
    requested_at: updated.requested_at,
    created_at: updated.created_at,
  };
}
