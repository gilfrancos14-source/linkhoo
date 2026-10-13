import { fork, type ChildProcess } from 'child_process';
import { createHash } from 'crypto';
import path from 'path';
import sharp from 'sharp';
import clipLabels from '../config/clipLabels.json';

export type ImageCheckMode = 'strict' | 'lenient' | 'off';
export type ImageCategorie = 'interieur' | 'facade' | 'autre';

export interface ImageCheckVerdict {
  accepte: boolean;
  categorie: ImageCategorie;
  confiance: number;
  motif: string;
}

export const IMAGE_CHECK_REJECT_MESSAGE =
  "Cette image n'a pas été reconnue comme une photo d'appartement (intérieur ou façade). Seules les photos du logement sont acceptées : ni personne visible, ni paysage, ni document, ni logo.";

export class ImageCheckQueueFullError extends Error {
  constructor() {
    super("Trop d'analyses d'images en cours");
    this.name = 'ImageCheckQueueFullError';
  }
}

export class ImageCheckUnavailableError extends Error {
  constructor(message = 'Vérification des images indisponible') {
    super(message);
    this.name = 'ImageCheckUnavailableError';
  }
}

interface Score {
  label: string;
  score: number;
}

interface Pending {
  resolve: (scores: Score[] | null) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

const WORKER_PATH = path.resolve(__dirname, '../../scripts/clipWorker.mjs');
const CACHE_MAX = 100;
const ALL_LABELS = [...clipLabels.positifs.map((p) => p.label), ...clipLabels.negatifs];

let worker: ChildProcess | null = null;
let pending = new Map<number, Pending>();
let nextId = 1;
let depth = 0;
let serial: Promise<unknown> = Promise.resolve();
let restartTimes: number[] = [];
let brokenUntil = 0;

function readMode(): ImageCheckMode {
  const raw = process.env.IMAGE_CHECK_MODE?.trim().toLowerCase();
  if (raw === 'strict' || raw === 'lenient' || raw === 'off') return raw;
  return process.env.NODE_ENV === 'production' ? 'strict' : 'lenient';
}

function readNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

export function isImageCheckEnabled(): boolean {
  return readMode() !== 'off';
}

export function decideVerdict(scores: Score[]): ImageCheckVerdict {
  const seuil = readNumber('IMAGE_CHECK_THRESHOLD', 0.3, 0, 1);
  const seuilPersonne = readNumber('IMAGE_CHECK_PERSON_THRESHOLD', 0.35, 0, 1);
  const marge = readNumber('IMAGE_CHECK_MARGIN', 1.5, 1, 10);

  let meilleurPositif: Score | null = null;
  let categorie: ImageCategorie = 'interieur';
  let meilleurNegatif = 0;
  let personne = 0;

  for (const s of scores) {
    const positif = clipLabels.positifs.find((p) => p.label === s.label);
    if (positif) {
      if (!meilleurPositif || s.score > meilleurPositif.score) {
        meilleurPositif = s;
        categorie = positif.categorie as ImageCategorie;
      }
    }
    if (clipLabels.negatifs.includes(s.label)) {
      meilleurNegatif = Math.max(meilleurNegatif, s.score);
    }
    if (clipLabels.personnes.includes(s.label)) {
      personne = Math.max(personne, s.score);
    }
  }

  if (personne >= seuilPersonne) {
    return { accepte: false, categorie: 'autre', confiance: personne, motif: 'personne_visible' };
  }
  if (!meilleurPositif || meilleurPositif.score < seuil) {
    return {
      accepte: false,
      categorie: 'autre',
      confiance: meilleurPositif?.score ?? 0,
      motif: 'sujet_inconnu',
    };
  }
  if (meilleurPositif.score < meilleurNegatif * marge) {
    return { accepte: false, categorie: 'autre', confiance: meilleurPositif.score, motif: 'sujet_inconnu' };
  }
  return { accepte: true, categorie, confiance: meilleurPositif.score, motif: 'photo_appartement' };
}

function onWorkerMessage(msg: unknown): void {
  if (!msg || typeof msg !== 'object') return;
  const m = msg as { type?: string; id?: number; scores?: Score[]; message?: string };
  if (typeof m.id !== 'number') return;
  const entry = pending.get(m.id);
  if (!entry) return;
  pending.delete(m.id);
  clearTimeout(entry.timer);
  if (m.type === 'scores' || m.type === 'warmed') {
    entry.resolve(m.scores ?? null);
  } else {
    entry.reject(new ImageCheckUnavailableError(m.message || 'erreur du worker CLIP'));
  }
}

function onWorkerExit(child: ChildProcess): void {
  if (worker !== child) return;
  worker = null;
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(new ImageCheckUnavailableError('worker CLIP arrêté'));
  }
  pending.clear();
}

