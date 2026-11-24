import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import {
  loadReceiptData,
  renderReceiptHtml,
  verifyReceiptToken,
} from '../services/receipt';

const router = Router();

/**
 * GET /api/receipts/:token — reçu HTML signé, sans authentification Clerk.
 * Le jeton (JWT de 90 jours) est envoyé par e-mail au client après paiement.
 */
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.params.token || '');
    const payload = verifyReceiptToken(token);
    if (!payload) {
      res.status(403).type('text/plain').send('Lien de reçu invalide ou expiré.');
      return;
    }

    const data = await loadReceiptData(payload.reference, payload.reservation_id);
    if (!data) {
      res.status(404).type('text/plain').send('Reçu introuvable.');
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      logger.info('[receipt] Reçu servi', { reference: payload.reference });
    }

    res.set('Cache-Control', 'no-store, private');
    res.set('X-Content-Type-Options', 'nosniff');
    res.status(200).type('html').send(renderReceiptHtml(data));
  } catch (err) {
    next(err);
  }
});

export default router;
