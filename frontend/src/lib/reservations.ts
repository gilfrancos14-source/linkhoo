import {
  apiReservations,
  type BookingPaymentInfo,
  type ReservationData,
  type ClientMineReservationData,
  type ReservationPaymentStatus,
} from './api';
import type { DureeUnite } from './duration';

export interface Reservation {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  roomId: string;
  roomTitle: string;
  dateDebut: string;
  dateFin: string;
  dureeNombre: number;
  dureeUnite: DureeUnite;
  montant: number;
  statut: 'en_attente' | 'confirmee' | 'annulee';
  createdAt: string;
  respondedAt?: string;
  gerantPhone?: string | null;
  gerantNom?: string | null;
  gerantPrenom?: string | null;
  gerantIsVerified?: boolean;
  gerantIsPremium?: boolean;
  /** Clé d'idempotence (anti doublon des rejeux hors-ligne/timeout). */
  clientKey?: string;
  /** Vie financière, distincte de la décision du gérant. */
  paymentStatus?: ReservationPaymentStatus;
  paidAt?: string | null;
  /** Somme déjà remboursée par la plateforme. */
  refundedAmount?: number;
  /** Checkout ouvert (ou état payé) renvoyé à la création. */
  payment?: BookingPaymentInfo | null;
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

export const paymentLabels: Record<ReservationPaymentStatus, string> = {
  unpaid: 'Paiement à effectuer',
  pending: 'Paiement en cours',
  deposit_paid: 'Acompte versé',
  paid: 'Payée',
  refund_pending: 'Remboursement en cours',
  partially_refunded: 'Partiellement remboursée',
  refunded: 'Remboursée',
  failed: 'Paiement échoué',
};

/** Un bouton « Payer » n'a de sens que tant que rien n'est encaissé. */
export function canPayReservation(status: ReservationPaymentStatus | undefined): boolean {
  return status === 'unpaid' || status === 'failed';
}

export const paymentColors: Record<ReservationPaymentStatus, string> = {
  unpaid: '#D97706',
  pending: '#D97706',
  deposit_paid: '#0EA5E9',
  paid: '#22c55e',
  refund_pending: '#0EA5E9',
  partially_refunded: '#0EA5E9',
  refunded: '#64748B',
  failed: '#ef4444',
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
    dureeNombre: d.duree_nombre ?? 1,
    dureeUnite: d.duree_unite ?? 'nuit',
    montant: d.montant,
    statut: d.statut,
    createdAt: d.created_at,
    respondedAt: d.responded_at ?? undefined,
    gerantPhone: d.gerant_phone ?? undefined,
    gerantNom: d.gerant_nom ?? undefined,
    gerantPrenom: d.gerant_prenom ?? undefined,
    gerantIsVerified: d.gerant_is_verified ?? false,
    gerantIsPremium: d.gerant_is_premium ?? false,
    paymentStatus: d.payment_status,
    paidAt: d.paid_at ?? null,
    refundedAmount: d.refunded_amount ?? undefined,
    payment: d.payment ?? null,
  };
}

export async function getReservations(): Promise<Reservation[]> {
  const data = await apiReservations.list();
  return data.map(mapReservation);
}

export async function addReservation(data: Omit<Reservation, 'id' | 'createdAt' | 'statut' | 'respondedAt'>): Promise<Reservation> {
  const payload = {
    client_name: data.clientName,
    client_email: data.clientEmail,
    client_phone: data.clientPhone,
    room_id: data.roomId,
    room_title: data.roomTitle,
    date_debut: data.dateDebut,
    date_fin: data.dateFin,
    duree_nombre: data.dureeNombre,
    duree_unite: data.dureeUnite,
    montant: data.montant,
    // Absent si undefined : JSON.stringify n'envoie rien au serveur, qui
    // traite alors la demande sans déduplication (comportement historique).
    client_key: data.clientKey,
  };
  const created = await apiReservations.create(payload);
  return mapReservation(created);
}

export async function getMyReservations(): Promise<ClientMineReservationData[]> {
  return apiReservations.listMine();
}

export async function cancelMyReservation(id: string) {
  return apiReservations.cancelMine(id);
}

/** (Ré)ouvre le checkout d'une réservation ; renvoie l'URL hébergée Hub2. */
export async function startReservationPayment(id: string) {
  return apiReservations.startPayment(id);
}

/** Confirme le retour de checkout (le webhook reste le chemin nominal). */
export async function confirmReservationPayment(reference: string) {
  return apiReservations.confirmPayment(reference);
}

export async function updateReservationStatut(id: string, statut: 'confirmee' | 'annulee'): Promise<void> {
  await apiReservations.updateStatut(id, statut);
}

export async function checkDateConflict(roomId: string, dateDebut: string, dateFin: string, excludeId?: string): Promise<{ hasConflict: boolean }> {
  return await apiReservations.checkConflict(roomId, dateDebut, dateFin, excludeId);
}
