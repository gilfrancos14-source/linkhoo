/**
 * Redirection vers une page externe (checkout hébergé du prestataire).
 *
 * Isolée dans un module pour rester testable : `window.location` est une
 * propriété non redéfinissable sous jsdom, donc les tests ne peuvent pas
 * espionner `assign` directement.
 */
export function redirectTo(url: string): void {
  window.location.assign(url);
}
