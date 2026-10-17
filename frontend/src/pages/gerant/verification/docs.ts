import type { VerificationDocument } from '../../../lib/api';

export type DocType = 'id_card_front' | 'id_card_back';

export interface DocConfig {
  title: string;
  description: string;
  accept: string;
  hint: string;
}

export interface UploadState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploaded: VerificationDocument | null;
  error: string | null;
}

export const DOC_LABELS: Record<DocType, DocConfig> = {
  id_card_front: {
    title: 'Carte d\'identité — Recto',
    description: 'Photo du recto de votre carte nationale d\'identité',
    accept: 'image/*',
    hint: 'JPG ou PNG · 4 coins visibles, texte lisible',
  },
  id_card_back: {
    title: 'Carte d\'identité — Verso',
    description: 'Photo du verso de votre carte nationale d\'identité',
    accept: 'image/*',
    hint: 'JPG ou PNG · 4 coins visibles, texte lisible',
  },
};

export const DOC_ORDER: DocType[] = ['id_card_front', 'id_card_back'];

export interface AddressState {
  url: string;
  saving: boolean;
  error: string | null;
}

export interface ManualCoords {
  lat: number;
  lng: number;
}

export type Step = 1 | 2 | 3;

export interface ContactState {
  nom: string;
  prenom: string;
  phone: string;
  address: string;
}

export type ContactErrors = Partial<Record<keyof ContactState, string>>;
