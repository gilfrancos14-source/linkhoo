import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';
import { pipeline, RawImage, env } from '@huggingface/transformers';
import sharp from 'sharp';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: npm run clip:calibrate -- <dossier-avec-photos>');
  process.exit(1);
}

const MODEL_ID = process.env.CLIP_MODEL_ID || 'Xenova/clip-vit-base-patch32';
const DTYPE = process.env.CLIP_DTYPE || 'q8';
const THRESHOLD = Number(process.env.IMAGE_CHECK_THRESHOLD) || 0.3;
const PERSON_THRESHOLD = Number(process.env.IMAGE_CHECK_PERSON_THRESHOLD) || 0.35;
const MARGIN = Number(process.env.IMAGE_CHECK_MARGIN) || 1.5;

if (process.env.CLIP_CACHE_DIR) env.cacheDir = process.env.CLIP_CACHE_DIR;

const labelsFile = new URL('../src/config/clipLabels.json', import.meta.url);
const labels = JSON.parse(readFileSync(labelsFile, 'utf8'));
const allLabels = [...labels.positifs.map((p) => p.label), ...labels.negatifs];

const files = readdirSync(dir)
  .filter((f) => ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(f).toLowerCase()))
  .filter((f) => statSync(join(dir, f)).isFile());

if (files.length === 0) {
  console.error(`Aucune image dans ${dir}`);
  process.exit(1);
}

console.log(`Chargement du modèle ${MODEL_ID} (dtype ${DTYPE})...`);
const classifier = await pipeline('zero-shot-image-classification', MODEL_ID, { dtype: DTYPE });

for (const file of files) {
  const { data, info } = await sharp(join(dir, file))
    .resize(224, 224, { fit: 'cover' })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const image = new RawImage(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    info.width,
    info.height,
    info.channels,
  );
  const results = await classifier(image, allLabels, { top_k: allLabels.length });
  const scores = Object.fromEntries(results.map((r) => [r.label, r.score]));

  const positifs = labels.positifs
    .map((p) => ({ label: p.label, categorie: p.categorie, score: scores[p.label] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const meilleurPositif = positifs[0];
  const meilleurNegatif = Math.max(...labels.negatifs.map((l) => scores[l] ?? 0));
  const personne = Math.max(...labels.personnes.map((l) => scores[l] ?? 0));

  let verdict;
  if (personne >= PERSON_THRESHOLD) verdict = 'REFUS personne_visible';
  else if (!meilleurPositif || meilleurPositif.score < THRESHOLD) verdict = 'REFUS sujet_inconnu';
  else if (meilleurPositif.score < meilleurNegatif * MARGIN) verdict = 'REFUS sujet_inconnu';
  else verdict = `ACCEPT ${meilleurPositif.categorie}`;

  console.log(
    `${file.padEnd(30)} ${verdict.padEnd(24)} ` +
    `pos=${meilleurPositif?.score.toFixed(3)} neg=${meilleurNegatif.toFixed(3)} person=${personne.toFixed(3)}`,
  );
  for (const p of positifs.slice(0, 3)) {
    console.log(`  ${p.label.padEnd(45)} ${p.score.toFixed(3)}`);
  }
}
