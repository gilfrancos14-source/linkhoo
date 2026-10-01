import { addReservation } from './reservations';
import { apiNewsletter } from './api';

export type ReservationPayload = Parameters<typeof addReservation>[0];

export interface NewsletterPayload {
  email: string;
  market?: 'CI' | 'BJ';
}

export type OfflineQueueItem =
  | { id: string; type: 'reservation'; createdAt: string; payload: ReservationPayload }
  | { id: string; type: 'newsletter'; createdAt: string; payload: NewsletterPayload };

export type OfflineQueueItemInput = Omit<OfflineQueueItem, 'id' | 'createdAt'>;

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

async function runFlush(handlers: FlushHandlers): Promise<FlushResult> {
  const items = readQueue();
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      if (item.type === 'reservation') {
        await handlers.reservation(item.payload);
      } else {
        await handlers.newsletter(item.payload);
      }
      removeQueueItem(item.id);
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { sent, failed, remaining: readQueue().length };
}
