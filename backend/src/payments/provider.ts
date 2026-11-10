/**
 * Prestataire de paiement.
 *
 * pawaPay est l'unique prestataire de paiement de la plateforme.
 * La fonction est conservée pour que les appelants n'aient pas à connaître ce
 * détail, et pour garder un point d'extension si un second prestataire devait
 * être rebranché un jour.
 */

export type PaymentsProvider = 'pawapay';

export const PAYMENTS_PROVIDERS: readonly PaymentsProvider[] = ['pawapay'];

export function getPaymentsProvider(): PaymentsProvider {
  return 'pawapay';
}

export function isPawapayProvider(): boolean {
  return true;
}
