import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { publishNotificationChanged } from '../utils/realtime';
import { requireClerkAuth, requireClerkOrAdminAuth } from '../middleware/clerkAuth';
import { idParamsSchema } from '../validations/common';
import { createClientLimiter } from '../utils/rateLimiters';
import { isQualifiedGerantUser } from '../utils/gerantAccess';
import { isPremiumActive } from '../utils/premium';
import { fetchAllRows } from '../utils/fetchAll';
import { calculateMontant, unitFromPriceUnit } from '../utils/duration';
import { RESERVATION_COLUMNS } from '../utils/selects';
import {
  CANCELLATION_TOO_LATE_MESSAGE,
  canCancelReservation,
  cancellationDeadlineIso,
} from '../payments/cancellation';
import {
  clientReservationQuerySchema,
  reservationCheckQuerySchema,
  reservationCreateSchema,
  reservationPaymentConfirmSchema,
  reservationStatusSchema,
} from '../validations/reservation';
import { PawapayConfigError } from '../payments/pawapay/config';
import { PaymentServiceError } from '../payments/errors';
import { PawapayApiError } from '../payments/pawapay/client';
import { startBookingPayment, confirmBookingPayment } from '../payments/service/booking';
import { requestReservationRefund } from '../payments/service/refund';
import type { RefundOutcome } from '../payments/service/refund';

const router = Router();
const clientLimiter = createClientLimiter({ prefix: 'reservations' });
const reserveLimiter = createClientLimiter({ limit: 10, prefix: 'reservations-create' });
const paymentLimiter = createClientLimiter({ limit: 30, prefix: 'reservations-payment' });

interface BookingPaymentPayload {
  state: 'checkout' | 'paid';
  reference?: string;
  checkout_url?: string;
  amount?: number;
  currency?: string;
  amount_xof?: number;
  expires_at?: string;
}

async function withBookingPayment<T extends { id: string }>(
  reservation: T,
): Promise<T & { payment: BookingPaymentPayload | null }> {
  try {
    const start = await startBookingPayment(reservation.id);
    if (start.state === 'checkout') {
      return {
        ...reservation,
        payment: {
          state: 'checkout',
          reference: start.session.reference,
          checkout_url: start.session.checkoutUrl,
          amount: start.session.amount,
          currency: start.session.currency,
          amount_xof: start.session.amountXof,
          expires_at: start.session.expiresAt,
        },
      };
    }
    if (start.state === 'paid') {
      return {
        ...reservation,
        payment: { state: 'paid', reference: start.reference ?? undefined },
      };
    }
    return { ...reservation, payment: null };
  } catch (error) {
    console.error(
      '[reservations] paiement indisponible:',
      error instanceof Error ? error.message : error,
    );
    return { ...reservation, payment: null };
  }
}

/**
 * Demande un remboursement pawaPay si la réservation a été encaissée.
 *
 * Les erreurs sont absorbées : une annulation ne doit pas échouer parce que le
 * remboursement est temporairement indisponible. Le job de réconciliation
 * reprendra l'état réel.
 */
