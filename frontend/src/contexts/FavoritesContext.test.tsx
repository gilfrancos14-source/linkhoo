import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FavoritesProvider, useFavorites } from './FavoritesContext';
import type { FavoriteRoomData } from '../lib/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  auth: {
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn(async () => 'token'),
  },
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../lib/api', () => ({
  apiFavorites: {
    list: mocks.list,
    add: mocks.add,
    remove: mocks.remove,
  },
}));

function favoriteRoom(id: string): FavoriteRoomData {
  return {
    id,
    title: `Chambre ${id}`,
    favorited_at: '2026-01-01T00:00:00.000Z',
  } as unknown as FavoriteRoomData;
}

function Probe() {
  const { ids, rooms, loading, isFavorite, toggle, remove } = useFavorites();
  return (
    <div>
      <span data-testid="ids">{[...ids].join(',')}</span>
      <span data-testid="rooms">{rooms.map((room) => room.id).join(',')}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="is-favorite">{String(isFavorite('room-1'))}</span>
      <button type="button" onClick={() => void toggle('room-1').catch(() => {})}>
        toggle
      </button>
      <button type="button" onClick={() => void remove('room-1').catch(() => {})}>
        remove
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <FavoritesProvider>
      <Probe />
    </FavoritesProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = {
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn(async () => 'token'),
  };
  mocks.list.mockResolvedValue([]);
  mocks.add.mockResolvedValue({
    room_id: 'room-1',
    favorite: true,
    room: favoriteRoom('room-1'),
  });
  mocks.remove.mockResolvedValue({ room_id: 'room-1', favorite: false });
});

afterEach(() => {
  cleanup();
});

describe('FavoritesProvider', () => {
  it('charge les favoris du client connecté', async () => {
    mocks.list.mockResolvedValue([favoriteRoom('room-1'), favoriteRoom('room-2')]);

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('ids').textContent).toBe('room-1,room-2');
    });
    expect(screen.getByTestId('rooms').textContent).toBe('room-1,room-2');
    expect(screen.getByTestId('is-favorite').textContent).toBe('true');
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });

  it('ne charge rien quand le visiteur n’est pas connecté', async () => {
    mocks.auth.isSignedIn = false;

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(mocks.list).not.toHaveBeenCalled();
    expect(screen.getByTestId('ids').textContent).toBe('');
  });

  it('ajoute un favori immédiatement puis confirme via l’API', async () => {
    renderProbe();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    // Mise à jour optimiste : le cœur réagit sans attendre le réseau.
    expect(screen.getByTestId('ids').textContent).toBe('room-1');

    await waitFor(() => {
      expect(mocks.add).toHaveBeenCalledWith('room-1');
    });
    await waitFor(() => {
      expect(screen.getByTestId('rooms').textContent).toBe('room-1');
    });
  });

  it('retire un favori existant', async () => {
    mocks.list.mockResolvedValue([favoriteRoom('room-1')]);
    renderProbe();
    await waitFor(() => {
      expect(screen.getByTestId('ids').textContent).toBe('room-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByTestId('ids').textContent).toBe('');
    await waitFor(() => {
      expect(mocks.remove).toHaveBeenCalledWith('room-1');
    });
    expect(screen.getByTestId('rooms').textContent).toBe('');
  });

  it('annule l’ajout optimiste si l’API échoue', async () => {
    mocks.add.mockRejectedValue(new Error('réseau'));
    renderProbe();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByTestId('ids').textContent).toBe('room-1');
    await waitFor(() => {
      expect(screen.getByTestId('ids').textContent).toBe('');
    });
    expect(screen.getByTestId('rooms').textContent).toBe('');
  });

  it('supprime directement la chambre avec remove()', async () => {
    mocks.list.mockResolvedValue([favoriteRoom('room-1')]);
    renderProbe();
    await waitFor(() => {
      expect(screen.getByTestId('ids').textContent).toBe('room-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    expect(screen.getByTestId('ids').textContent).toBe('');
    await waitFor(() => {
      expect(mocks.remove).toHaveBeenCalledWith('room-1');
    });
  });
});
