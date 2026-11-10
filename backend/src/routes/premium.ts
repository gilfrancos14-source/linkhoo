import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { premiumInitiateSchema, premiumConfirmSchema } from '../validations/premium';
import { isValidEmail } from '../utils/email';
import { isPremiumActive, isPremiumExpired } from '../utils/premium';
import { PaymentServiceError } from '../payments/errors';
import { PawapayApiError } from '../payments/pawapay/client';
import { PawapayConfigError } from '../payments/pawapay/config';
import { confirmPremiumPayment, createPremiumCheckout } from '../payments/service/premium';

const router = Router();

function sendPaymentError(res: Response, err: unknown): boolean {
  if (err instanceof PaymentServiceError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...err.details,
    });
    return true;
  }
  if (err instanceof PawapayConfigError) {
    console.error(`[premium] pawaPay non configuré : ${err.code}`);
    res.status(503).json({ error: 'Paiement indisponible', code: err.code });
    return true;
  }
  if (err instanceof PawapayApiError) {
    console.error(`[premium] erreur pawaPay (${err.statusCode || 'réseau'})`);
    res.status(502).json({
      error: 'Le prestataire de paiement est momentanément indisponible.',
      code: 'PAWAPAY_ERROR',
    });
    return true;
  }
  return false;
}

async function hasActivePremiumOnOtherMarket(
  clerkUserId: string,
  currentMarket: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('gerants')
    .select('market, is_premium, premium_expires_at')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  if (data.market === currentMarket) return false;
  return isPremiumActive(data);
}

router.post('/initiate', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = premiumInitiateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { market, plan } = parsedBody.data;
    const clerk_user_id = authUserId;

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('id, email, market, is_premium, premium_expires_at')
      .eq('clerk_user_id', clerk_user_id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });

    if (gerant.market !== market) {
      return res.status(403).json({
        error: `Votre compte gérant est rattaché au marché ${gerant.market}. Impossible de souscrire un premium pour le marché ${market}.`,
      });
    }

    if (isPremiumActive(gerant)) {
      return res.status(400).json({ error: 'Vous êtes déjà premium', expires_at: gerant.premium_expires_at });
    }

    if (await hasActivePremiumOnOtherMarket(clerk_user_id, market)) {
      return res.status(400).json({
        error: 'Vous avez déjà un abonnement premium actif sur un autre marché. Veuillez l\'annuler avant d\'en prendre un nouveau.',
      });
    }

    const customerEmail = isValidEmail(gerant.email) ? gerant.email : null;

    if (!customerEmail) {
      return res.status(400).json({
        error: 'Email gérant invalide ou manquant. Mettez à jour votre profil avant de payer.',
      });
    }

    const session = await createPremiumCheckout({
      market,
      clerkUserId: clerk_user_id,
      email: customerEmail,
      plan,
    });

    return res.json({
      reference: session.reference,
      checkout_url: session.checkoutUrl,
      redirect_url: session.redirectUrl ?? session.checkoutUrl,
      amount: session.amount,
      currency: session.currency,
      amount_xof: session.amountXof,
      expires_at: session.expiresAt,
    });
  } catch (err) {
    if (sendPaymentError(res, err)) return;
    console.error('[premium] initiate error:', err instanceof Error ? err.message : err);
    next(err);
  }
});

router.post('/confirm', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = premiumConfirmSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { reference } = parsedBody.data;
    const confirmation = await confirmPremiumPayment(reference, authUserId);

    return res.json({
      success: true,
      already_active: confirmation.alreadyActive,
      premium_expires_at: confirmation.expiresAt,
      gerant: confirmation.gerant,
    });
  } catch (err) {
    if (sendPaymentError(res, err)) return;
    console.error('[premium] confirm error:', err instanceof Error ? err.message : err);
    next(err);
  }
});

router.get('/status', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .select('is_premium, premium_expires_at')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Gérant introuvable' });

    const now = new Date();
    const isExpired = isPremiumExpired(data, now);

    if (isExpired) {
      await supabaseAdmin
        .from('gerants')
        .update({ is_premium: false, updated_at: now.toISOString() })
        .eq('clerk_user_id', authUserId);
    }

    const isActive = isPremiumActive(data, now);

    const { data: pendingTx } = await supabaseAdmin
      .from('payments')
      .select('reference, created_at')
      .eq('purpose', 'premium')
      .eq('gerant_clerk_user_id', authUserId)
      .in('status', ['created', 'pending', 'requires_action'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hasPendingPayment = !!pendingTx;
    const pendingSince = pendingTx?.created_at ?? null;

    res.json({
      is_premium: !!isActive,
      premium_expires_at: data.premium_expires_at,
      has_pending_payment: hasPendingPayment,
      pending_since: pendingSince,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
