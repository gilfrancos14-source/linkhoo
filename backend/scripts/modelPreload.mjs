/**
 * Préchargement du modèle CLIP (local, gratuit).
 *
 * Utilisé :
 *  - au build de l'image Docker (`node scripts/modelPreload.mjs`) : le modèle
 *    est alors embarqué dans /app/clip-model, aucun accès réseau au runtime ;
 *  - manuellement en développement : `npm run model:preload`.
 *
 * Sans ce préchargement, le worker télécharge ~150 Mo depuis huggingface.co au
 * premier upload. Sur un serveur sans accès sortant (ou pendant la fenêtre de
 * démarrage), tous les téléversements échouent en 503 en mode strict.
 */
import { pipeline, env } from '@huggingface/transformers';

const MODEL_ID = process.env.CLIP_MODEL_ID || 'Xenova/clip-vit-base-patch32';
const DTYPE = process.env.CLIP_DTYPE || 'q8';
const CACHE_DIR = process.env.CLIP_CACHE_DIR || 'clip-model';

env.cacheDir = CACHE_DIR;

console.log(`[clip] téléchargement du modèle ${MODEL_ID} (${DTYPE}) dans ${CACHE_DIR}…`);

try {
  await pipeline('zero-shot-image-classification', MODEL_ID, { dtype: DTYPE });
  console.log('[clip] modèle prêt : le worker le chargera depuis le cache.');
} catch (err) {
  console.error('[clip] échec du préchargement du modèle :', err);
  process.exit(1);
}
