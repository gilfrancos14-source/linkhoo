/**
 * Règle d'annulation côté client.
 *
 * Décision commerciale : l'annulation est possible jusqu'à **24 h avant la
 * date d'arrivée** du client. Passé ce délai, l'annulation est bloquée.
 *
 * Pourquoi : le gérant a déjà réservé le séjour, cœur de son chiffre
 * d'affaires ; et le reversement au gérant intervient 24 h après la fin du
 * séjour. Autoriser une annulation au dernier moment obligerait la
 * plateforme à reprendre de l'argent au gérant — toujours pénible, parfois
 * impossible.
 *
 * Le délai est le même que celui du reversement (`payment_policies
 * .payout_delay_hours`, 24 h par défaut) : la fenêtre d'annulation se ferme
 * donc avant même le début du séjour.
 */

export const CANCELLATION_FREE_HOURS = 24;

/**
 * Retenue appliquée sur le remboursement d'une annulation.
 *
 * Règle commerciale : quand le CLIENT annule, il est remboursé, mais une
 * retenue de 3 % est appliquée (frais d'encaissement et de transaction). Le
 * client reçoit donc 97 %. Cette retenue est partagée équitablement :
 * 1,5 % pour la plateforme et 1,5 % pour le gérant.
 *
 * La taxe ne concerne que l'annulation par le client : un refus ou une
 * annulation du gérant, une décision de la plateforme ne sont pas pénalisés.
 */
export const CANCELLATION_FEE_PERCENT = 3;

/**
 * Part de la retenue d'annulation reversée au gérant (en points de
 * pourcentage). Le reste revient à la plateforme.
 */
export const CANCELLATION_GERANT_FEE_PERCENT = CANCELLATION_FEE_PERCENT / 2; // 1,5 %

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Date limite d'annulation : 24 h avant l'arrivée.
 *
 * `date_debut` est stockée en texte au format `AAAA-MM-JJ` (aucun horaire) :
 * la limite est donc calculée sur minuit UTC, ce qui laisse au client
 * légèrement plus de marge que 24 h pleines.
 */
export function cancellationDeadline(dateDebut: string | null | undefined): Date | null {
  if (!dateDebut || !DATE_RE.test(dateDebut)) return null;
  const arrival = new Date(`${dateDebut}T00:00:00.000Z`);
  if (Number.isNaN(arrival.getTime())) return null;
  return new Date(arrival.getTime() - CANCELLATION_FREE_HOURS * 60 * 60 * 1000);
}

/** Vrai si l'annulation est encore possible. */
export function canCancelReservation(
  dateDebut: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const deadline = cancellationDeadline(dateDebut);
  // Date illisible : on n'empêche jamais (mieux vaut une annulation contestable
  // qu'un blocage injustifié).
  if (!deadline) return true;
  return deadline.getTime() >= now.getTime();
}

/** Date limite au format ISO, pour l'API. */
export function cancellationDeadlineIso(dateDebut: string | null | undefined): string | null {
  return cancellationDeadline(dateDebut)?.toISOString() ?? null;
}

/** Message d'erreur affiché au client quand la fenêtre est fermée. */
export const CANCELLATION_TOO_LATE_MESSAGE = `L'annulation n'est plus possible : elle doit être faite au moins ${CANCELLATION_FREE_HOURS} h avant la date d'arrivée.`;

/**
 * Retenue appliquée sur un remboursement d'annulation, partagée moitié-moitié.
 *
 * `amount` est le montant restant à rembourser ; la fonction renvoie :
 *   - `fee`          : retenue TOTALE (3 %) = plateforme + gérant ;
 *   - `platformFee`  : part de la plateforme (1,5 %) ;
 *   - `gerantFee`    : part reversée au gérant (1,5 %) ;
 *   - `clientAmount` : ce que le client reçoit (97 %).
 *
 * L'arrondi au franc près est attribué à la plateforme : `gerantFee` est
 * calculé en retranchant, de sorte que `platformFee + gerantFee === fee`
 * exactement et qu'aucun centime ne soit perdu ou dupliqué.
 */
export function splitCancellationFee(
  amount: number,
): { fee: number; platformFee: number; gerantFee: number; clientAmount: number } {
  const total = Math.max(0, Math.trunc(Number(amount) || 0));
  if (total <= 0) return { fee: 0, platformFee: 0, gerantFee: 0, clientAmount: 0 };
  const fee = Math.min(total, Math.round((total * CANCELLATION_FEE_PERCENT) / 100));
  const gerantFee = Math.min(fee, Math.round((total * CANCELLATION_GERANT_FEE_PERCENT) / 100));
  const platformFee = fee - gerantFee;
  return { fee, platformFee, gerantFee, clientAmount: total - fee };
}
