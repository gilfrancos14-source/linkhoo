import { pipeline, RawImage, env } from '@huggingface/transformers';
import sharp from 'sharp';

const MODEL_ID = process.env.CLIP_MODEL_ID || 'Xenova/clip-vit-base-patch32';
const DTYPE = process.env.CLIP_DTYPE || 'q8';
const RUNS = Number(process.argv[2]) || 20;
const WIDTH = 640;
const HEIGHT = 480;

if (process.env.CLIP_CACHE_DIR) env.cacheDir = process.env.CLIP_CACHE_DIR;

function randomRawImage() {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (Math.random() * 256) | 0;
  return new RawImage(pixels, WIDTH, HEIGHT, 3);
}

async function toJpeg() {
  const raw = Buffer.allocUnsafe(WIDTH * HEIGHT * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (Math.random() * 256) | 0;
  return sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).jpeg().toBuffer();
}

console.log(`Chargement du modèle ${MODEL_ID} (dtype ${DTYPE})...`);
const t0 = performance.now();
const classifier = await pipeline('zero-shot-image-classification', MODEL_ID, { dtype: DTYPE });
console.log(`Modèle chargé en ${(performance.now() - t0).toFixed(0)} ms`);

const labels = ['a bedroom', 'a kitchen', 'a landscape', 'a photo of a person'];
await classifier(randomRawImage(), labels, { top_k: labels.length });

const latencies = [];
for (let i = 0; i < RUNS; i++) {
  const jpeg = await toJpeg();
  const { data, info } = await sharp(jpeg)
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
  const start = performance.now();
  await classifier(image, labels, { top_k: labels.length });
  latencies.push(performance.now() - start);
}

latencies.sort((a, b) => a - b);
const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))].toFixed(0);
const rss = (process.memoryUsage().rss / 1024 / 1024).toFixed(0);

console.log(`${RUNS} inférences — p50 ${pct(50)} ms · p95 ${pct(95)} ms · max ${latencies.at(-1).toFixed(0)} ms · RSS ${rss} Mo`);
