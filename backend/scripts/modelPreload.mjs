import { pipeline, env } from '@huggingface/transformers';

const MODEL_ID = process.env.CLIP_MODEL_ID || 'Xenova/clip-vit-base-patch32';
const DTYPE = process.env.CLIP_DTYPE || 'q8';

if (process.env.CLIP_CACHE_DIR) env.cacheDir = process.env.CLIP_CACHE_DIR;

console.log(`Téléchargement du modèle ${MODEL_ID} (dtype ${DTYPE}) dans ${env.cacheDir} ...`);
await pipeline('zero-shot-image-classification', MODEL_ID, { dtype: DTYPE });
console.log('Modèle prêt. Le premier démarrage du serveur ne le re-téléchargera pas.');
