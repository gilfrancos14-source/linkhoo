/**
 * Consultation d'un paiement — `GET /api/payments/:reference`.
 *
 * Le front s'en sert après le retour du checkout hébergé pour suivre l'état
 * réel (le webhook peut arriver avec quelques secondes de retard). Aucune
 * donnée prestataire n'est exposée : ni identifiant Hub2, ni clé, ni corps
 * d'événement.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { paymentReferenceParamsSchema } from '../validations/payments';

const router = Router();

interface PaymentRow {
  reference: string;
  purpose: string;
  status: string;
  amount: number;
  currency: string;
  amount_xof: number;
  checkout_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  failure_code: string | null;
  payer_clerk_user_id: string | null;
  gerant_clerk_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS =
  'reference, purpose, status, amount, currency, amount_xof, checkout_url, expires_at, paid_at, fulfilled_at, failure_code, payer_clerk_user_id, gerant_clerk_user_id, created_at, updated_at' as const;

router.get('/:reference', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const parsed = paymentReferenceParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Référence de paiement invalide' });
    }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(SELECT_COLUMNS)
      .eq('reference', parsed.data.reference)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    const payment = data as PaymentRow;
    // Un gérant peut consulter un paiement dont il est le bénéficiaire ; un
    // client, celui qu'il a initié. Toute autre combinaison est refusée sans
    // révéler l'existence de la ligne (même réponse qu'un id inconnu).
    const isOwner =
      payment.payer_clerk_user_id === authUserId ||
      payment.gerant_clerk_user_id === authUserId;
    if (!isOwner) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    return res.json({
      reference: payment.reference,
      purpose: payment.purpose,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      amount_xof: Number(payment.amount_xof),
      checkout_url: payment.checkout_url,
      expires_at: payment.expires_at,
      paid_at: payment.paid_at,
      fulfilled_at: payment.fulfilled_at,
      failure_code: payment.failure_code,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
