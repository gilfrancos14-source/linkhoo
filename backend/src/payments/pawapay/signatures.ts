/**
 * Vérification des signatures de callbacks pawaPay.
 *
 * pawaPay signe ses callbacks selon RFC 9421 avec ECDSA P-256
 * (`alg="ecdsa-p256-sha256"`). La clé publique est récupérée via
 * `GET /v2/public-key/http` et mise en cache.
 *
 * Ce module remplace l'ancienne implémentation HMAC (`hs2023`) qui ne
 * correspondait pas au protocole réel : en production, tous les callbacks
 * étaient rejetés en 400.
 *
 * Références :
 *   - https://docs.pawapay.io/v2/docs/signatures
 *   - https://datatracker.ietf.org/doc/rfc9421/
 */

import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { PawapayConfigError, getPawapayConfig } from './config';
import { PawapayClient } from './client';
import { logger } from '../../lib/logger';
import type { PawapayPublicKey } from './types';

export class PawapaySignatureError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PawapaySignatureError';
    this.code = code;
  }
}

export interface PawapayCallbackRequest {
  readonly method: string;
  /** URL absolue telle que vue par pawaPay (proto + host + chemin + query). */
  readonly url: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly rawBody: string;
}

export interface SignatureInputEntry {
  readonly label: string;
  /** Composants signés, sans guillemets (ex. `@method`, `content-digest`). */
  readonly components: readonly string[];
  /** Valeur exacte du membre `Signature-Input` (composants + paramètres). */
  readonly params: string;
  /** Paramètres parsés (`alg`, `keyid`, `created`, `expires`…). */
  readonly paramsMap: Readonly<Record<string, string>>;
}

export interface PublicKeyLoader {
  (forceRefresh: boolean): Promise<PawapayPublicKey[]>;
}

interface SignatureServiceOptions {
  now?: () => number;
  loadPublicKeys?: PublicKeyLoader;
}

const PUBLIC_KEY_TTL_MS = 10 * 60 * 1000;

/* ------------------------------------------------------------------------- */
/* Parsing RFC 8941 / RFC 9421                                                */
/* ------------------------------------------------------------------------- */

/** Découpe une liste RFC 8941 en respectant les guillemets et parenthèses. */
function splitTopLevel(input: string, separator: ',' | ';'): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuote = false;

  for (const char of input) {
    if (char === '"') {
      inQuote = !inQuote;
      current += char;
      continue;
    }
    if (!inQuote) {
      if (char === '(') depth += 1;
      else if (char === ')') depth = Math.max(0, depth - 1);
      else if (char === separator && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSignatureInput(header: string): SignatureInputEntry[] {
  return splitTopLevel(header, ',').map((member) => {
    const eq = member.indexOf('=');
    if (eq <= 0) {
      throw new PawapaySignatureError('SIGNATURE_INPUT_INVALID', 'Membre Signature-Input invalide.');
    }

    const label = member.slice(0, eq).trim();
    const params = member.slice(eq + 1).trim();
    const open = params.indexOf('(');
    const close = params.lastIndexOf(')');

    if (open < 0 || close <= open) {
      throw new PawapaySignatureError(
        'SIGNATURE_INPUT_INVALID',
        'Liste de composants Signature-Input invalide.',
      );
    }

    const components = params
      .slice(open + 1, close)
      .split(/\s+/)
      .map(stripQuotes)
      .filter(Boolean);

    const paramsMap: Record<string, string> = {};
    for (const rawParam of splitTopLevel(params.slice(close + 1), ';')) {
      const paramEq = rawParam.indexOf('=');
      if (paramEq <= 0) continue;
      paramsMap[rawParam.slice(0, paramEq).trim().toLowerCase()] = stripQuotes(
        rawParam.slice(paramEq + 1),
      );
    }

    return { label, components, params: params.slice(open), paramsMap };
  });
}

export function parseSignatureHeader(header: string): Map<string, string> {
  const signatures = new Map<string, string>();

  for (const member of splitTopLevel(header, ',')) {
    const eq = member.indexOf('=');
    if (eq <= 0) continue;
    const label = member.slice(0, eq).trim();
    let value = member.slice(eq + 1).trim();

    // Valeur de type byte sequence RFC 8941 : `:base64:`
    if (value.startsWith(':') && value.endsWith(':')) {
      value = value.slice(1, -1);
    }
    signatures.set(label, value);
  }

  return signatures;
}

/* ------------------------------------------------------------------------- */
/* Signature base                                                             */
/* ------------------------------------------------------------------------- */

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target || value === undefined) continue;
    return Array.isArray(value) ? value.join(', ') : value;
  }
  return undefined;
}

