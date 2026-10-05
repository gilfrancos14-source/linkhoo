import { addReservation } from './reservations';
import { apiNewsletter } from './api';

export type ReservationPayload = Parameters<typeof addReservation>[0];

export interface NewsletterPayload {
  email: string;
  market?: 'CI' | 'BJ';
}

export type OfflineQueueItem =
  | { id: string; type: 'reservation'; createdAt: string; payload: ReservationPayload; attempts?: number }
  | { id: string; type: 'newsletter'; createdAt: string; payload: NewsletterPayload; attempts?: number };

export type OfflineQueueItemInput = Omit<OfflineQueueItem, 'id' | 'createdAt' | 'attempts'>;

export interface FlushHandlers {
  reservation: (payload: ReservationPayload) => Promise<unknown>;
  newsletter: (payload: NewsletterPayload) => Promise<unknown>;
}

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

const STORAGE_KEY = 'linkhoo:offline-queue';
const MAX_ITEMS = 20;
/** Tentatives avant abandon d'un élément (erreur transitoire : réseau, 5xx…). */
const MAX_ATTEMPTS = 5;
/** Âge maximal d'un élément : au-delà, le rejeu n'a plus de sens. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Clé d'idempotence envoyée avec une réservation : le serveur renvoie la
 * réservation déjà créée si la même soumission est rejouée (file offline,
 * timeout, double clic) au lieu d'en créer une seconde.
 */
export function newClientKey(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  // Contexte non sécurisé (http:// sur réseau local) : pas de randomUUID.
  return `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Échec définitif : le serveur a répondu 4xx (hors 408/429) — rejouer ne
 * changera jamais l'issue. Toute autre erreur (réseau, timeout, 5xx) reste
 * transitoire et sera réessayée.
 */
function isPermanentFailure(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const status = (err as { status?: unknown }).status;
  if (typeof status !== 'number') return false;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

const defaultHandlers: FlushHandlers = {
  reservation: (payload) => addReservation(payload),
  newsletter: (payload) => apiNewsletter.subscribe(payload),
};

function isQueueItem(value: unknown): value is OfflineQueueItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<OfflineQueueItem>;
  if (typeof item.id !== 'string') return false;
  if (item.type !== 'reservation' && item.type !== 'newsletter') return false;
  return typeof item.payload === 'object' && item.payload !== null;
}

export function readQueue(): OfflineQueueItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueueItem);
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]): void {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // Stockage indisponible (mode privé) : la file est simplement non persistée.
  }
}

export function enqueue(item: OfflineQueueItemInput): OfflineQueueItem {
  const entry: OfflineQueueItem = {
    ...item,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  } as OfflineQueueItem;
  const items = readQueue();
  items.push(entry);
  writeQueue(items.slice(-MAX_ITEMS));
  return entry;
}

export function removeQueueItem(id: string): void {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

export function clearQueue(): void {
  writeQueue([]);
}

let flushInFlight: Promise<FlushResult> | null = null;

export function flushQueue(handlers: Partial<FlushHandlers> = {}): Promise<FlushResult> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = runFlush({ ...defaultHandlers, ...handlers }).finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

function recordFailedAttempt(id: string, attempts: number): void {
  writeQueue(
    readQueue().map((item) => (item.id === id ? { ...item, attempts } : item)),
  );
}

async function runFlush(handlers: FlushHandlers): Promise<FlushResult> {
  const items = readQueue();
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    // Élément trop ancien : purgé plutôt que rejoué à l'infini.
    if (Date.now() - Date.parse(item.createdAt) > MAX_AGE_MS) {
      removeQueueItem(item.id);
      failed += 1;
      continue;
    }

    try {
      if (item.type === 'reservation') {
        await handlers.reservation(item.payload);
      } else {
        await handlers.newsletter(item.payload);
      }
      removeQueueItem(item.id);
      sent += 1;
    } catch (err) {
      failed += 1;
      if (isPermanentFailure(err)) {
        // Le serveur a définitivement rejeté la demande (dates prises,
        // données invalides…) : la retirer de la file.
        removeQueueItem(item.id);
        continue;
      }
      const attempts = (item.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        // Erreur transitoire persistante : on abandonne proprement au lieu
        // de rejouer l'élément à chaque retour de connexion.
        removeQueueItem(item.id);
        continue;
      }
      recordFailedAttempt(item.id, attempts);
    }
  }

  return { sent, failed, remaining: readQueue().length };
}
