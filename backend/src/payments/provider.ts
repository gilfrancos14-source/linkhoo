/**
 * Sélection du prestataire de paiement.
 *
 * `PAYMENTS_PROVIDER` permet de revenir à FedaPay sans redéploiement de code :
 * c'est le levier de rollback du chantier Hub2. Toute valeur absente ou
 * inconnue retombe sur `fedapay` — un basculement silencieux vers Hub2 en cas
 * de faute de frappe exposerait un checkout non configuré.
 */

export type PaymentsProvider = 'fedapay' | 'hub2';

export const PAYMENTS_PROVIDERS: readonly PaymentsProvider[] = ['fedapay', 'hub2'];

export function getPaymentsProvider(env: NodeJS.ProcessEnv = process.env): PaymentsProvider {
  const raw = (env.PAYMENTS_PROVIDER || '').trim().toLowerCase();
  return raw === 'hub2' ? 'hub2' : 'fedapay';
}

export function isHub2Provider(env: NodeJS.ProcessEnv = process.env): boolean {
  return getPaymentsProvider(env) === 'hub2';
}
