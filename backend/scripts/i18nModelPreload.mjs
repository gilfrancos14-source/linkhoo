/**
 * Préchargement des modèles OPUS-MT au build de l'image Docker.
 * Évite tout téléchargement réseau au démarrage du worker en production.
 */
import { env, pipeline } from '@huggingface/transformers';

const CACHE_DIR = process.env.I18N_CACHE_DIR || 'i18n-model';
const DTYPE = process.env.I18N_DTYPE || 'q8';
const MODELS = [
  process.env.I18N_MODEL_FR_EN || 'Xenova/opus-mt-fr-en',
  process.env.I18N_MODEL_EN_FR || 'Xenova/opus-mt-en-fr',
  process.env.I18N_MODEL_FR_ES || 'Xenova/opus-mt-fr-es',
  process.env.I18N_MODEL_ES_FR || 'Xenova/opus-mt-es-fr',
];

env.cacheDir = CACHE_DIR;

try {
  for (const model of MODELS) {
    console.log(`[i18n] préchargement de ${model}…`);
    await pipeline('translation', model, { dtype: DTYPE });
  }
  console.log('[i18n] modèles prêts');
} catch (err) {
  console.error('[i18n] échec du préchargement :', err);
  process.exit(1);
}
