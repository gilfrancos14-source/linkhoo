export type Tab = 'reservations' | 'profil';

export interface ReviewFormState {
  reservationId: string;
  roomTitle: string;
  noteAppartement: number;
  noteGerant: number;
  commentaire: string;
}
