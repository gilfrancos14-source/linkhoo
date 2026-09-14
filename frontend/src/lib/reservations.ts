import { apiReservations, type ReservationData } from './api';

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

function mapReservation(d: ReservationData): Reservation {
  return {
    id: d.id,
    clientName: d.client_name,
    clientEmail: d.client_email,
    clientPhone: d.client_phone,
    roomId: d.room_id,
    roomTitle: d.room_title,
    dateDebut: d.date_debut,
    dateFin: d.date_fin,
    montant: d.montant,
    message: d.message,
    statut: d.statut,
    createdAt: d.created_at,
    respondedAt: d.responded_at ?? undefined,
  };
}

export async function getReservations(): Promise<Reservation[]> {
  try {
    const data = await apiReservations.list();
    return data.map(mapReservation);
  } catch {
    return JSON.parse(localStorage.getItem('ilehya-reservations') || '[]');
  }
}

export async function addReservation(data: Omit<Reservation, 'id' | 'createdAt' | 'statut'>): Promise<Reservation> {
  const payload = {
    client_name: data.clientName,
    client_email: data.clientEmail,
    client_phone: data.clientPhone,
    room_id: data.roomId,
    room_title: data.roomTitle,
    date_debut: data.dateDebut,
    date_fin: data.dateFin,
    montant: data.montant,
    message: data.message,
    statut: 'en_attente' as const,
  };
  const created = await apiReservations.create(payload);
  return mapReservation(created);
}

export async function updateReservationStatut(id: string, statut: 'confirmee' | 'annulee'): Promise<void> {
  await apiReservations.updateStatut(id, statut);
}

export async function checkDateConflict(roomId: string, dateDebut: string, dateFin: string, excludeId?: string): Promise<{ hasConflict: boolean }> {
  try {
    return await apiReservations.checkConflict(roomId, dateDebut, dateFin, excludeId);
  } catch {
    return { hasConflict: false };
  }
}

export interface ConflictInfo {
  hasConflict: boolean;
  conflictingReservation?: Reservation;
}
