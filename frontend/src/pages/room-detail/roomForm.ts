import { isValidEmail } from '../../utils/validators';
import {
  DUREE_MAX_NUIT,
  isValidDateStr,
  maxDuree,
  nightsBetween,
  type DureeUnite,
} from '../../lib/duration';

export interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  dateDebut?: string;
  duree?: string;
}

/** Lien wa.me : le numéro est normalisé (chiffres only, sans +) ; renvoie
    null si le numéro est illisible pour éviter un lien WhatsApp cassé. */
export function whatsappHref(phone: string, message: string): string | null {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function initialDuree(searchParams: URLSearchParams): string {
  const arrivee = searchParams.get('arrivee');
  const depart = searchParams.get('depart');
  const nights = arrivee && depart ? nightsBetween(arrivee, depart) : null;
  if (nights && nights >= 1) return String(Math.min(nights, DUREE_MAX_NUIT));
  return '1';
}

export function validateForm(
  data: { name: string; email: string; phone: string; dateDebut: string; duree: number },
  unite: DureeUnite,
): FormErrors {
  const errors: FormErrors = {};
  if (!data.name.trim()) errors.name = 'Veuillez renseigner votre nom.';
  if (!data.email.trim()) {
    errors.email = 'Veuillez renseigner votre email.';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Adresse email invalide.';
  }
  if (!data.phone.trim()) {
    errors.phone = 'Veuillez renseigner votre téléphone.';
  } else if (!/^[\d\s+()-]{6,}$/.test(data.phone)) {
    errors.phone = 'Numéro de téléphone invalide.';
  }
  if (!data.dateDebut) {
    errors.dateDebut = 'Veuillez choisir une date de début.';
  } else if (!isValidDateStr(data.dateDebut)) {
    errors.dateDebut = 'Date de début invalide.';
  }
  const max = maxDuree(unite);
  if (!Number.isInteger(data.duree) || data.duree < 1) {
    errors.duree = 'Veuillez saisir une durée valide.';
  } else if (data.duree > max) {
    errors.duree = `La durée maximale est de ${max} ${unite === 'mois' ? 'mois' : 'nuits'}.`;
  }
  return errors;
}
