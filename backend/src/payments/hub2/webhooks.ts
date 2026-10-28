/**
 * Vérification et normalisation des webhooks Hub2.
 *
 * En-tête envoyé par Hub2 : `Hub2-Signature: s1=<hmac>,s0=<timestamp>`.
 * La documentation ne publie pas l'algorithme exact ; l'hypothèse retenue
 * (à confirmer avec Hub2 avant la production) est :
 *
 *     s1 = HMAC_SHA256(secret, s0 + "." + rawBody)   // hexadécimal
 *
 * Deux protections :
 *   - comparaison en temps constant (`timingSafeEqual`) ;
 *   - `s0` daté de moins de 5 minutes, pour qu'un webhook capturé ne puisse
 *     pas être rejoué indéfiniment.
 *
 * Le corps BRUT est obligatoire : re-sérialiser le JSON change l'ordre des
 * clés et invalide la signature. C'est pourquoi `index.ts` monte un
 * `express.json({ verify })` dédié AVANT le parseur global.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface ParsedSignature {
  readonly s0: string;
  /** Toutes les signatures candidates : Hub2 peut en envoyer plusieurs lors
   * d'une rotation de secret. Une seule doit correspondre. */
  readonly signatures: readonly string[];
}

export class Hub2WebhookError extends Error {
  readonly code:
    | 'MISSING_SIGNATURE'
    | 'MALFORMED_SIGNATURE'
    | 'STALE_SIGNATURE'
    | 'INVALID_SIGNATURE'
    | 'MISSING_RAW_BODY'
    | 'INVALID_JSON'
    | 'INVALID_EVENT';

  constructor(code: Hub2WebhookError['code'], message: string) {
    super(message);
    this.name = 'Hub2WebhookError';
    this.code = code;
  }
}

/**
 * Analyse `s1=abc,s0=1700000000`.
 *
 * Les valeurs sont prises telles quelles (pas de décodage URL) : Hub2 envoie
 * de l'hexadécimal. Un en-tête absent ou vide est une erreur explicite, jamais
 * un « laisser passer ».
 */
export function parseSignatureHeader(header: string | undefined | null): ParsedSignature {
  if (!header || !header.trim()) {
    throw new Hub2WebhookError('MISSING_SIGNATURE', 'En-tête Hub2-Signature absent.');
  }

  let s0: string | null = null;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!value) continue;
    if (key === 's0') s0 = value;
    else if (key === 's1') signatures.push(value);
  }

  if (!s0 || signatures.length === 0) {
    throw new Hub2WebhookError(
      'MALFORMED_SIGNATURE',
      'En-tête Hub2-Signature incomplet (s0 et s1 sont requis).',
    );
  }

  return { s0, signatures };
}

/**
 * `s0` est un horodatage Unix. Selon les environnements Hub2, il est exprimé
 * en secondes ou en millisecondes : on déduit l'unité de la magnitude.
 */
function timestampToMs(s0: string): number | null {
  if (!/^\d+$/.test(s0)) return null;
  const value = Number(s0);
  if (!Number.isFinite(value)) return null;
  return value > 1e12 ? value : value * 1000;
}

