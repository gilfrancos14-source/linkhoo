/**
 * Limites partagées du pipeline image (upload + vérification CLIP).
 *
 * Le plafond de pixels est appliqué à **tous** les décodages sharp : une
 * « bombe de décompression » (petit fichier, dimensions énormes) ferait sinon
 * allouer plus d'un gigaoctet de RAM par requête.
 */
export const MAX_IMAGE_PIXELS = 40_000_000; // ≈ 8000 × 5000
