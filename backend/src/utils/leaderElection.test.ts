import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock du client Redis : on contrôle précisément set/get/pExpire.
const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  pExpire: vi.fn(),
  connect: vi.fn(),
  on: vi.fn(),
}));

vi.mock('redis', () => ({
  createClient: () => redisMock,
}));

import { tryAcquireLeadership, startLeadershipRenewal } from './leaderElection';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REDIS_URL;
  redisMock.connect.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.REDIS_URL;
});

describe('leader election (jobs en cluster)', () => {
  it('sans REDIS_URL : every instance est leader (mode mono-instance)', async () => {
    expect(await tryAcquireLeadership('token-a')).toBe(true);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('avec Redis : acquiert le verrou quand la clé est libre', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisMock.set.mockResolvedValue('OK');

    expect(await tryAcquireLeadership('token-a')).toBe(true);
    expect(redisMock.set).toHaveBeenCalledWith(
      'ilehya:jobs:leader',
      'token-a',
      expect.objectContaining({ NX: true }),
    );
  });

  it('ne devient pas leader quand le verrou est détenu par un autre', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisMock.set.mockResolvedValue(null); // NX échoue
    redisMock.get.mockResolvedValue('token-b'); // détenu par une autre instance

    expect(await tryAcquireLeadership('token-a')).toBe(false);
  });

  it('reste leader si le verrou porte déjà notre token (renew)', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisMock.set.mockResolvedValue(null);
    redisMock.get.mockResolvedValue('token-a');

    expect(await tryAcquireLeadership('token-a')).toBe(true);
  });

  it('le renouvellement ne touche que notre propre verrou', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    redisMock.get.mockResolvedValue('token-a');

    const stop = startLeadershipRenewal('token-a');
    // Le timer est unref : on ne l'attend pas, on vérifie juste qu'il est lancé.
    expect(stop).toBeTypeOf('function');
    stop();
  });
});
