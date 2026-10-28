import type { IconName } from '../landing/icons';

export interface ContactCountry {
  readonly label: string;
  readonly colors: readonly [string, string, string];
}

export const CONTACT_COUNTRIES: readonly ContactCountry[] = [
  { label: 'Sénégal', colors: ['#00853f', '#fdef42', '#e31b23'] },
  { label: "Côte d'Ivoire", colors: ['#f77f00', '#ffffff', '#009e60'] },
  { label: 'Bénin', colors: ['#008751', '#fcd116', '#e8112d'] },
  { label: 'Mali', colors: ['#14b53a', '#fcd116', '#ce1126'] },
];

export const CONTACT_SUBJECTS = [
  'Question générale',
  'Publier une annonce',
  'Problème technique',
  'Paiement',
  'Suggestion',
] as const;

export interface ContactHighlight {
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
}

export const CONTACT_HIGHLIGHTS: readonly ContactHighlight[] = [
  { icon: 'badgeCheck', title: 'Réponse rapide', text: 'Sous 24h, en général' },
  { icon: 'userRound', title: 'Équipe disponible', text: '7j/7, de 8h à 22h' },
  {
    icon: 'shieldCheck',
    title: 'Aide personnalisée',
    text: 'Par email, téléphone ou via le formulaire',
  },
];

export interface ContactFaqItem {
  readonly question: string;
  readonly answer: string;
}

export const CONTACT_FAQS: readonly ContactFaqItem[] = [
  {
    question: 'Comment réserver un logement sur Linkhoo ?',
    answer:
      'Choisissez votre pays, votre ville et vos dates, ouvrez la fiche du logement puis envoyez votre demande de réservation. Vous réglez le séjour en ligne au moment de la demande ; le gérant confirme ensuite la disponibilité. Si la demande est refusée ou annulée, le montant est remboursé intégralement. Vous pouvez aussi échanger avec le gérant via la messagerie intégrée.',
  },
  {
    question: 'Comment se règle le loyer ?',
    answer:
      'Le séjour se règle en ligne au moment de la demande, par mobile money ou carte bancaire via notre prestataire Hub2. Linkhoo encaisse le montant et le reverse au gérant après le séjour. En cas de refus du gérant ou d’annulation, le remboursement est total.',
  },
  {
    question: 'Comment publier mon logement en tant que gérant ?',
    answer:
      'Créez un compte gérant, complétez la fiche du bien (ville, tarif, équipements, photos) puis publiez l’annonce. Chaque photo est contrôlée automatiquement : seules les photos d’intérieur ou de façade sont acceptées, sans personne visible.',
  },
  {
    question: 'Pourquoi mon compte gérant doit-il être vérifié ?',
    answer:
      'La vérification (pièce d’identité et selfie) rassure les voyageurs et débloque la gestion de vos biens : messagerie, traitement des réservations et badge de confiance. Tant que le compte n’est pas vérifié, les réservations de vos biens sont gérées par l’administrateur.',
  },
  {
    question: 'Comment rendre mon annonce plus visible ?',
    answer:
      'L’abonnement Premium (5 000 XOF par mois) ajoute un badge et fait remonter une de vos annonces en tête des résultats sur votre marché.',
  },
  {
    question: 'Comment laisser un avis après un séjour ?',
    answer:
      'Depuis votre espace client, vous pouvez publier un avis une seule fois par réservation confirmée. Votre note et votre commentaire sont ensuite affichés sur la fiche du logement pour aider les autres voyageurs.',
  },
];
