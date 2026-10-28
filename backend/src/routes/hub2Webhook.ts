/**
 * Réception des webhooks Hub2 — `/api/webhooks/hub2`.
 *
 * Contrat de réponse :
 *   - 2xx en moins de 5 s : Hub2 considère l'événement livré. On répond dès
 *     que la ligne est écrite dans `payment_events`, pas après le traitement
 *     métier (qui pourra être déporté sans changer ce contrat).
 *   - 4xx : signature ou corps invalide. Hub2 ne doit pas rejouer.
 *   - 5xx / 503 : incident temporaire (base indisponible, secret absent).
 *     Hub2 rejoue, ce qui est le comportement souhaité.
 *
 * Le corps brut est fourni par le `express.json({ verify })` monté dans
 * `index.ts` AVANT le parseur global : sans lui, la signature est invérifiable.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { Hub2ConfigError, getHub2Config } from '../payments/config';
import { eventKind } from '../payments/hub2/mapping';
import {
  Hub2WebhookError,
  extractPurchaseReference,
  parseHub2Event,
  verifyHub2Signature,
} from '../payments/hub2/webhooks';
import {
  PaymentTableMissingError,
  markPaymentEventFailed,
  markPaymentEventProcessed,
  recordPaymentEvent,
} from '../payments/events';
import { applyHub2Event } from '../payments/service/applyEvent';

const router = Router();

/** Journal minimal : identifiant et type, jamais le corps (données personnelles). */
function logEvent(level: 'info' | 'warn' | 'error', message: string, eventId?: string, eventType?: string): void {
  const suffix = [eventId, eventType].filter(Boolean).join(' · ');
  const line = `[hub2-webhook] ${message}${suffix ? ` (${suffix})` : ''}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

function webhookErrorCode(error: unknown): string | null {
  return error instanceof Hub2WebhookError ? error.code : null;
}

router.post('/', async (req: Request, res: Response) => {
  let config;
  try {
    config = getHub2Config();
  } catch (error) {
    if (error instanceof Hub2ConfigError) {
      logEvent('warn', `configuration indisponible : ${error.code}`);
      return res.status(503).json({ error: 'Paiement indisponible' });
    }
    throw error;
  }

  // Sans secret, toute requête serait acceptée : on refuse explicitement
  // plutôt que de laisser un endpoint ouvert en production.
  if (!config.webhookSecret) {
    logEvent('warn', 'HUB2_WEBHOOK_SECRET absent : webhook désactivé');
    return res.status(503).json({ error: 'Webhook non configuré' });
  }

  try {
    verifyHub2Signature({
      rawBody: req.rawBody,
      header: req.get('hub2-signature'),
      secret: config.webhookSecret,
    });
  } catch (error) {
    const code = webhookErrorCode(error);
    logEvent('warn', `signature refusée : ${code ?? 'inconnue'}`);
    // Message générique : ne pas aider un attaquant à distinguer « mauvais
    // secret » de « trop ancien ».
    return res.status(400).json({ error: 'Signature invalide' });
  }

  let event;
  try {
    event = parseHub2Event(req.rawBody);
  } catch (error) {
    const code = webhookErrorCode(error);
    logEvent('warn', `événement illisible : ${code ?? 'inconnu'}`);
    return res.status(400).json({ error: 'Événement invalide' });
  }

  let recorded;
  try {
    recorded = await recordPaymentEvent(event);
  } catch (error) {
    if (error instanceof PaymentTableMissingError) {
      logEvent('error', 'schéma de paiement absent');
      return res.status(503).json({ error: 'Schéma de paiement indisponible' });
    }
    logEvent('error', 'écriture payment_events impossible', event.id, event.type);
    return res.status(500).json({ error: 'Traitement temporairement indisponible' });
  }

  if (recorded.duplicate) {
    logEvent('info', 'doublon ignoré', event.id, event.type);
    return res.status(200).json({ received: true, duplicate: true });
  }

  const kind = eventKind(event.type);
  const reference = extractPurchaseReference(event);
  logEvent('info', `reçu ${kind}${reference ? ` ref=${reference}` : ''}`, event.id, event.type);

  if (!config.applyEvents) {
    // Phase 1 : observation seule. L'événement est conservé, rien n'est activé.
    await markPaymentEventProcessed(recorded.id, 'observation_mode').catch((error) => {
      logEvent('error', `marquage observation impossible : ${String(error)}`, event.id, event.type);
    });
    return res.status(200).json({ received: true, applied: false });
  }

  // Le traitement métier est idempotent : un rejeu (doublon d'événement ou
  // webhook concurrent du retour navigateur) ne prolonge jamais deux fois.
  try {
    const result = await applyHub2Event(event);
    await markPaymentEventProcessed(recorded.id, result.handled ? null : result.reason ?? 'not_handled');
    logEvent(
      'info',
      result.handled ? 'appliqué' : `non appliqué (${result.reason ?? 'sans motif'})`,
      event.id,
      event.type,
    );
    return res.status(200).json({
      received: true,
      applied: result.handled,
      ...(result.reason ? { reason: result.reason } : {}),
    });
  } catch (error) {
    // L'événement reste dans la file (`processed_at` NULL) : le cron de
    // reprise pourra le réappliquer. On répond 500 pour que Hub2 rejoue.
    logEvent(
      'error',
      `traitement impossible : ${error instanceof Error ? error.message : String(error)}`,
      event.id,
      event.type,
    );
    await markPaymentEventFailed(recorded.id, 'apply_failed').catch((markError) => {
      logEvent('error', `marquage échec impossible : ${String(markError)}`, event.id, event.type);
    });
    return res.status(500).json({ error: 'Traitement temporairement indisponible' });
  }
});

export default router;
