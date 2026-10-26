import { formatDateTimeShort } from '../../../lib/formatDate';
import type { VerificationStatusResponse } from '../../../lib/api';
import type { SuiviDocument, VerificationStatusValue } from './useSuiviVerification';

/**
 * Règles d'affichage du suivi de vérification.
 *
 * Toutes les décisions « quel libellé, quelle couleur, quelle date » vivent ici
 * sous forme de fonctions pures : le composant ne fait que rendre le résultat,
 * et les cas limites (refus, dossier jamais soumis, pièce rejetée) sont testés
 * sans monter de DOM.
 */

export type StepTone = 'done' | 'current' | 'upcoming' | 'rejected';
export type BadgeTone = 'done' | 'current' | 'waiting' | 'rejected';

export interface Badge {
  label: string;
  tone: BadgeTone;
}

export interface Headline {
  title: string;
  description: string;
  badge: Badge;
  /** Libellé du bouton vers le formulaire, `null` quand aucune action n'est utile. */
  actionLabel: string | null;
}

export const DOCUMENT_ORDER: SuiviDocument['document_type'][] = [
  'national_id',
  'proof_of_address',
  'selfie',
];

export const DOCUMENT_LABELS: Record<SuiviDocument['document_type'], string> = {
  national_id: "Pièce d'identité",
  proof_of_address: 'Justificatif de domicile',
  selfie: 'Photo de vous',
};

/** Libellé de badge associé à l'état d'une étape. */
export const TONE_BADGE: Record<StepTone, Badge> = {
  done: { label: 'Terminé', tone: 'done' },
  current: { label: 'En cours', tone: 'current' },
  upcoming: { label: 'En attente', tone: 'waiting' },
  rejected: { label: 'Refusé', tone: 'rejected' },
};

export function isUnderReview(status: VerificationStatusValue): boolean {
  return status === 'pending' || status === 'under_review';
}

const KNOWN_STATUSES: readonly VerificationStatusValue[] = [
  'none',
  'pending',
  'under_review',
  'approved',
  'rejected',
];

/**
 * Le backend renvoie `verification_status` en `string` (colonne Supabase) :
 * on normalise ici pour que le reste du code manipule une union stricte et
 * qu'une valeur inattendue retombe sur « dossier non soumis ».
 */
export function toVerificationStatus(value: string | null | undefined): VerificationStatusValue {
  return KNOWN_STATUSES.includes(value as VerificationStatusValue)
    ? (value as VerificationStatusValue)
    : 'none';
}

/** Badge du dossier complet (en-tête et résumé). */
export function overallBadge(status: VerificationStatusValue): Badge {
  switch (status) {
    case 'approved':
      return { label: 'Validé', tone: 'done' };
    case 'rejected':
      return { label: 'Refusé', tone: 'rejected' };
    case 'pending':
      return { label: 'En attente', tone: 'current' };
    case 'under_review':
      return { label: 'En cours', tone: 'current' };
    default:
      return { label: 'À compléter', tone: 'waiting' };
  }
}

/** Bandeau principal : message et action dépendent du statut réel. */
export function headline(
  status: VerificationStatusValue,
  rejectionReason: string | null,
): Headline {
  if (status === 'approved') {
    return {
      title: 'Votre compte est vérifié',
      description:
        'Vos documents ont été validés. Vous pouvez publier vos annonces et gérer vos réservations.',
      badge: overallBadge(status),
      actionLabel: null,
    };
  }

  if (status === 'rejected') {
    return {
      title: 'Votre dossier a été refusé',
      description:
        rejectionReason?.trim() ||
        'Un ou plusieurs documents ne sont pas conformes. Corrigez votre dossier puis soumettez-le à nouveau.',
      badge: overallBadge(status),
      actionLabel: 'Corriger mon dossier',
    };
  }

  if (isUnderReview(status)) {
    return {
      title: "Votre dossier est en cours d'examen",
      description:
        'Notre équipe vérifie actuellement les documents que vous avez fournis. Cette étape peut prendre entre 24 et 48 heures selon la complexité de votre dossier.',
      badge: overallBadge(status),
      actionLabel: null,
    };
  }

  return {
    title: "Votre dossier n'est pas encore soumis",
    description:
      'Complétez vos informations personnelles et ajoutez vos documents pour lancer la vérification.',
    badge: overallBadge(status),
    actionLabel: 'Compléter mon dossier',
  };
}

export interface StepTones {
  submitted: StepTone;
  review: StepTone;
  final: StepTone;
  verified: StepTone;
}

/**
 * Étapes du bandeau horizontal.
 * `submittedAt` fait foi pour l'étape 1 : un statut `pending` sans date de
 * soumission reste affiché comme « à venir » plutôt que de mentir.
 */
export function stepTones(
  status: VerificationStatusValue,
  submittedAt: string | null,
): StepTones {
  const submitted: StepTone = submittedAt ? 'done' : 'upcoming';
  const review: StepTone =
    status === 'approved'
      ? 'done'
      : status === 'rejected'
        ? 'rejected'
        : isUnderReview(status)
          ? 'current'
          : 'upcoming';
  const final: StepTone =
    status === 'approved' ? 'done' : status === 'rejected' ? 'rejected' : 'upcoming';
  const verified: StepTone = status === 'approved' ? 'done' : 'upcoming';

  return { submitted, review, final, verified };
}

export interface DetailTones {
  submitted: StepTone;
  review: StepTone;
  profile: StepTone;
  activation: StepTone;
}

/** Étapes de la chronologie détaillée. */
export function detailTones(
  status: VerificationStatusValue,
  submittedAt: string | null,
): DetailTones {
  const { review } = stepTones(status, submittedAt);
  return {
    submitted: submittedAt ? 'done' : 'upcoming',
    review,
    // Un refus arrête le dossier à l'examen : les étapes suivantes n'ont pas
    // eu lieu et restent donc « en attente » plutôt que « refusées ».
    profile: status === 'approved' ? 'done' : 'upcoming',
    activation: status === 'approved' ? 'done' : 'upcoming',
  };
}

/** Badge d'une pièce justificative, du point de vue du gérant. */
export function documentBadge(
  doc: SuiviDocument | undefined,
  status: VerificationStatusValue,
): Badge {
  if (!doc) return { label: 'À ajouter', tone: 'waiting' };
  if (doc.status === 'approved') return { label: 'Validé', tone: 'done' };
  if (doc.status === 'rejected') return { label: 'Refusé', tone: 'rejected' };
  if (isUnderReview(status)) return { label: 'En cours', tone: 'current' };
  return { label: 'Ajouté', tone: 'waiting' };
}

/** Indexe les documents par type (une seule version par type côté backend). */
export function documentsByType(
  documents: SuiviDocument[],
): Map<SuiviDocument['document_type'], SuiviDocument> {
  const byType = new Map<SuiviDocument['document_type'], SuiviDocument>();
  for (const doc of documents) byType.set(doc.document_type, doc);
  return byType;
}

/** Date + heure, ou repli explicite quand la donnée n'existe pas encore. */
export function formatMoment(value: string | null | undefined, fallback = 'À venir'): string {
  return formatDateTimeShort(value) || fallback;
}

/** Dernière mise à jour du dossier (revue si elle a eu lieu, sinon soumission). */
export function lastUpdate(status: VerificationStatusResponse | null): string {
  if (!status) return '—';
  return (
    formatDateTimeShort(status.verification_reviewed_at ?? status.verification_submitted_at) || '—'
  );
}

/** Nombre de types de documents réellement déposés (0 à 3). */
export function submittedCount(documents: SuiviDocument[]): number {
  return documentsByType(documents).size;
}
