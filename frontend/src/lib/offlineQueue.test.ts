import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearQueue,
  enqueue,
  flushQueue,
  readQueue,
  removeQueueItem,
  type OfflineQueueItem,
  type ReservationPayload,
} from './offlineQueue';

vi.mock('./reservations', () => ({ addReservation: vi.fn() }));
vi.mock('./api', () => ({ apiNewsletter: { subscribe: vi.fn() } }));

const reservationPayload: ReservationPayload = {
  clientName: 'Awa',
  clientEmail: 'awa@example.com',
  clientPhone: '0700000000',
  roomId: 'room-1',
  roomTitle: 'Studio Cocody',
  dateDebut: '2026-10-01',
  dateFin: '2026-10-03',
  dureeNombre: 2,
  dureeUnite: 'nuit',
  montant: 50000,
  message: '',
};

describe('offlineQueue', () => {
  function emailOf(item: OfflineQueueItem | undefined): string {
    if (!item || item.type !== 'newsletter') return '';
    return item.payload.email;
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    clearQueue();
  });

  it('retourne une file vide quand rien n’est enregistré', () => {
    expect(readQueue()).toEqual([]);
  });

  it('ignore un stockage corrompu sans lever d’erreur', () => {
    window.localStorage.setItem('linkhoo:offline-queue', '{pas-du-json');
    expect(readQueue()).toEqual([]);

    window.localStorage.setItem('linkhoo:offline-queue', '{"invalide": true}');
    expect(readQueue()).toEqual([]);
  });

  it('enregistre une entrée avec un identifiant et une date', () => {
    const item = enqueue({ type: 'reservation', payload: reservationPayload });

    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();

    const stored = readQueue();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.type).toBe('reservation');
    expect(stored[0]?.payload).toEqual(reservationPayload);
  });

  it('conserve les éléments dans leur ordre d’ajout et borne la file à 20', () => {
    for (let i = 0; i < 25; i += 1) {
      enqueue({ type: 'newsletter', payload: { email: `user-${i}@example.com` } });
    }

    const stored = readQueue();
    expect(stored).toHaveLength(20);
    expect(emailOf(stored[0])).toBe('user-5@example.com');
    expect(emailOf(stored[19])).toBe('user-24@example.com');
  });

  it('supprime un élément par son identifiant', () => {
    const first = enqueue({ type: 'newsletter', payload: { email: 'a@example.com' } });
    enqueue({ type: 'newsletter', payload: { email: 'b@example.com' } });

    removeQueueItem(first.id);

    const stored = readQueue();
    expect(stored).toHaveLength(1);
    expect(emailOf(stored[0])).toBe('b@example.com');
  });

  it('vide entièrement la file', () => {
    enqueue({ type: 'newsletter', payload: { email: 'a@example.com' } });
    enqueue({ type: 'newsletter', payload: { email: 'b@example.com' } });

    clearQueue();

    expect(readQueue()).toEqual([]);
    expect(window.localStorage.getItem('linkhoo:offline-queue')).toBeNull();
  });

  it('envoie chaque élément via le bon gestionnaire puis vide la file', async () => {
    const reservation = vi.fn().mockResolvedValue(undefined);
    const newsletter = vi.fn().mockResolvedValue(undefined);
    enqueue({ type: 'reservation', payload: reservationPayload });
    enqueue({ type: 'newsletter', payload: { email: 'awa@example.com' } });

    const result = await flushQueue({ reservation, newsletter });

    expect(result).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(reservation).toHaveBeenCalledWith(reservationPayload);
    expect(newsletter).toHaveBeenCalledWith({ email: 'awa@example.com' });
    expect(readQueue()).toEqual([]);
  });

  it('conserve les éléments en échec et envoie les suivants', async () => {
    const reservation = vi.fn().mockRejectedValue(new Error('réseau'));
    const newsletter = vi.fn().mockResolvedValue(undefined);
    enqueue({ type: 'reservation', payload: reservationPayload });
    enqueue({ type: 'newsletter', payload: { email: 'awa@example.com' } });

    const result = await flushQueue({ reservation, newsletter });

    expect(result).toEqual({ sent: 1, failed: 1, remaining: 1 });
    expect(reservation).toHaveBeenCalledTimes(1);
    expect(newsletter).toHaveBeenCalledTimes(1);
    expect(readQueue()).toHaveLength(1);
    expect(readQueue()[0]?.type).toBe('reservation');
  });

  it('partage une seule exécution entre appels concurrents', async () => {
    const newsletter = vi.fn().mockResolvedValue(undefined);
    enqueue({ type: 'newsletter', payload: { email: 'awa@example.com' } });

    const [first, second] = await Promise.all([
      flushQueue({ newsletter }),
      flushQueue({ newsletter }),
    ]);

    expect(newsletter).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('utilise les API réelles quand aucun gestionnaire n’est fourni', async () => {
    const { addReservation } = await import('./reservations');
    const { apiNewsletter } = await import('./api');
    vi.mocked(addReservation).mockResolvedValue(undefined as never);
    vi.mocked(apiNewsletter.subscribe).mockResolvedValue(undefined as never);
    enqueue({ type: 'reservation', payload: reservationPayload });
    enqueue({ type: 'newsletter', payload: { email: 'awa@example.com' } });

    const result = await flushQueue();

    expect(result).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(vi.mocked(addReservation)).toHaveBeenCalledWith(reservationPayload);
    expect(vi.mocked(apiNewsletter.subscribe)).toHaveBeenCalledWith({ email: 'awa@example.com' });
  });
});