export function computeSignature(secret: string, s0: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${s0}.${rawBody}`, 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Vérifie la signature et la fraîcheur de `s0`.
 *
 * @param now injectable pour les tests ; par défaut l'horloge système.
 * @throws Hub2WebhookError — code exploitable par la route (400/401).
 */
export function verifyHub2Signature(input: {
  rawBody: string | undefined;
  header: string | undefined | null;
  secret: string;
  now?: number;
  toleranceMs?: number;
}): void {
  if (input.rawBody === undefined) {
    throw new Hub2WebhookError('MISSING_RAW_BODY', 'Corps brut indisponible.');
  }

  const { s0, signatures } = parseSignatureHeader(input.header);

  const timestampMs = timestampToMs(s0);
  if (timestampMs === null) {
    throw new Hub2WebhookError('MALFORMED_SIGNATURE', 's0 n’est pas un horodatage numérique.');
  }

  const now = input.now ?? Date.now();
  const tolerance = input.toleranceMs ?? SIGNATURE_TOLERANCE_MS;
  // Valeur future tolérée dans la même fenêtre (dérive d'horloge entre
  // serveurs), mais pas au-delà.
  if (Math.abs(now - timestampMs) > tolerance) {
    throw new Hub2WebhookError('STALE_SIGNATURE', 'Webhook trop ancien ou horodaté dans le futur.');
  }

  const expected = computeSignature(input.secret, s0, input.rawBody);
  const matches = signatures.some((candidate) =>
    safeEqualHex(expected, candidate.trim().toLowerCase()),
  );
  if (!matches) {
    throw new Hub2WebhookError('INVALID_SIGNATURE', 'Signature Hub2 invalide.');
  }
}

export interface Hub2Event {
  /** Identifiant d'idempotence : `event.id`, ou empreinte du corps s'il manque. */
  readonly id: string;
  readonly type: string;
  readonly data: Record<string, unknown>;
  readonly createdAt: string | null;
  readonly payload: Record<string, unknown>;
  readonly raw: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalise un événement Hub2.
 *
 * `id` est la clé d'unicité en base (`payment_events.provider_event_id`). S'il
 * manque, l'empreinte SHA-256 du corps prend le relais : deux livraisons du
 * même contenu restent dédupliquées, sans jamais accepter un événement sans
 * identité.
 */
export function parseHub2Event(rawBody: string | undefined): Hub2Event {
  if (rawBody === undefined || rawBody.trim() === '') {
    throw new Hub2WebhookError('INVALID_JSON', 'Corps webhook vide.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Hub2WebhookError('INVALID_JSON', 'Corps webhook JSON invalide.');
  }

  if (!isRecord(parsed)) {
    throw new Hub2WebhookError('INVALID_EVENT', 'Événement Hub2 non objet.');
  }

  const type = typeof parsed.type === 'string' ? parsed.type.trim() : '';
  if (!type) {
    throw new Hub2WebhookError('INVALID_EVENT', 'Événement Hub2 sans type.');
  }

  const data = isRecord(parsed.data) ? parsed.data : {};
  const rawId = typeof parsed.id === 'string' ? parsed.id.trim() : '';
  const id = rawId || `sha256:${createHash('sha256').update(rawBody, 'utf8').digest('hex')}`;

  return {
    id,
    type,
    data,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : null,
    payload: parsed,
    raw: rawBody,
  };
}

/**
 * Cherche `purchaseReference` dans le payload, à profondeur bornée.
 *
 * Les événements de remboursement imbriquent le paiement d'origine
 * (`data.payment.purchaseReference`), alors que les événements de paiement
 * l'exposent à la racine de `data`. On ne parcourt que des objets, jamais des
 * tableaux, pour éviter d'explorer un historique de tentatives.
 */
export function extractPurchaseReference(event: Hub2Event, maxDepth = 3): string | null {
  const walk = (value: unknown, depth: number): string | null => {
    if (depth > maxDepth || !isRecord(value)) return null;
    const direct = value.purchaseReference;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    for (const child of Object.values(value)) {
      const found = walk(child, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return walk(event.data, 0);
}

/** Extrait un identifiant fournisseur (paiement, remboursement, transfert). */
export function extractProviderId(event: Hub2Event): string | null {
  // 1. Identifiant explicite quand l'événement le porte.
  for (const key of ['paymentId', 'refundId', 'transferId']) {
    const value = event.data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  // 2. Paiement imbriqué : c'est l'identifiant attendu par l'API de
  //    remboursement (`POST /payments-refund/{paymentId}/refund`). Un
  //    PaymentIntent expose `payments`, un Payment Link `paymentAttempts`.
  const nested = [
    ...(Array.isArray(event.data.payments) ? event.data.payments : []),
    ...(Array.isArray(event.data.paymentAttempts) ? event.data.paymentAttempts : []),
  ].filter(isRecord);

  const successful = nested.find((item) => {
    const status = typeof item.status === 'string' ? item.status.trim().toLowerCase() : '';
    return status === 'successful' || status === 'succeeded';
  });
  const chosen = successful ?? nested[0];
  if (chosen && typeof chosen.id === 'string' && chosen.id.trim()) return chosen.id.trim();

  // 3. À défaut, l'identifiant racine (intent, lien, paiement…).
  const value = event.data.id;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Identifiant du transfert (`POST /transfers` renvoie `id`).
 *
 * Les événements `transfer.*` exposent l'id à la racine de `data` ou sous
 * `transferId` ; certains payloads l'imbriquent dans `data.transfer`.
 */
export function extractTransferId(event: Hub2Event): string | null {
  for (const key of ['transferId', 'id']) {
    const value = event.data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  const nested = event.data.transfer;
  if (isRecord(nested)) {
    const value = nested.id;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Identifiant du remboursement (`POST /payments-refund/{id}/refund` renvoie
 * un id numérique, stocké en texte).
 *
 * Les événements `payment_refund.*` portent l'id du remboursement à la racine
 * de `data` ; certains payloads l'exposent sous `refundId`. On n'utilise
 * JAMAIS `paymentId` ici : c'est le paiement d'origine, pas le remboursement.
 */
export function extractRefundId(event: Hub2Event): string | null {
  for (const key of ['refundId', 'id']) {
    const value = event.data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}
