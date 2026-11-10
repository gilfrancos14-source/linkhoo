/**
 * Base des URL de retour envoyées au prestataire de paiement.
 *
 * pawaPay impose une URL HTTPS publique : `http://localhost` est refusé avec
 * un opaque `INVALID_PARAMETER`. `PAYMENTS_RETURN_BASE_URL` permet de pointer
 * les retours vers un tunnel public en développement, sans changer l'URL
 * publique du reste de l'application (`APP_PUBLIC_URL`).
 *
 * Module neutre pour éviter un import circulaire entre `service/checkout.ts`
 * et `pawapay/checkouts.ts`.
 */

export function paymentReturnBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw =
    env.PAYMENTS_RETURN_BASE_URL?.trim() ||
    env.APP_PUBLIC_URL?.trim() ||
    'http://localhost:5173';
  return raw.replace(/\/+$/, '');
}

/** pawaPay n'accepte que HTTPS pour `returnUrl`. En dev, localhost est autorisé. */
export function isHttpsUrl(value: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const isDev = env.NODE_ENV === 'development';
  const isLocalhost = /localhost(:\d+)?$/.test(value);
  
  // En développement, localhost est autor même en HTTP
  if (isDev && isLocalhost) return true;
  
  // Sinon, vérifie que c'est bien HTTPS
  return /^https:\/\//i.test(value);
}
