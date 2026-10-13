import { EventEmitter } from 'events';
import { fork } from 'child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkApartmentImage,
  decideVerdict,
  ImageCheckQueueFullError,
  ImageCheckUnavailableError,
  isImageCheckEnabled,
  resetImageCheckForTests,
  warmUpImageCheck,
} from './apartmentImageCheck';

vi.mock('child_process', () => ({ fork: vi.fn() }));

vi.mock('sharp', () => ({
  default: vi.fn(() => {
    const pipeline = {
      resize: vi.fn(() => pipeline),
      jpeg: vi.fn(() => pipeline),
      toBuffer: vi.fn(async () => Buffer.from('petit-jpeg')),
    };
    return pipeline;
  }),
}));

interface Score {
  label: string;
  score: number;
}

type Behavior =
  | { kind: 'scores'; scores: Score[] }
  | { kind: 'error'; message: string }
  | { kind: 'hang' };

let behavior: Behavior = { kind: 'scores', scores: [] };

class FakeChild extends EventEmitter {
  sent: Array<Record<string, unknown>> = [];
  killed = false;

  send(msg: Record<string, unknown>, cb?: (err: Error | null) => void): boolean {
    this.sent.push(msg);
    queueMicrotask(() => {
      void respondTo(this, msg);
    });
    cb?.(null);
    return true;
  }

  kill(): boolean {
    this.killed = true;
    this.emit('exit', 1, 'SIGKILL');
    return true;
  }
}

async function respondTo(child: FakeChild, msg: Record<string, unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  if (child.killed) return;
  if (msg.type === 'warmup') {
    child.emit('message', { type: 'warmed', id: msg.id });
    return;
  }
  if (behavior.kind === 'hang') return;
  if (behavior.kind === 'error') {
    child.emit('message', { type: 'scores-error', id: msg.id, message: behavior.message });
    return;
  }
  child.emit('message', { type: 'scores', id: msg.id, scores: behavior.scores });
}

const INTERIOR = 'the interior of an apartment';
const BEDROOM = 'a bedroom with a bed';
const FACADE = 'the facade of an apartment building';
const PERSON = 'a photo of a person';
const LANDSCAPE = 'a landscape with mountains and sky';

const ENV_KEYS = [
  'IMAGE_CHECK_MODE',
  'IMAGE_CHECK_THRESHOLD',
  'IMAGE_CHECK_PERSON_THRESHOLD',
  'IMAGE_CHECK_MARGIN',
  'IMAGE_CHECK_MAX_QUEUE',
  'IMAGE_CHECK_TIMEOUT_MS',
];

let savedEnv: Record<string, string | undefined> = {};
let child: FakeChild;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  resetImageCheckForTests();
  child = new FakeChild();
  vi.mocked(fork).mockReset();
  vi.mocked(fork).mockImplementation(() => child as never);
  behavior = { kind: 'scores', scores: [] };
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  resetImageCheckForTests();
});

describe('decideVerdict', () => {
  it('accepte une photo d’intérieur', () => {
    const verdict = decideVerdict([
      { label: INTERIOR, score: 0.55 },
      { label: BEDROOM, score: 0.3 },
      { label: LANDSCAPE, score: 0.1 },
      { label: PERSON, score: 0.05 },
    ]);
    expect(verdict.accepte).toBe(true);
    expect(verdict.categorie).toBe('interieur');
  });

  it('accepte une façade d’immeuble', () => {
    const verdict = decideVerdict([
      { label: FACADE, score: 0.52 },
      { label: INTERIOR, score: 0.2 },
      { label: PERSON, score: 0.08 },
    ]);
    expect(verdict.accepte).toBe(true);
    expect(verdict.categorie).toBe('facade');
  });

  it('refuse une image avec une personne visible', () => {
    const verdict = decideVerdict([
      { label: INTERIOR, score: 0.5 },
      { label: PERSON, score: 0.4 },
    ]);
    expect(verdict.accepte).toBe(false);
    expect(verdict.motif).toBe('personne_visible');
  });

  it('refuse un sujet inconnu sous le seuil', () => {
    const verdict = decideVerdict([
      { label: INTERIOR, score: 0.22 },
      { label: LANDSCAPE, score: 0.2 },
      { label: PERSON, score: 0.1 },
    ]);
    expect(verdict.accepte).toBe(false);
    expect(verdict.motif).toBe('sujet_inconnu');
  });

  it('refuse quand un négatif domine par la marge', () => {
    const verdict = decideVerdict([
      { label: INTERIOR, score: 0.5 },
      { label: LANDSCAPE, score: 0.4 },
      { label: PERSON, score: 0.1 },
    ]);
    expect(verdict.accepte).toBe(false);
    expect(verdict.motif).toBe('sujet_inconnu');
  });

  it('refuse un tableau de scores vide', () => {
    expect(decideVerdict([]).accepte).toBe(false);
  });
});

