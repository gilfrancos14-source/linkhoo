/**
 * Reversements du gérant — `/api/payouts/*`.
 *
 * Le gérant déclare où recevoir son argent et suit ses reversements. Aucune
 * clé Hub2 ni identifiant prestataire n'est exposé : le front ne voit que le
 * statut interne, le net et la destination déclarée.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { PaymentServiceError } from '../payments/errors';
import {
  getPayoutSettings,
  hasVerifiedPayoutDestination,
  listPayoutsForGerant,
  missingPayoutFields,
  savePayoutSettings,
  type PayoutRow,
  type PayoutSettings,
} from '../payments/service/payout';
import { payoutSettingsSchema } from '../validations/payments';

const router = Router();

function settingsResponse(settings: PayoutSettings) {
  return {
    method: settings.payout_method,
    phone: settings.payout_phone,
    provider: settings.payout_provider,
    bank_code: settings.payout_bank_code,
    bank_name: settings.payout_bank_name,
    account_number: settings.payout_account_number,
    holder_name: settings.payout_holder_name,
    verified: hasVerifiedPayoutDestination(settings),
    verified_at: settings.payout_verified_at,
    missing_fields: missingPayoutFields(settings),
  };
}

function payoutResponse(payout: PayoutRow) {
  return {
    id: payout.id,
    reference: payout.reference,
    reservation_id: payout.reservation_id,
    gross_amount: Number(payout.gross_amount),
    commission_amount: Number(payout.commission_amount),
    refunded_amount: Number(payout.refunded_amount),
    net_amount: Number(payout.net_amount),
    currency: payout.currency,
    status: payout.status,
    scheduled_for: payout.scheduled_for,
    paid_at: payout.paid_at,
    failure_code: payout.failure_code,
    created_at: payout.created_at,
  };
}

function requireUserId(req: Request, res: Response): string | null {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Non autorisé' });
    return null;
  }
  return userId;
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof PaymentServiceError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  next(error);
}

router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const settings = await getPayoutSettings(userId);
    if (!settings) {
      return res.status(404).json({ error: 'Profil gérant introuvable' });
    }
    return res.json(settingsResponse(settings));
  } catch (error) {
    handleError(error, res, next);
  }
});

router.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const parsed = payoutSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Coordonnées de reversement invalides',
        details: parsed.error.flatten(),
      });
    }

    const settings = await savePayoutSettings(userId, parsed.data);
    return res.json(settingsResponse(settings));
  } catch (error) {
    handleError(error, res, next);
  }
});

router.get('/mine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const payouts = await listPayoutsForGerant(userId);
    return res.json(payouts.map(payoutResponse));
  } catch (error) {
    handleError(error, res, next);
  }
});

export default router;
