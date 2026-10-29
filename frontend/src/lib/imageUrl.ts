/**
 * Les visuels du seed sont livrés deux fois : l'original `.jpg` (référencé par
 * la base) et une version `.webp` générée par `scripts/optimize-images.cjs`
 * (≈4 à 6 fois plus légère). L'API expose encore les chemins `.jpg` ; on les
 * réécrit à la frontière réseau, une seule fois, plutôt que dans chaque
 * composant.
 *
 * La règle est volontairement étroite : seules les URL same-origin sous
 * `/images/` sont concernées. Les fichiers envoyés par les gérants (Supabase
 * Storage) et les visuels externes restent intacts.
 */
const SEED_IMAGE = /^\/images\/[^?#]+\.jpe?g$/i;

export function optimizedImageUrl(src: string): string {
  if (!SEED_IMAGE.test(src)) return src;
  return `${src.slice(0, src.lastIndexOf('.'))}.webp`;
}

/**
 * Parcourt une réponse API et réécrit les chemins d'images connus, sur place.
 * Les réponses JSON sont fraîches (jamais partagées avec un autre appelant
 * avant d'entrer dans le cache mémoire), la mutation est donc sûre.
 */
export function optimizeImageUrls<T>(value: T): T {
  if (typeof value === 'string') {
    return optimizedImageUrl(value) as T;
  }
  if (Array.isArray(value)) {
    const items = value as unknown[];
    for (let i = 0; i < items.length; i += 1) {
      items[i] = optimizeImageUrls(items[i]);
    }
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      record[key] = optimizeImageUrls(record[key]);
    }
    return value;
  }
  return value;
}
