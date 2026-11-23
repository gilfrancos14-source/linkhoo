/**
 * Worker de traduction asynchrone (OPUS-MT / Transformers.js).
 *
 * Lit la file `translation_jobs` un job à la fois, traduit les champs texte
 * d'une chambre du français vers l'anglais et l'espagnol, et écrit le résultat
 * dans `translations`. Le français reste la source et le fallback.
 *
 * Le modèle est préchargé dans l'image au build (voir i18nModelPreload.mjs) :
 * aucun téléchargement réseau au démarrage du conteneur.
 */
import 'dotenv/config';
import { Client } from 'pg';
import { env, pipeline } from '@huggingface/transformers';
import protection from '../dist/i18n/textProtection.js';

const { protectText, similarity } = protection;

const CACHE_DIR = process.env.I18N_CACHE_DIR || 'i18n-model';
const DTYPE = process.env.I18N_DTYPE || 'q8';
const REVIEW_THRESHOLD = Number(process.env.I18N_REVIEW_THRESHOLD || 0.55);
const POLL_MS = Number(process.env.I18N_POLL_MS || 5000);
const MAX_ATTEMPTS = 3;

const MODELS = {
  en: {
    forward: process.env.I18N_MODEL_FR_EN || 'Xenova/opus-mt-fr-en',
    backward: process.env.I18N_MODEL_EN_FR || 'Xenova/opus-mt-en-fr',
  },
  es: {
    forward: process.env.I18N_MODEL_FR_ES || 'Xenova/opus-mt-fr-es',
    backward: process.env.I18N_MODEL_ES_FR || 'Xenova/opus-mt-es-fr',
  },
};

const FIELDS = ['title', 'subtitle', 'info', 'description', 'conditions', 'capacity'];

env.cacheDir = CACHE_DIR;

const translators = new Map();
async function getTranslator(name) {
  if (!translators.has(name)) {
    translators.set(name, pipeline('translation', name, { dtype: DTYPE }));
  }
  return translators.get(name);
}

async function translate(text, locale) {
  const worker = await getTranslator(MODELS[locale].forward);
  const output = await worker(text);
  return Array.isArray(output) ? output[0]?.translation_text ?? text : text;
}

async function translateBack(text, locale) {
  const worker = await getTranslator(MODELS[locale].backward);
  const output = await worker(text);
  return Array.isArray(output) ? output[0]?.translation_text ?? text : text;
}

async function hasExistingTranslation(client, job) {
  const { rows } = await client.query(
    `SELECT field, value FROM public.translations
     WHERE entity_type = $1 AND entity_id = $2 AND locale = $3 AND source_hash = $4`,
    [job.entity_type, job.entity_id, job.locale, job.source_hash],
  );
  return rows.length > 0 ? new Map(rows.map((r) => [r.field, r.value])) : null;
}

async function saveTranslation(client, job, field, value, status) {
  await client.query(
    `INSERT INTO public.translations
       (entity_type, entity_id, locale, field, value, status, source_hash, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (entity_type, entity_id, locale, field) DO UPDATE
       SET value = EXCLUDED.value,
           status = EXCLUDED.status,
           source_hash = EXCLUDED.source_hash,
           updated_at = now()
     WHERE public.translations.status <> 'corrige'`,
    [job.entity_type, job.entity_id, job.locale, field, value, status, job.source_hash],
  );
}

async function processJob(client, job) {
  const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
  const existing = await hasExistingTranslation(client, job);
  const translated = {};
  let needsReview = false;

  for (const field of FIELDS) {
    const source = typeof payload[field] === 'string' ? payload[field] : '';
    if (!source.trim()) continue;

    if (existing?.get(field)) {
      translated[field] = existing.get(field);
      continue;
    }

    const properNouns = [payload.ville, payload.quartier, payload.pays]
      .filter((value) => typeof value === 'string' && value.trim().length > 0);
    const protectedText = protectText(source, properNouns);
    const raw = await translate(protectedText.text, job.locale);
    const value = protectedText.restore(raw);
    translated[field] = value;

    // Aller-retour : si la phrase revient trop différente du français, on
    // publie quand même mais on signale la traduction pour relecture ciblée.
    const back = await translateBack(value, job.locale);
    if (similarity(source, back) < REVIEW_THRESHOLD) needsReview = true;

    await saveTranslation(client, job, field, value, 'auto');
  }

  return needsReview ? 'review' : 'done';
}

async function claimJob(client) {
  await client.query('BEGIN');
  const { rows } = await client.query(
    `SELECT id, entity_type, entity_id, locale, payload, source_hash, attempts
     FROM public.translation_jobs
     WHERE status = 'pending' AND attempts < $1
     ORDER BY id
     FOR UPDATE SKIP LOCKED
     LIMIT 1`,
    [MAX_ATTEMPTS],
  );
  if (rows.length === 0) {
    await client.query('COMMIT');
    return null;
  }
  return rows[0];
}

async function finishJob(client, id, status, error = null) {
  await client.query(
    `UPDATE public.translation_jobs
     SET status = $2, attempts = attempts + 1, last_error = $3, updated_at = now()
     WHERE id = $1`,
    [id, status, error],
  );
  await client.query('COMMIT');
}

let running = true;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    running = false;
    console.log(`[i18n] signal ${signal}, arrêt après le job en cours…`);
  });
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
console.log(`[i18n] worker prêt (cache ${CACHE_DIR}, seuil ${REVIEW_THRESHOLD})`);

while (running) {
  try {
    const job = await claimJob(client);
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      continue;
    }
    try {
      const status = await processJob(client, job);
      await finishJob(client, job.id, status);
      console.log(`[i18n] job ${job.id} ${job.entity_type}/${job.entity_id} ${job.locale} -> ${status}`);
    } catch (err) {
      await client.query('ROLLBACK');
      const attempts = job.attempts + 1;
      await finishJob(client, job.id, attempts >= MAX_ATTEMPTS ? 'error' : 'pending', err.message);
      console.error(`[i18n] job ${job.id} en erreur :`, err.message);
    }
  } catch (err) {
    console.error('[i18n] boucle en erreur :', err.message);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

await client.end();
