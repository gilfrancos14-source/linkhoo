/**
 * Webhooks pawaPay.
 *
 * Endpoint : POST /api/webhooks/pawapay
 *
 * Contrat de réponse :
 *   - 2xx : "j'ai traité (ou l'événement ne me concerne pas), ne renvoie plus".
 *   - 4xx : signature ou payload invalide. pawaPay ne doit pas rejouer.
 *   - 5xx : incident technique. pawaPay DOIT rejouer.
 *
 * SÉCURITÉ :
 *   - pawaPay signe ses callbacks en RFC 9421 / ECDSA P-256. La clé publique
 *     est récupérée via `GET /v2/public-key/http` (voir `signatures.ts`).
 *   - En production, la vérification est OBLIGATOIRE et BLOQUANTE.
 *   - En dev, elle est désactivée par défaut (log-only) pour pouvoir tester
 *     sans activer les callbacks signés ; `PAWAPAY_VERIFY_CALLBACKS=true`
 *     l'active explicitement.
 *
 * Règle d'or : ne JAMAIS renvoyer 2xx sur une erreur technique, sinon
 * pawaPay abandonne et le paiement reste bloqué en `pending`.
 */

import type { IncomingHttpHeaders } from 'node:http';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPawapayConfig, PawapayConfigError } from '../payments/pawapay/config';
import { pawapaySignatureService } from '../payments/pawapay/signatures';
import { applyPawapayEvent } from '../payments/service/applyEvent';
import { PawapayApiError } from '../payments/pawapay/client';
import { logger } from '../lib/logger';

const router = Router();

function firstHeader(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim() || undefined;
}

/**
 * Reconstitue l'URL absolue telle que pawaPay l'a signée. Derrière un reverse
 * proxy, `Host` peut être interne : on privilégie X-Forwarded-*.
 */
function callbackUrl(req: Request): string {
  const proto = firstHeader(req.headers['x-forwarded-proto']) ?? req.protocol ?? 'https';
  const host =
    firstHeader(req.headers['x-forwarded-host']) ??
    firstHeader(req.headers.host as string | string[] | undefined) ??
    'localhost';
  return `${proto}://${host}${req.originalUrl}`;
}

router.post('/', async (req: Request, res: Response) => {
  let config;
  try {
    config = getPawapayConfig();
  } catch (error) {
    if (error instanceof PawapayConfigError) {
      logger.warn('Webhook pawaPay : configuration indisponible', { code: error.code });
      return res.status(503).json({ error: 'Configuration indisponible' });
    }
    throw error;
  }

  // Mode observation : on acquitte sans traiter, mais on loggue.
  if (!config.applyEvents) {
    logger.info('Webhook pawaPay ignoré (mode observation)');
    return res.status(200).json({ status: 'ignored' });
  }

  const signature = firstHeader(req.headers.signature);
  const signatureInput = firstHeader(req.headers['signature-input']);
  const rawPayload = req.rawBody;

  // --- 1) Vérification de signature ---------------------------------------
  if (config.verifyCallbacks) {
    if (!signature || !signatureInput) {
      logger.warn('Webhook pawaPay : signature absente alors que la vérification est active');
      return res.status(400).json({ error: 'Signature requise' });
    }
    if (!rawPayload) {
      logger.error(
        'Webhook pawaPay : req.rawBody absent — vérifier le middleware express.json',
      );
      return res.status(500).json({ error: 'Configuration serveur incomplète' });
    }

    try {
      await pawapaySignatureService.validateWebhookSignature({
        method: req.method,
        url: callbackUrl(req),
        headers: req.headers as IncomingHttpHeaders,
        rawBody: rawPayload,
      });
    } catch (error) {
      logger.warn('Webhook pawaPay : signature invalide', {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(400).json({ error: 'Signature invalide' });
    }
  } else if (signature && signatureInput && rawPayload) {
    // Dev : vérification non bloquante, utile pour diagnostiquer une config.
    try {
      await pawapaySignatureService.validateWebhookSignature({
        method: req.method,
        url: callbackUrl(req),
        headers: req.headers as IncomingHttpHeaders,
        rawBody: rawPayload,
      });
      logger.info('Webhook pawaPay : signature valide (vérification dev)');
    } catch (error) {
      logger.warn('Webhook pawaPay : signature non bloquante en dev', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.warn(
      'Webhook pawaPay : vérification de signature désactivée (dev). Activez PAWAPAY_VERIFY_CALLBACKS=true pour la tester.',
    );
  }

  // --- 2) Traitement métier -----------------------------------------------
  try {
    const result = await applyPawapayEvent(req.body);
    logger.info('Webhook pawaPay traité', {
      handled: result.handled,
      reason: result.reason,
    });
    // 200 même si l'événement ne concerne aucun paiement : inutile de faire
    // rejouer indéfiniment un callback orphelin.
    return res.status(200).json({ status: 'processed', ...result });
  } catch (error) {
    logger.error('Webhook pawaPay : erreur technique de traitement', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof PawapayConfigError) {
      return res.status(503).json({ error: 'Configuration indisponible' });
    }
    if (
      error instanceof PawapayApiError &&
      error.statusCode !== null &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return res.status(400).json({ error: 'Événement refusé par pawaPay' });
    }

    return res.status(500).json({ error: 'Traitement temporairement indisponible' });
  }
});

export default router;
