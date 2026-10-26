// Clés du bucket privé `verification-docs`.
//
// Le chemin d'un document est DÉRIVÉ côté serveur : chaque objet vit sous un
// préfixe `<propriétaire>/`, où le propriétaire est l'id Clerk (assis sur le
// rôle qui a téléversé). Le client ne choisit donc jamais sa clé, ce qui ferme
// l'IDOR où un gérant pouvait inscrire le `file_path` d'un autre gérant puis
// obtenir une URL signée via `GET /gerants/:id/documents`.

/** Id Clerk réduit à un segment de clé storage sûr et borné. */
export function sanitizeOwnerId(clerkUserId: string): string {
  const sanitized = clerkUserId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
  return sanitized || 'unknown';
}

export function verificationDocPrefix(clerkUserId: string): string {
  return `${sanitizeOwnerId(clerkUserId)}/`;
}

/**
 * Vrai si `path` est bien un objet du préfixe de cet utilisateur. Refuse les
 * segments de traversée (`..`) et les préfixes d'un autre propriétaire.
 */
export function isOwnedVerificationPath(path: string, clerkUserId: string): boolean {
  if (typeof path !== 'string' || path.length === 0 || path.length > 512) return false;
  if (path.includes('..') || path.includes('\\')) return false;
  return path.startsWith(verificationDocPrefix(clerkUserId));
}

/**
 * Objets téléversés avant l'introduction du préfixe propriétaire : nom plat
 * `uuid.ext`. On continue de les signer pour ne pas casser l'existant.
 */
export function isLegacyVerificationPath(path: string): boolean {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    path.length <= 512 &&
    !path.includes('/') &&
    !path.includes('..') &&
    !path.includes('\\')
  );
}

/** Chemin signable pour ce propriétaire (préfixé et possédé, ou ancien format). */
export function isAccessibleVerificationPath(path: string, clerkUserId: string): boolean {
  return isOwnedVerificationPath(path, clerkUserId) || isLegacyVerificationPath(path);
}
