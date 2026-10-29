export type View = 'overview' | 'stays' | 'favorites' | 'profile';

export interface ReviewFormState {
  reservationId: string;
  roomTitle: string;
  noteAppartement: number;
  noteGerant: number;
  commentaire: string;
}
