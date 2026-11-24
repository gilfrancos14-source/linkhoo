import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/config';

const api = vi.hoisted(() => ({
  banners: vi.fn(async () => []),
  popular: vi.fn(async () => []),
  rooms: vi.fn(async () => []),
  categories: vi.fn(async () => []),
  events: vi.fn(async () => []),
  tourism: vi.fn(async () => ({ big: [], small: [] })),
  escapades: vi.fn(async () => []),
  reviews: vi.fn(async () => []),
}));

vi.mock('./maquetteApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./maquetteApi')>();
  return { ...actual, maquetteApi: api };
});

import { useMaquetteData } from './useMaquetteData';

describe('useMaquetteData', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('fr');
  });

  it('recharge les données de la base quand la langue change', async () => {
    const { unmount } = renderHook(() => useMaquetteData('CI'));

    await waitFor(() => expect(api.banners).toHaveBeenCalledTimes(1));
    expect(api.categories).toHaveBeenCalledTimes(1);
    expect(api.reviews).toHaveBeenCalledTimes(1);

    await act(async () => {
      await i18n.changeLanguage('en');
    });

    await waitFor(() => expect(api.banners).toHaveBeenCalledTimes(2));
    expect(api.categories).toHaveBeenCalledTimes(2);
    expect(api.reviews).toHaveBeenCalledTimes(2);

    unmount();
    await i18n.changeLanguage('fr');
  });
});
