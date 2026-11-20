import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock du client Redis : on contrôle précisément set/get/pExpire/isOpen.
const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  pExpire: vi.fn(),
  connect: vi.fn(),
  on: vi.fn(),
  isOpen: false,
}));

vi.mock('redis', () => ({
  createClient: () => redisMock,
}));

import {
  tryAcquireLeadership,
  renewLeadership,
  startLeaderElection,
} from './leaderElection';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REDIS_URL;
  delete process.env.CLUSTER_MODE;
  redisMock.isOpen = false;
  redisMock.connect.mockImplementation(async () => {
    redisMock.isOpen = true;
  });
});

afterEach(() => {
  delete process.env.REDIS_URL;
  delete process.env.CLUSTER_MODE;
});

describe('leader election (jobs en cluster)', () => {
  it('sans REDIS_URL : chaque instance est leader (mode mono-instance)', async () => {
    expect(await tryAcquireLeadership('token-a')).toBe(true);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('mode cluster, Redis down : on NE devient PAS leader', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.CLUSTER_MODE = 'true';
    redisMock.connect.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await tryAcquireLeadership('token-a')).toBe(false);
  });

  it('mode mono, Redis down : repli leader (comportement historique)', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisMock.connect.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await tryAcquireLeadership('token-a')).toBe(true);
  });

  it('acquiert le verrou quand la clé est libre', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisMock.set.mockResolvedValue('OK');

    expect(await tryAcquireLeadership('token-a')).toBe(true);
    expect(redisMock.set).toHaveBeenCalledWith(
      'ilehya:jobs:leader',
      'token-a',
      expect.objectContaining({ NX: true }),
    );
  });

  it('ne devient pas leader quand le verrou appartient à un autre', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisMock.set.mockResolvedValue(null);
    redisMock.get.mockResolvedValue('token-b');

    expect(await tryAcquireLeadership('token-a')).toBe(false);
  });

  it('renew : vrai seulement si on possède encore le verrou', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisMock.isOpen = true;

    redisMock.get.mockResolvedValue('token-a');
    expect(await renewLeadership('token-a')).toBe(true);
    expect(redisMock.pExpire).toHaveBeenCalled();

    redisMock.get.mockResolvedValue('token-b');
    expect(await renewLeadership('token-a')).toBe(false);
  });

  it('startLeaderElection notifie les changements de rôle', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisMock.set.mockResolvedValue('OK');

    const hooks = {
      onBecomeLeader: vi.fn(),
      onLoseLeadership: vi.fn(),
    };
    const stop = startLeaderElection('token-a', hooks);

    // tick() est lancé immédiatement (async) : on attend un micro-task.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(hooks.onBecomeLeader).toHaveBeenCalled();

    stop();
  });
});
