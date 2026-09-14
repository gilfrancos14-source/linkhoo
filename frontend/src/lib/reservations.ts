export interface Reservation {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  roomId: string;
  roomTitle: string;
  dateDebut: string;
  dateFin: string;
  montant: number;
  message: string;
  statut: 'en_attente' | 'confirmee' | 'annulee';
  createdAt: string;
  respondedAt?: string;
}

export const statutLabels: Record<Reservation['statut'], string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  annulee: 'Annulée',
};

export const statutColors: Record<Reservation['statut'], string> = {
  en_attente: 'var(--sun)',
  confirmee: '#22c55e',
  annulee: '#ef4444',
};

const STORAGE_KEY = 'ilehya-reservations';

export function getReservations(): Reservation[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

export function addReservation(data: Omit<Reservation, 'id' | 'createdAt' | 'statut'>): Reservation {
  const reservations = getReservations();
  const newReservation: Reservation = {
    ...data,
    id: 'res-' + Date.now(),
    statut: 'en_attente',
    createdAt: new Date().toISOString(),
  };
  reservations.unshift(newReservation);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
  return newReservation;
}

export function updateReservationStatut(id: string, statut: 'confirmee' | 'annulee'): void {
  const reservations = getReservations().map((r) =>
    r.id === id ? { ...r, statut, respondedAt: new Date().toISOString() } : r
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
}

export function getReservationById(id: string): Reservation | undefined {
  return getReservations().find((r) => r.id === id);
}

export interface ConflictInfo {
  hasConflict: boolean;
  conflictingReservation?: Reservation;
}

export function checkDateConflict(roomId: string, dateDebut: string, dateFin: string, excludeId?: string): ConflictInfo {
  const reservations = getReservations();
  const newStart = new Date(dateDebut).getTime();
  const newEnd = new Date(dateFin).getTime();

  for (const r of reservations) {
    if (r.roomId !== roomId) continue;
    if (r.statut === 'annulee') continue;
    if (excludeId && r.id === excludeId) continue;
    if (!r.dateDebut || !r.dateFin) continue;

    const existingStart = new Date(r.dateDebut).getTime();
    const existingEnd = new Date(r.dateFin).getTime();

    if (newStart < existingEnd && newEnd > existingStart) {
      return { hasConflict: true, conflictingReservation: r };
    }
  }

  return { hasConflict: false };
}