async function refundIfPaid(
  reservation: { id: string; payment_status?: string | null },
  reason: 'client_cancellation' | 'gerant_refusal' | 'gerant_cancellation',
  requestedBy: string,
): Promise<RefundOutcome | null> {
  const status = reservation.payment_status ?? 'unpaid';
  if (!['paid', 'deposit_paid', 'partially_refunded'].includes(status)) return null;

  try {
    const outcome = await requestReservationRefund({
      reservationId: reservation.id,
      reason,
      requestedBy,
    });
    if (outcome.reason && outcome.reason !== 'already_refunded') {
      console.warn(
        `[reservations] remboursement ${reservation.id}: ${outcome.reason}`,
        outcome.details ?? '',
      );
    }
    return outcome;
  } catch (error) {
    console.error(
      `[reservations] remboursement ${reservation.id} impossible:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function sendPaymentError(res: Response, err: unknown): boolean {
  if (err instanceof PaymentServiceError) {
    res.status(err.status).json({ error: err.message, code: err.code, ...err.details });
    return true;
  }
  if (err instanceof PawapayConfigError) {
    console.error(`[reservations] pawaPay non configuré : ${err.code}`);
    res.status(503).json({ error: 'Paiement indisponible', code: err.code });
    return true;
  }
  if (err instanceof PawapayApiError) {
    console.error(`[reservations] erreur pawaPay : ${err.message} (${err.statusCode || 'réseau'})`);
    res.status(502).json({
      error: 'Le prestataire de paiement est momentanément indisponible.',
      code: 'PAWAPAY_ERROR',
    });
    return true;
  }
  return false;
}

const PENDING_TTL_MS = 48 * 60 * 60 * 1000;

async function expireStalePending(roomId: string): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
  const { error } = await supabaseAdmin
    .from('reservations')
    .update({ statut: 'annulee', responded_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('statut', 'en_attente')
    .in('payment_status', ['unpaid', 'failed'])
    .lt('created_at', cutoff);
  if (error) console.error('[reservations] expireStalePending échoué:', error.message);
}

router.get('/', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    if (!(await isQualifiedGerantUser(authUserId))) {
      return res.status(403).json({ error: "Réservations gérées par l'administrateur" });
    }

    const roomIds = await fetchAllRows<{ id: string }>((from, to) =>
      supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('gerant_id', authUserId)
        .order('id', { ascending: true })
        .range(from, to));

    const ids = roomIds.map((r) => r.id);
    if (ids.length === 0) {
      return res.json([]);
    }

    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select(RESERVATION_COLUMNS)
        .in('room_id', ids)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/mine', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('email')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!client) return res.json([]);

    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select('id, room_id, room_title, date_debut, date_fin, montant, duree_nombre, duree_unite, statut, created_at, responded_at, payment_status, paid_at, refunded_amount, room:rooms(img, alt, description)')
        .eq('client_email', client.email)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to));
    // La date limite d'annulation est calculée ici (et pas dans le front) :
    // c'est une règle métier, elle ne doit pas exister en double.
    res.json(
      ((data ?? []) as any[]).map((row) => ({
        ...row,
        cancellation_deadline: cancellationDeadlineIso(row.date_debut),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/client', requireClerkAuth, clientLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('email')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!client) return res.json([]);

    const parsedQuery = clientReservationQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }
    if (
      parsedQuery.data.email &&
      parsedQuery.data.email.toLowerCase() !== client.email.toLowerCase()
    ) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const data = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select('id, room_title, date_debut, date_fin, montant, duree_nombre, duree_unite, statut, created_at, payment_status, paid_at, refunded_amount')
        .eq('client_email', client.email)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', reserveLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = reservationCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données de réservation invalides' });
    }

    await expireStalePending(parsedBody.data.room_id);

    const clientKey = parsedBody.data.client_key;
    if (clientKey) {
      const { data: replayed, error: replayError } = await supabaseAdmin
        .from('reservations')
        .select(RESERVATION_COLUMNS)
        .eq('client_key', clientKey)
        .maybeSingle();
      if (replayError) throw replayError;
      if (replayed) {
        return res.status(200).json(await withBookingPayment(replayed as { id: string }));
      }
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, disponible, title, price_num, price_unit, gerant_id')
      .eq('id', parsedBody.data.room_id)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) return res.status(404).json({ error: 'Chambre introuvable' });
    if (!room.disponible) return res.status(409).json({ error: 'Cette chambre n\'est plus disponible' });

    const expectedUnit = unitFromPriceUnit(room.price_unit);
    if (parsedBody.data.duree_unite !== expectedUnit) {
      return res.status(400).json({ error: `Cette chambre est facturée ${room.price_unit}` });
    }

    const montant = calculateMontant(room.price_num, parsedBody.data.duree_nombre);

    const reservationId = randomUUID();
    const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc('create_reservation_checked', {
      p_id: reservationId,
      p_client_name: parsedBody.data.client_name,
      p_client_email: parsedBody.data.client_email,
      p_client_phone: parsedBody.data.client_phone,
      p_room_id: parsedBody.data.room_id,
      p_room_title: room.title,
      p_date_debut: parsedBody.data.date_debut,
      p_date_fin: parsedBody.data.date_fin,
      p_montant: montant,
      p_duree_nombre: parsedBody.data.duree_nombre,
      p_duree_unite: parsedBody.data.duree_unite,
      p_client_key: clientKey ?? null,
    });
    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('DATE_CONFLICT')) {
        return res.status(409).json({ error: 'Ces dates ne sont pas disponibles pour cette chambre' });
      }
      if (msg.includes('ROOM_NOT_FOUND')) {
        return res.status(404).json({ error: 'Chambre introuvable' });
      }
      if (clientKey && msg.includes('duplicate key') && msg.includes('client_key')) {
        const { data: winner } = await supabaseAdmin
          .from('reservations')
          .select(RESERVATION_COLUMNS)
          .eq('client_key', clientKey)
          .maybeSingle();
        if (winner) {
          return res.status(200).json(await withBookingPayment(winner as { id: string }));
        }
      }
      throw rpcError;
    }
    const data = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!data) throw new Error('Création de réservation échouée');

    const isReplay = Boolean(clientKey) && data.id !== reservationId;

    if (!isReplay) {
      const { error: notifError } = await supabaseAdmin.from('notifications').insert({
        id: randomUUID(),
        type: 'reservation',
        room_title: room.title,
        room_id: room.id,
        client_name: parsedBody.data.client_name,
        client_email: parsedBody.data.client_email,
        client_phone: parsedBody.data.client_phone,
        message: `Nouvelle demande de réservation du ${parsedBody.data.date_debut} au ${parsedBody.data.date_fin}.`,
        reservation_id: data.id,
        gerant_id: room.gerant_id || null,
      });
      if (notifError) console.error('[reservations] insert notification échoué:', notifError.message);
      else void publishNotificationChanged('admin', 'gerant');
    }

    res.status(isReplay ? 200 : 201).json(await withBookingPayment(data as { id: string }));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    const parsedBody = reservationStatusSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
      return res.status(400).json({ error: 'Données de réservation invalides' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    if (!(await isQualifiedGerantUser(authUserId))) {
      return res.status(403).json({ error: "Réservations gérées par l'administrateur" });
    }

    const { data: currentReservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('id, room_id, date_debut, date_fin, statut, payment_status')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!currentReservation) return res.status(404).json({ error: 'Réservation introuvable' });

    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('gerant_id')
      .eq('id', currentReservation.room_id)
      .maybeSingle();
    if (!room || room.gerant_id !== authUserId) {
      return res.status(403).json({ error: 'Non autorisé — cette réservation ne vous appartient pas' });
    }

    let data: Record<string, unknown> | null = null;
    if (parsedBody.data.statut === 'confirmee') {
      const { data: rpcRows, error: rpcError } = await supabaseAdmin.rpc('confirm_reservation_checked', {
        p_reservation_id: parsedParams.data.id,
      });
      if (rpcError) {
        const msg = rpcError.message || '';
        if (msg.includes('DATE_CONFLICT')) {
          return res.status(409).json({ error: 'Conflit de dates avec une autre réservation confirmée' });
        }
        if (msg.includes('NOT_FOUND')) {
          return res.status(404).json({ error: 'Réservation introuvable' });
        }
        throw rpcError;
      }
      data = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as Record<string, unknown> | null;
    } else {
      const { data: updated, error } = await supabaseAdmin
        .from('reservations')
        .update({ statut: parsedBody.data.statut, responded_at: new Date().toISOString() })
        .eq('id', parsedParams.data.id)
        .select(RESERVATION_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      data = updated;
    }
    if (!data) return res.status(404).json({ error: 'Réservation introuvable' });

    const refund =
      parsedBody.data.statut === 'annulee'
        ? await refundIfPaid(
            { id: parsedParams.data.id, payment_status: currentReservation.payment_status },
            currentReservation.statut === 'confirmee' ? 'gerant_cancellation' : 'gerant_refusal',
            `gerant:${authUserId}`,
          )
        : null;

    const { data: gerantData } = await supabaseAdmin
      .from('gerants')
      .select('phone, nom, prenom, is_verified, is_premium, premium_expires_at')
      .eq('clerk_user_id', room.gerant_id)
      .maybeSingle();

    res.json({ ...data, gerant_phone: gerantData?.phone || null, gerant_nom: gerantData?.nom || null, gerant_prenom: gerantData?.prenom || null, gerant_is_verified: gerantData?.is_verified || false, gerant_is_premium: isPremiumActive(gerantData), ...(refund ? { refund } : {}) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('email')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!client) return res.status(404).json({ error: 'Profil client introuvable' });

    const { data: reservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('id, client_name, client_email, client_phone, room_id, room_title, date_debut, date_fin, statut, payment_status')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!reservation) return res.status(404).json({ error: 'Réservation introuvable' });

    if (reservation.client_email.toLowerCase() !== client.email.toLowerCase()) {
      return res.status(403).json({ error: 'Cette réservation ne vous appartient pas' });
    }
    if (reservation.statut === 'annulee') {
      return res.status(400).json({ error: 'Cette réservation est déjà annulée' });
    }
    // Fenêtre d'annulation : 24 h avant l'arrivée. Au-delà, c'est bloqué —
    // le séjour est engagé et le gérant a حسابé son chiffre d'affaires.
    if (!canCancelReservation(reservation.date_debut)) {
      return res.status(403).json({
        error: CANCELLATION_TOO_LATE_MESSAGE,
        code: 'CANCELLATION_DEADLINE_PASSED',
        cancellation_deadline: cancellationDeadlineIso(reservation.date_debut),
      });
    }

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .update({ statut: 'annulee', responded_at: new Date().toISOString() })
      .eq('id', parsedParams.data.id)
      .select('id, room_id, room_title, date_debut, date_fin, statut, created_at')
      .single();
    if (error) throw error;

    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('gerant_id')
      .eq('id', data.room_id)
      .maybeSingle();

    await supabaseAdmin.from('notifications').insert({
      id: randomUUID(),
      type: 'reservation_cancelled',
      room_title: data.room_title,
      room_id: data.room_id,
      client_name: reservation.client_name,
      client_email: reservation.client_email,
      client_phone: reservation.client_phone,
      message: `Le client ${reservation.client_name} a annulé sa réservation du ${reservation.date_debut} au ${reservation.date_fin}`,
      reservation_id: data.id,
      gerant_id: room?.gerant_id || null,
    });
    void publishNotificationChanged('admin', 'gerant');

    const refund = await refundIfPaid(
      { id: parsedParams.data.id, payment_status: reservation.payment_status },
      'client_cancellation',
      `client:${authUserId}`,
    );

    res.json(refund ? { ...data, refund } : data);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/payment', paymentLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const start = await startBookingPayment(parsedParams.data.id);
    if (start.state === 'unavailable') {
      return res.status(422).json({
        error: "Le paiement en ligne n'est pas disponible pour cette réservation.",
        code: 'ONLINE_PAYMENT_DISABLED',
      });
    }
    if (start.state === 'paid') {
      return res.json({ state: 'paid', reference: start.reference });
    }

    return res.json({
      state: 'checkout',
      reference: start.session.reference,
      checkout_url: start.session.checkoutUrl,
      redirectUrl: start.session.redirectUrl,
      checkoutId: start.session.checkoutId,
      amount: start.session.amount,
      currency: start.session.currency,
      amount_xof: start.session.amountXof,
      expires_at: start.session.expiresAt,
    });
  } catch (err) {
    if (sendPaymentError(res, err)) return;
    next(err);
  }
});

router.post('/payment/confirm', paymentLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = reservationPaymentConfirmSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Référence de paiement invalide' });
    }

    const confirmation = await confirmBookingPayment(parsedBody.data.reference);
    return res.json({
      success: true,
      already_paid: confirmation.alreadyPaid,
      payment_status: confirmation.paymentStatus,
      paid_at: confirmation.paidAt,
      reservation: confirmation.reservation,
    });
  } catch (err) {
    if (sendPaymentError(res, err)) return;
    next(err);
  }
});

router.get('/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = reservationCheckQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres de disponibilité invalides' });
    }

    await expireStalePending(parsedQuery.data.room_id);

    const { data: conflict, error: rpcError } = await supabaseAdmin.rpc('has_date_conflict', {
      p_room_id: parsedQuery.data.room_id,
      p_date_debut: parsedQuery.data.date_debut,
      p_date_fin: parsedQuery.data.date_fin,
      p_exclude_id: parsedQuery.data.exclude_id ?? null,
    });
    if (!rpcError) {
      return res.json({ hasConflict: Boolean(conflict) });
    }

    const missingFunction =
      (rpcError as { code?: string }).code === 'PGRST202' ||
      (rpcError.message || '').includes('Could not find the function');
    if (!missingFunction) throw rpcError;
    console.warn(
      "[reservations] RPC has_date_conflict introuvable : exécuter backend/supabase/integrity_migration.sql (repli tronqué à 1000 lignes)",
    );

    let query = supabaseAdmin
      .from('reservations')
      .select('id, room_id, date_debut, date_fin, statut')
      .eq('room_id', parsedQuery.data.room_id)
      .neq('statut', 'annulee')
      .limit(1000);
    if (parsedQuery.data.exclude_id) {
      query = query.neq('id', parsedQuery.data.exclude_id);
    }

    const { data: reservations, error } = await query;
    if (error) throw error;
    if ((reservations || []).length === 1000) {
      console.warn('[reservations] /check : 1000 lignes atteintes, résultat potentiellement incomplet');
    }

    const newStart = new Date(parsedQuery.data.date_debut).getTime();
    const newEnd = new Date(parsedQuery.data.date_fin).getTime();
    const hasConflict = (reservations || []).some((reservation) => {
      if (!reservation.date_debut || !reservation.date_fin) return false;
      const existingStart = new Date(reservation.date_debut).getTime();
      const existingEnd = new Date(reservation.date_fin).getTime();
      return newStart < existingEnd && newEnd > existingStart;
    });

    res.json({ hasConflict });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireClerkOrAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = idParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'ID de réservation invalide' });
    }

    // Sélection explicite des colonnes pour éviter tout problème
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('id, client_name, client_email, client_phone, room_id, room_title, date_debut, date_fin, montant, duree_nombre, duree_unite, statut, created_at, responded_at, payment_status, paid_at, refunded_amount')
      .eq('id', parsed.data.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Réservation introuvable' });
      }
      console.error('Erreur lors de la récupération de la réservation:', error);
      throw error;
    }

    res.json(data);
  } catch (err) {
    console.error('Erreur dans la route /:id:', err);
    next(err);
  }
});

export default router;