describe('isImageCheckEnabled', () => {
  it('off désactive le contrôle', () => {
    process.env.IMAGE_CHECK_MODE = 'off';
    expect(isImageCheckEnabled()).toBe(false);
  });

  it('strict active le contrôle', () => {
    process.env.IMAGE_CHECK_MODE = 'strict';
    expect(isImageCheckEnabled()).toBe(true);
  });
});

describe('checkApartmentImage', () => {
  it('mode off : accepte sans forker le worker', async () => {
    process.env.IMAGE_CHECK_MODE = 'off';
    const verdict = await checkApartmentImage(Buffer.from('image'));
    expect(verdict.accepte).toBe(true);
    expect(fork).not.toHaveBeenCalled();
  });

  it('accepte une photo d’appartement et la met en cache', async () => {
    behavior = {
      kind: 'scores',
      scores: [
        { label: INTERIOR, score: 0.6 },
        { label: PERSON, score: 0.05 },
        { label: LANDSCAPE, score: 0.1 },
      ],
    };

    const first = await checkApartmentImage(Buffer.from('image'));
    expect(first.accepte).toBe(true);
    expect(first.categorie).toBe('interieur');

    const second = await checkApartmentImage(Buffer.from('image'));
    expect(second.accepte).toBe(true);
    expect(child.sent.filter((m) => m.type === 'classify')).toHaveLength(1);
  });

  it('lenient : une erreur du worker laisse passer l’image', async () => {
    process.env.IMAGE_CHECK_MODE = 'lenient';
    behavior = { kind: 'error', message: 'onnx KO' };

    const verdict = await checkApartmentImage(Buffer.from('image'));
    expect(verdict.accepte).toBe(true);
    expect(verdict.motif).toBe('analyse_indisponible');
  });

  it('strict : une erreur du worker lève une indisponibilité', async () => {
    process.env.IMAGE_CHECK_MODE = 'strict';
    behavior = { kind: 'error', message: 'onnx KO' };

    await expect(checkApartmentImage(Buffer.from('image'))).rejects.toBeInstanceOf(
      ImageCheckUnavailableError,
    );
  });

  it('refuse la file pleine au-delà de IMAGE_CHECK_MAX_QUEUE', async () => {
    process.env.IMAGE_CHECK_MODE = 'strict';
    process.env.IMAGE_CHECK_MAX_QUEUE = '1';
    behavior = { kind: 'hang' };

    const first = checkApartmentImage(Buffer.from('image'));
    await expect(checkApartmentImage(Buffer.from('image'))).rejects.toBeInstanceOf(
      ImageCheckQueueFullError,
    );

    behavior = { kind: 'error', message: 'abandon' };
    await expect(first).rejects.toBeInstanceOf(ImageCheckUnavailableError);
  });

  it('tue le worker bloqué au-delà du délai', async () => {
    process.env.IMAGE_CHECK_MODE = 'strict';
    process.env.IMAGE_CHECK_TIMEOUT_MS = '500';
    behavior = { kind: 'hang' };

    await expect(checkApartmentImage(Buffer.from('image'))).rejects.toBeInstanceOf(
      ImageCheckUnavailableError,
    );
    expect(child.killed).toBe(true);
  });
});

describe('warmUpImageCheck', () => {
  it('préchauffe le modèle via le worker', async () => {
    await warmUpImageCheck();
    expect(child.sent).toContainEqual(expect.objectContaining({ type: 'warmup' }));
  });

  it('ne lève pas d’erreur si le préchargement échoue', async () => {
    behavior = { kind: 'error', message: 'réseau coupé' };
    await expect(warmUpImageCheck()).resolves.toBeUndefined();
  });
});
