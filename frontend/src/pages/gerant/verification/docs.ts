import type { VerificationDocument } from '../../../lib/api';

export type DocType = 'national_id' | 'proof_of_address' | 'selfie';

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
  national_id: {
    title: 'Pièce d\'identité',
    description: 'Photo de votre pièce d\'identité',
    accept: 'image/*,.pdf',
    hint: 'JPG, PNG ou PDF · document lisible',
  },
  proof_of_address: {
    title: 'Justificatif de domicile',
    description: 'Facture d\'eau, d\'électricité ou attestation de domicile',
    accept: 'image/*,.pdf',
    hint: 'JPG, PNG ou PDF · moins de 3 mois',
  },
  selfie: {
    title: 'Photo de vous',
    description: 'Selfie récent, visage bien visible',
    accept: 'image/*',
    hint: 'JPG ou PNG · visage dégagé',
  },
};

export const DOC_ORDER: DocType[] = ['national_id', 'proof_of_address', 'selfie'];

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
