import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingLocalRooms from './LandingLocalRooms';

const mocks = vi.hoisted(() => ({
  localRooms: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiDiscover: { localRooms: mocks.localRooms },
}));

function renderSection() {
  return render(
    <MemoryRouter>
      <LandingLocalRooms />
    </MemoryRouter>,
  );
}

describe('LandingLocalRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.localRooms.mockResolvedValue({ market: null, rooms: [] });
  });

  afterEach(() => cleanup());

  it('ne rend rien si le visiteur est sans pays ou sans logement', async () => {
    const { container } = renderSection();
    await waitFor(() => expect(mocks.localRooms).toHaveBeenCalled());

    expect(container.querySelector('.acc-local')).toBeNull();
  });

  it('affiche les logements du marché détecté', async () => {
    mocks.localRooms.mockResolvedValue({
      market: 'CI',
      rooms: [
        {
          id: 'room-1',
          title: 'Studio Cocody',
          img: '/images/room.jpg',
          alt: 'Studio',
          ville: 'Abidjan',
          quartier: 'Cocody',
          price: '25000',
        },
      ],
    });

    renderSection();

    expect(await screen.findByRole('heading', { name: /près de chez vous/i })).toBeInTheDocument();
    expect(screen.getByText('Studio Cocody')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Studio Cocody/ })).toHaveAttribute(
      'href',
      '/ci/chambre/room-1',
    );
    expect(screen.getByRole('link', { name: /Voir tous les logements/ })).toHaveAttribute(
      'href',
      '/ci',
    );
  });
});
