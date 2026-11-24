import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingLocalRooms from './LandingLocalRooms';

const mocks = vi.hoisted(() => ({
  localRooms: vi.fn(),
  neighborRooms: vi.fn(),
  weekendRooms: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiDiscover: {
    localRooms: mocks.localRooms,
    neighborRooms: mocks.neighborRooms,
    weekendRooms: mocks.weekendRooms,
  },
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
    mocks.neighborRooms.mockResolvedValue({ market: null, rooms: [] });
    mocks.weekendRooms.mockResolvedValue({ market: null, rooms: [] });
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

    expect(
      await screen.findByRole('heading', { name: /Logements disponibles/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Appartement · Abidjan$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Appartement · Abidjan/ })).toHaveAttribute(
      'href',
      '/ci/chambre/room-1',
    );
    expect(screen.getByRole('link', { name: /Voir tous les logements/ })).toHaveAttribute(
      'href',
      '/ci',
    );
  });
});

describe('LandingLocalRooms — pays voisin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.localRooms.mockResolvedValue({ market: null, rooms: [] });
    mocks.neighborRooms.mockResolvedValue({
      market: 'TG',
      rooms: [
        {
          id: 'room-tg',
          title: 'Studio Lomé',
          img: '/images/room.jpg',
          alt: 'Studio',
          ville: 'Lomé',
          quartier: 'Centre',
          price: '15000',
        },
      ],
    });
  });

  afterEach(() => cleanup());

  it('affiche les logements du pays voisin', async () => {
    render(
      <MemoryRouter>
        <LandingLocalRooms variant="neighbor" />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/^Appartement · Lomé$/)).toBeInTheDocument();
    expect(mocks.neighborRooms).toHaveBeenCalled();
    expect(mocks.localRooms).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /Voir les logements au/ })).toHaveAttribute(
      'href',
      '/tg',
    );
  });
});

describe('LandingLocalRooms — week-end', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.localRooms.mockResolvedValue({ market: null, rooms: [] });
    mocks.neighborRooms.mockResolvedValue({ market: null, rooms: [] });
    mocks.weekendRooms.mockResolvedValue({
      market: 'BF',
      rooms: [
        {
          id: 'room-bf',
          title: 'Studio Ouaga',
          img: '/images/room.jpg',
          alt: 'Studio',
          ville: 'Ouagadougou',
          quartier: 'Centre',
          price: '12000',
        },
      ],
    });
  });

  afterEach(() => cleanup());

  it('affiche les logements disponibles le week-end dans le 2ᵉ marché', async () => {
    render(
      <MemoryRouter>
        <LandingLocalRooms variant="weekend" />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: /Disponibles ce week-end/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Appartement · Ouagadougou$/)).toBeInTheDocument();
    expect(mocks.weekendRooms).toHaveBeenCalled();
    expect(mocks.neighborRooms).not.toHaveBeenCalled();
  });
});