function derivedComponentValue(component: string, request: PawapayCallbackRequest): string {
  const url = new URL(request.url);

  switch (component) {
    case '@method':
      return request.method.toUpperCase();
    case '@authority':
      return url.host;
    case '@path':
      return url.pathname || '/';
    case '@query':
      return url.search || '?';
    case '@target-uri':
      return url.href;
    case '@scheme':
      return url.protocol.replace(/:$/, '');
    case '@request-target':
      return `${request.method.toLowerCase()} ${url.pathname}${url.search}`;
    default:
      throw new PawapaySignatureError(
        'UNSUPPORTED_COMPONENT',
        `Composant dérivé non supporté : ${component}`,
      );
  }
}

/**
 * Construit la signature base RFC 9421 dans l'ordre imposé par
 * `Signature-Input`, puis ajoute `@signature-params`.
 */
export function buildSignatureBase(
  request: PawapayCallbackRequest,
  entry: SignatureInputEntry,
): string {
  const lines: string[] = [];

  for (const component of entry.components) {
    const normalized = component.toLowerCase();
    const value = normalized.startsWith('@')
      ? derivedComponentValue(normalized, request)
      : getHeader(request.headers, normalized);

    if (value === undefined) {
      throw new PawapaySignatureError(
        'SIGNED_COMPONENT_MISSING',
        `Composant signé absent de la requête : ${component}`,
      );
    }

    lines.push(`"${normalized}": ${value}`);
  }

  lines.push(`"@signature-params": ${entry.params}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------------- */
/* Content-Digest                                                             */
/* ------------------------------------------------------------------------- */

export function verifyContentDigest(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
): void {
  const header = getHeader(headers, 'content-digest');
  if (!header) {
    throw new PawapaySignatureError('CONTENT_DIGEST_MISSING', 'En-tête Content-Digest absent.');
  }

  const digests = new Map<string, string>();
  for (const part of splitTopLevel(header, ',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const algorithm = part.slice(0, eq).trim().toLowerCase();
    let value = part.slice(eq + 1).trim();
    if (value.startsWith(':') && value.endsWith(':')) value = value.slice(1, -1);
    digests.set(algorithm, value);
  }

  // On privilégie SHA-512, puis SHA-256 (les deux sont autorisés par pawaPay).
  for (const algorithm of ['sha-512', 'sha-256'] as const) {
    const expected = digests.get(algorithm);
    if (!expected) continue;

    const actual = createHash(algorithm === 'sha-512' ? 'sha512' : 'sha256')
      .update(Buffer.from(rawBody, 'utf8'))
      .digest('base64');

    if (!timingSafeEqual(actual, expected)) {
      throw new PawapaySignatureError(
        'CONTENT_DIGEST_MISMATCH',
        'Le Content-Digest ne correspond pas au corps de la requête.',
      );
    }
    return;
  }

  throw new PawapaySignatureError(
    'CONTENT_DIGEST_UNSUPPORTED',
    `Aucun digest supporté (sha-256/sha-512) dans Content-Digest : ${header}`,
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/* ------------------------------------------------------------------------- */
/* Vérification ECDSA                                                         */
/* ------------------------------------------------------------------------- */

function verifyEcdsa(signatureBase: string, signatureBase64: string, publicKeyPem: string): boolean {
  let key;
  try {
    key = createPublicKey(publicKeyPem);
  } catch (error) {
    logger.error('Clé publique pawaPay illisible', { error });
    return false;
  }

  const data = Buffer.from(signatureBase, 'utf8');
  const signature = Buffer.from(signatureBase64, 'base64');

  // Les exemples pawaPay utilisent une signature DER (défaut Node). On tente
  // aussi IEEE P1363 par robustesse (certains producteurs RFC 9421 l'utilisent).
  for (const dsaEncoding of ['der', 'ieee-p1363'] as const) {
    try {
      if (cryptoVerify('sha256', data, { key, dsaEncoding }, signature)) return true;
    } catch {
      // format incompatible : on essaie le suivant
    }
  }

  return false;
}

async function defaultLoadPublicKeys(): Promise<PawapayPublicKey[]> {
  const config = getPawapayConfig();
  const client = new PawapayClient(config);
  return client.getPublicKeys();
}

/* ------------------------------------------------------------------------- */
/* Service                                                                    */
/* ------------------------------------------------------------------------- */

export class PawapaySignatureService {
  private readonly now: () => number;
  private readonly loader: PublicKeyLoader;
  private cache: { at: number; keys: PawapayPublicKey[] } | null = null;

  constructor(options: SignatureServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.loader = options.loadPublicKeys ?? defaultLoadPublicKeys;
  }

  /** Vide le cache (tests, rotation de clé forcée). */
  reset(): void {
    this.cache = null;
  }

  private async getPublicKeys(forceRefresh = false): Promise<PawapayPublicKey[]> {
    if (!forceRefresh && this.cache && this.now() - this.cache.at < PUBLIC_KEY_TTL_MS) {
      return this.cache.keys;
    }

    const keys = await this.loader(forceRefresh);
    this.cache = { at: this.now(), keys };
    return keys;
  }

  /**
   * Valide un callback pawaPay : Content-Digest puis signature RFC 9421.
   *
   * @throws PawapaySignatureError si la signature est absente ou invalide.
   * @throws PawapayConfigError si la configuration pawaPay est incomplète.
   */
  async validateWebhookSignature(request: PawapayCallbackRequest): Promise<void> {
    const signatureInput = getHeader(request.headers, 'signature-input');
    const signatureHeader = getHeader(request.headers, 'signature');

    if (!signatureInput || !signatureHeader) {
      throw new PawapaySignatureError(
        'SIGNATURE_MISSING',
        'En-têtes Signature / Signature-Input absents.',
      );
    }

    const entries = parseSignatureInput(signatureInput);
    const signatures = parseSignatureHeader(signatureHeader);
    if (entries.length === 0) {
      throw new PawapaySignatureError('SIGNATURE_INPUT_INVALID', 'Signature-Input vide.');
    }

    // L'intégrité du corps est vérifiée avant toute logique métier.
    verifyContentDigest(request.headers, request.rawBody);

    const keyId = entries[0].paramsMap.keyid;
    let keys = await this.getPublicKeys();
    let key = keyId ? keys.find((candidate) => candidate.id === keyId) : undefined;

    // Rotation de clé : si le keyid est inconnu, on rafraîchit une fois.
    if (!key) {
      keys = await this.getPublicKeys(true);
      key = keyId ? keys.find((candidate) => candidate.id === keyId) : keys[0];
    }

    if (!key) {
      throw new PawapaySignatureError(
        'PUBLIC_KEY_NOT_FOUND',
        `Aucune clé publique pawaPay pour keyid="${keyId ?? 'inconnu'}".`,
      );
    }

    for (const entry of entries) {
      const signature = signatures.get(entry.label);
      if (!signature) continue;

      const signatureBase = buildSignatureBase(request, entry);
      if (verifyEcdsa(signatureBase, signature, key.key)) {
        logger.debug('Signature webhook pawaPay validée', { keyid: key.id, label: entry.label });
        return;
      }
    }

    throw new PawapaySignatureError('SIGNATURE_INVALID', 'Signature du callback invalide.');
  }
}

/** Instance singleton utilisée par la route webhook. */
export const pawapaySignatureService = new PawapaySignatureService();

export { PawapayConfigError };
