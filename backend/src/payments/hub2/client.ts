/**
 * Client HTTP minimal de l'API Hub2.
 *
 * Pas de SDK : trois en-têtes et `fetch` suffisent, et cela évite une
 * dépendance supplémentaire (FedaPay en imposait une, avec axios transitif).
 *
 * Règles :
 *   - timeout systématique (AbortController) : un appel Hub2 ne doit jamais
 *     bloquer une requête Express au-delà de `HUB2_TIMEOUT_MS` ;
 *   - aucune clé dans les messages d'erreur ni dans les logs ;
 *   - pas de rejeu automatique d'un POST : un Payment Link créé deux fois
 *     produirait deux checkout_url pour la même référence. Les rejeux sûrs
 *     (GET) sont explicitement autorisés par l'appelant.
 */

import type { Hub2Config } from '../types';

export type Hub2HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class Hub2Error extends Error {
  /** Statut HTTP Hub2, ou `null` pour une erreur réseau / locale. */
  readonly status: number | null;
  readonly code: string;
  readonly details: unknown;

  constructor(
    message: string,
    options: { status?: number | null; code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'Hub2Error';
    this.status = options.status ?? null;
    this.code = options.code ?? 'HUB2_ERROR';
    this.details = options.details ?? null;
  }
}

export interface Hub2RequestOptions {
  method?: Hub2HttpMethod;
  body?: unknown;
  /** Remplacé par le timeout de la config quand absent. */
  timeoutMs?: number;
  /** Rejouer une fois sur erreur réseau / 5xx. Réservé aux GET idempotents. */
  retryOnTransient?: boolean;
}

interface Hub2ErrorBody {
  message?: unknown;
  error?: unknown;
  code?: unknown;
  details?: unknown;
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const candidate = body as Hub2ErrorBody;
    for (const value of [candidate.message, candidate.error]) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return `Hub2 a répondu ${status}`;
}

function extractErrorCode(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const candidate = body as Hub2ErrorBody;
    if (typeof candidate.code === 'string' && candidate.code.trim()) return candidate.code.trim();
  }
  return `HUB2_HTTP_${status}`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Hub2 renvoie du JSON en pratique ; un proxy peut intercaler du HTML
    // (502 nginx). On conserve le texte brut pour le diagnostic, sans jamais
    // le journaliser tel quel.
    return text;
  }
}

async function executeOnce<T>(
  config: Hub2Config,
  path: string,
  options: Hub2RequestOptions,
): Promise<T> {
  const method = options.method ?? 'GET';
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    ApiKey: config.apiKey,
    MerchantId: config.merchantId,
    Environment: config.environment,
    Accept: 'application/json',
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new Hub2Error(
      aborted ? `Hub2: timeout après ${timeoutMs} ms` : 'Hub2: erreur réseau',
      {
        code: aborted ? 'HUB2_TIMEOUT' : 'HUB2_NETWORK_ERROR',
        details: error instanceof Error ? error.message : String(error),
      },
    );
  } finally {
    clearTimeout(timer);
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new Hub2Error(extractErrorMessage(body, response.status), {
      status: response.status,
      code: extractErrorCode(body, response.status),
      details: body,
    });
  }

  return body as T;
}

/**
 * Appelle Hub2 et renvoie le corps JSON typé.
 *
 * @throws Hub2Error — statut HTTP, code d'erreur et détails structurés.
 */
export async function hub2Request<T>(
  config: Hub2Config,
  path: string,
  options: Hub2RequestOptions = {},
): Promise<T> {
  if (!path.startsWith('/')) {
    throw new Hub2Error(`Chemin Hub2 invalide : ${path}`, { code: 'HUB2_INVALID_PATH' });
  }

  try {
    return await executeOnce<T>(config, path, options);
  } catch (error) {
    const transient =
      error instanceof Hub2Error &&
      (error.code === 'HUB2_NETWORK_ERROR' ||
        error.code === 'HUB2_TIMEOUT' ||
        (error.status !== null && error.status >= 500));

    if (!options.retryOnTransient || !transient) throw error;

    // Un seul rejeu : au-delà, l'incident est réel et l'appelant doit décider
    // (réconciliation, alerte) plutôt que de marteler Hub2.
    return executeOnce<T>(config, path, { ...options, retryOnTransient: false });
  }
}