function spawnWorker(): ChildProcess {
  const now = Date.now();
  if (now < brokenUntil) throw new ImageCheckUnavailableError('worker CLIP instable');
  restartTimes = restartTimes.filter((t) => now - t < 60_000);
  if (restartTimes.length >= 3) {
    brokenUntil = now + 60_000;
    throw new ImageCheckUnavailableError('trop de redémarrages du worker CLIP');
  }
  restartTimes.push(now);

  const child = fork(WORKER_PATH, [], {
    env: { ...process.env },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  child.on('message', onWorkerMessage);
  child.on('exit', () => onWorkerExit(child));
  child.on('error', () => onWorkerExit(child));
  worker = child;
  return child;
}

function sendToWorker(child: ChildProcess, payload: Record<string, unknown>, timeoutMs: number): Promise<Score[] | null> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      if (worker === child) {
        worker = null;
        child.kill();
      }
      reject(new ImageCheckUnavailableError('délai dépassé pendant la analyse'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child.send({ ...payload, id }, (err) => {
      if (err && pending.has(id)) {
        pending.delete(id);
        clearTimeout(timer);
        reject(new ImageCheckUnavailableError("envoi au worker CLIP impossible"));
      }
    });
  });
}

function classify(jpegBase64: string): Promise<Score[]> {
  const maxQueue = readNumber('IMAGE_CHECK_MAX_QUEUE', 8, 1, 128);
  if (depth >= maxQueue) return Promise.reject(new ImageCheckQueueFullError());
  depth += 1;
  const timeoutMs = readNumber('IMAGE_CHECK_TIMEOUT_MS', 30_000, 500, 120_000);

  const run = async (): Promise<Score[]> => {
    const child = worker ?? spawnWorker();
    const scores = await sendToWorker(
      child,
      { type: 'classify', jpeg: jpegBase64, labels: ALL_LABELS },
      timeoutMs,
    );
    return scores ?? [];
  };

  const task = serial.then(run, run);
  serial = task.catch(() => undefined);
  return task.finally(() => {
    depth -= 1;
  });
}

const cache = new Map<string, ImageCheckVerdict>();

function cacheGet(key: string): ImageCheckVerdict | undefined {
  const verdict = cache.get(key);
  if (verdict) {
    cache.delete(key);
    cache.set(key, verdict);
  }
  return verdict;
}

function cacheSet(key: string, verdict: ImageCheckVerdict): void {
  cache.set(key, verdict);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function toSmallJpeg(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export async function warmUpImageCheck(): Promise<void> {
  if (readMode() === 'off') return;
  const warmupMs = readNumber('IMAGE_CHECK_WARMUP_TIMEOUT_MS', 120_000, 1_000, 600_000);
  try {
    const child = worker ?? spawnWorker();
    await sendToWorker(child, { type: 'warmup' }, warmupMs);
    console.log('[image-check] modèle CLIP prêt');
  } catch (err) {
    console.warn(
      '[image-check] préchargement impossible :',
      err instanceof Error ? err.message : err,
    );
  }
}

export async function checkApartmentImage(buffer: Buffer): Promise<ImageCheckVerdict> {
  if (readMode() === 'off') {
    return { accepte: true, categorie: 'autre', confiance: 1, motif: 'analyse_desactivee' };
  }

  let small: Buffer;
  try {
    small = await toSmallJpeg(buffer);
  } catch (err) {
    console.error('[image-check] image illisible :', err instanceof Error ? err.message : err);
    if (readMode() === 'lenient') {
      return { accepte: true, categorie: 'autre', confiance: 0, motif: 'analyse_indisponible' };
    }
    throw new ImageCheckUnavailableError('image illisible');
  }

  const key = createHash('sha256').update(small).digest('hex');
  const cached = cacheGet(key);
  if (cached) return cached;

  let scores: Score[];
  try {
    scores = await classify(small.toString('base64'));
  } catch (err) {
    if (err instanceof ImageCheckQueueFullError) throw err;
    console.error('[image-check] analyse impossible :', err instanceof Error ? err.message : err);
    if (readMode() === 'lenient') {
      return { accepte: true, categorie: 'autre', confiance: 0, motif: 'analyse_indisponible' };
    }
    throw err instanceof ImageCheckUnavailableError ? err : new ImageCheckUnavailableError();
  }

  const verdict = decideVerdict(scores);
  cacheSet(key, verdict);
  return verdict;
}

export function resetImageCheckForTests(): void {
  for (const [, entry] of pending) clearTimeout(entry.timer);
  pending.clear();
  if (worker) {
    worker.removeAllListeners();
    worker.kill();
  }
  worker = null;
  depth = 0;
  serial = Promise.resolve();
  nextId = 1;
  restartTimes = [];
  brokenUntil = 0;
  cache.clear();
}
