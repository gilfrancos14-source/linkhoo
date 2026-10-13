import { pipeline, RawImage, env } from '@huggingface/transformers';
import sharp from 'sharp';

const MODEL_ID = process.env.CLIP_MODEL_ID || 'Xenova/clip-vit-base-patch32';
const DTYPE = process.env.CLIP_DTYPE || 'q8';
const TARGET_SIZE = 224;

if (process.env.CLIP_CACHE_DIR) env.cacheDir = process.env.CLIP_CACHE_DIR;

let classifierPromise = null;

function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline('zero-shot-image-classification', MODEL_ID, { dtype: DTYPE });
    classifierPromise.catch(() => {
      classifierPromise = null;
    });
  }
  return classifierPromise;
}

async function toRawImage(jpegBase64) {
  const { data, info } = await sharp(Buffer.from(jpegBase64, 'base64'))
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'cover' })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 3) {
    throw new Error(`conversion en 3 canaux impossible (${info.channels} obtenu(s))`);
  }

  return new RawImage(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    info.width,
    info.height,
    info.channels,
  );
}

function errorMessage(err) {
  return err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
}

async function handle(msg) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'warmup') {
    try {
      await getClassifier();
      process.send({ type: 'warmed', id: msg.id });
    } catch (err) {
      process.send({ type: 'warmup-error', id: msg.id, message: errorMessage(err) });
    }
    return;
  }

  if (msg.type === 'classify') {
    try {
      const classifier = await getClassifier();
      const image = await toRawImage(msg.jpeg);
      const results = await classifier(image, msg.labels, { top_k: msg.labels.length });
      const scores = results.map((r) => ({ label: r.label, score: r.score }));
      process.send({ type: 'scores', id: msg.id, scores });
    } catch (err) {
      process.send({ type: 'scores-error', id: msg.id, message: errorMessage(err) });
    }
  }
}

process.on('message', (msg) => {
  void handle(msg);
});

process.on('disconnect', () => process.exit(0));

process.send({ type: 'ready' });
