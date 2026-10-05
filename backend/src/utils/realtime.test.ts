import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabaseMock = vi.hoisted(() => ({
  channel: vi.fn(),
}));

vi.mock('../config/supabase', () => ({
  supabaseAdmin: supabaseMock,
}));

interface FakeChannel {
  subscribe: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  callback?: (status: string) => void;
}

function makeFakeChannel(overrides: Partial<FakeChannel> = {}): FakeChannel {
  return {
    subscribe: vi.fn(function (this: FakeChannel, cb?: (status: string) => void) {
      this.callback = cb;
      return this;
    }),
    send: vi.fn(async () => ({ error: null })),
    ...overrides,
  };
}

async function importPublish() {
  const mod = await import('./realtime');
  return mod.publishNotificationChanged;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetModules();
});

describe('publishNotificationChanged', () => {
  it("publie un broadcast sur le canal de l'audience demandée", async () => {
    const fake = makeFakeChannel();
    supabaseMock.channel.mockReturnValue(fake as unknown as RealtimeChannel);

    const publish = await importPublish();
    await publish('admin');

    expect(supabaseMock.channel).toHaveBeenCalledWith('ilehya:notifications:admin');
    expect(fake.subscribe).toHaveBeenCalledTimes(1);
    expect(fake.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'changed',
      payload: {},
    });
  });

  it("réutilise le canal (un seul abonnement) pour les publications suivantes d'un même public", async () => {
    const fake = makeFakeChannel();
    supabaseMock.channel.mockReturnValue(fake as unknown as RealtimeChannel);

    const publish = await importPublish();
    await publish('gerant');
    await publish('gerant');

    expect(supabaseMock.channel).toHaveBeenCalledTimes(1);
    expect(fake.subscribe).toHaveBeenCalledTimes(1);
    expect(fake.send).toHaveBeenCalledTimes(2);
  });

  it('publie sur chaque audience demandée', async () => {
    const fake = makeFakeChannel();
    supabaseMock.channel.mockReturnValue(fake as unknown as RealtimeChannel);

    const publish = await importPublish();
    await publish('admin', 'gerant');

    expect(supabaseMock.channel).toHaveBeenCalledWith('ilehya:notifications:admin');
    expect(supabaseMock.channel).toHaveBeenCalledWith('ilehya:notifications:gerant');
    expect(fake.send).toHaveBeenCalledTimes(2);
  });

  it("ne lève jamais d'erreur quand l'envoi échoue", async () => {
    const fake = makeFakeChannel({
      send: vi.fn(async () => ({ error: new Error('socket fermée') })),
    });
    supabaseMock.channel.mockReturnValue(fake as unknown as RealtimeChannel);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const publish = await importPublish();
    await expect(publish('client')).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("ignore silencieusement un client Supabase sans Realtime (doubles de test sans `channel`)", async () => {
    // `createSupabaseMock()` ne définit pas `channel` : on reproduit le même
    // absent en retirant puis en restaurant la propriété.
    const original = supabaseMock.channel;
    delete (supabaseMock as { channel?: unknown }).channel;

    try {
      const publish = await importPublish();
      await expect(publish('admin', 'client')).resolves.toBeUndefined();
    } finally {
      supabaseMock.channel = original;
    }
  });
});
