import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de sûreté : retire de TOUTE réponse JSON les clés qui ne
 * doivent jamais quitter le serveur (identifiants techniques, secrets).
 *
 * Attention — volontairement RESTREINT :
 *  - Pas de `Cache-Control: no-store` global (casserait la stratégie de cache
 *    de l'application, notamment PUBLIC_CACHE_PATHS + ETag).
 *  - Pas d'en-tête `Set-Cookie` global (un Set-Cookie global invalide
 *    s'ajouterait à celui des vraies routes de connexion).
 *  - Pas de `X-Powered-By` : l'application le désactive volontairement via
 *    `app.disable('x-powered-by')` — on ne le réactive pas.
 *  - Pas de masquage d'email / téléphone / adresse : ce sont des données
 *    métier que le frontend a légitimement besoin d'afficher. La protection
 *    des PII relève des routes `/api/pii` et du chiffrement au repos.
 *
 * Ce middleware est volontairement NON monté globalement dans index.ts :
 * helmet couvre déjà les en-têtes de sécurité. Il est réservé aux routes
 * sensibles qui le montent explicitement (opt-in).
 */

/** Clés dont la valeur ne doit jamais partir en réponse. */
const SECRET_KEY_PATTERNS = [
  'password',
  'password_hash',
  'password_salt',
  'secret',
  'api_key',
  'apikey',
  'private_key',
  'privatekey',
  'authorization',
  'refresh_token',
  'credit_card',
  'card_number',
  'cvv',
  'iban',
];

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SECRET_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Nettoie récursivement les secrets d'un objet/ tableau de réponse.
 * Préserve la forme des tableaux (les tableaux restent des tableaux).
 */
export function cleanSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cleanSensitiveData(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(key)) {
      cleaned[key] = '[REDACTED]';
    } else {
      cleaned[key] = cleanSensitiveData(entry);
    }
  }
  return cleaned;
}

/**
 * Applique le nettoyage des secrets aux réponses JSON de la route montée.
 * Usage (opt-in) : `router.use(secureResponse);`
 */
export const secureResponse = (req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(cleanSensitiveData(body))) as typeof res.json;
  next();
};

export default secureResponse;
