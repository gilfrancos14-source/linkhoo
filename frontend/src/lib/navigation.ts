/**
 * Redirection vers une page externe (checkout hébergé du prestataire).
 *
 * Isolée dans un module pour rester testable : `window.location` est une
 * propriété non redéfinissable sous jsdom, donc les tests ne peuvent pas
 * espionner `assign` directement.
 *
 * Sécurité : on n'accepte que HTTPS, sur le domaine pawaPay ou sur l'origine
 * courante. Sans ce garde-fou, une réponse API modifiée (XSS, proxy, backend
 * compromis) pourrait envoyer le navigateur vers `javascript:` ou un site de
 * phishing en pleine page de paiement.
 */
export function redirectTo(url: string): void {
  const target = new URL(url, window.location.href);
  const sameOrigin = target.origin === window.location.origin;

  if (target.protocol !== 'https:' && !sameOrigin) {
    throw new Error('URL de paiement invalide (HTTPS requis).');
  }

  if (!sameOrigin) {
    const host = target.hostname.toLowerCase();
    if (host !== 'checkout.pawapay.io' && !host.endsWith('.pawapay.io')) {
      throw new Error('URL de paiement invalide (domaine non autorisé).');
    }
  }

  window.location.assign(target.href);
}
