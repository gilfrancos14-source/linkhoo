import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MarketProvider, type MarketCode } from '../contexts/MarketContext';
import PopularSection from './PopularSection';
import type { RoomData } from '../lib/api';
import type { Banner } from '../data/banners';

// BannerCarousel importé par la section lit window.matchMedia au chargement du
// module : jsdom ne l'implémente pas, le stub passe par vi.hoisted.
const mocks = vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollTo = (() => {}) as unknown as typeof Element.prototype.scrollTo;
  return {
    getPopular: vi.fn<(market: string) => Promise<RoomData[]>>(),
    fetchBanners: vi.fn<(market: MarketCode, section: string) => Promise<Banner[]>>(),
  };
});

vi.mock('../lib/api', () => ({ apiRooms: { getPopular: mocks.getPopular } }));
vi.mock('../data/banners', () => ({ fetchBannersBySection: mocks.fetchBanners }));

function room(overrides: Partial<RoomData> = {}): RoomData {
  return {
    id: 'room-1',
    title: 'Studio Cocody',
    subtitle: 'Calme et lumineux',
    info: '2 personnes',
    price: '25 000 FCFA',
    price_num: 25000,
    price_unit: 'FCFA / nuit',
    img: '/images/studio.jpg',
    alt: 'Studio de Cocody',
    images: [],
    description: 'Un studio idéal',
    capacity: '2 personnes',
    category: 'ci-appartements',
    market: 'CI',
    pays: 'Côte d\'Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    date_dispo: '2026-01-01',
    conditions: '',
    ...overrides,
  };
}

function banner(): Banner {
  return {
    id: 'b-popular',
    section: 'popular',
    img: '/images/pop.jpg',
    alt: 'Bannière populaire',
    link: '/ci/promos',
    market: 'CI',
    order: 1,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderSection(entry = '/ci') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <PopularSection />
        <LocationProbe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPopular.mockResolvedValue([room()]);
  mocks.fetchBanners.mockResolvedValue([]);
});

describe('PopularSection', () => {
  it('affiche les squelettes pendant le chargement', async () => {
    let resolveRooms!: (value: RoomData[]) => void;
    mocks.getPopular.mockReturnValue(
      new Promise<RoomData[]>((resolve) => {
        resolveRooms = resolve;
      }),
    );

    const { container } = renderSection();

    expect(container.querySelector('.popular__track')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.card-skeleton')).toHaveLength(4);
    expect(screen.getByText('Les plus loués')).toBeInTheDocument();

    resolveRooms([room()]);
    await waitFor(() =>
      expect(container.querySelector('.popular__track')).toHaveAttribute('aria-busy', 'false'),
    );
  });

  it("affiche le titre, le quartier et le prix du bien le plus loué", async () => {
    renderSection();

    expect(await screen.findByRole('heading', { level: 3, name: 'Studio Cocody' })).toBeInTheDocument();
    expect(screen.getByText('Cocody')).toBeInTheDocument();
    expect(screen.getByText('Calme et lumineux')).toBeInTheDocument();
    expect(document.querySelector('.stay-card__price')).toHaveTextContent('25 000');
    expect(screen.getByRole('heading', { level: 2, name: 'Nos biens les plus demandés' })).toBeInTheDocument();
  });

  it("affiche le nombre de chambres sous le titre", async () => {
    renderSection();

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Studio Cocody' }),
    ).toBeInTheDocument();
    const meta = document.querySelector('.stay-card__meta');
    expect(meta).toHaveAttribute('aria-label', 'Caractéristiques');
    expect(meta).toHaveTextContent('1 chambre');
    expect(meta).not.toHaveTextContent('personnes');
  });

  it("n'affiche aucune pastille vide pour un bien sans caractéristique", async () => {
    mocks.getPopular.mockResolvedValue([room({ capacity: '', chambres: 0 })]);

    const { container } = renderSection();

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Studio Cocody' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.stay-card__meta')).not.toBeInTheDocument();
  });

  it("mène vers la page du bien au clic sur la carte", async () => {
    renderSection();
    await screen.findByRole('heading', { level: 3, name: 'Studio Cocody' });

    const link = document.querySelector<HTMLAnchorElement>('a.stay-card__link');
    if (!link) throw new Error('carte de bien introuvable');
    expect(link).toHaveAttribute('href', '/ci/chambre/room-1');

    await userEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent('/ci/chambre/room-1');
  });

  it("marque un bien indisponible d'un badge explicite", async () => {
    mocks.getPopular.mockResolvedValue([room({ disponible: false })]);

    renderSection();
    await screen.findByRole('heading', { level: 3, name: 'Studio Cocody' });

    expect(screen.getByText('Indisponible')).toBeInTheDocument();
  });

  it("n'affiche aucun badge pour un bien disponible", async () => {
    renderSection();
    await screen.findByRole('heading', { level: 3, name: 'Studio Cocody' });

    expect(screen.queryByText('Indisponible')).not.toBeInTheDocument();
  });

  it("masque la section quand l'API des biens échoue", async () => {
    mocks.getPopular.mockRejectedValue(new Error('Réseau indisponible'));

    const { container } = renderSection();
    await waitFor(() => expect(container.querySelector('.popular')).not.toBeInTheDocument());
  });

  it("masque la section quand il n'y a ni bien ni bannière", async () => {
    mocks.getPopular.mockResolvedValue([]);

    const { container } = renderSection();
    await waitFor(() => expect(container.querySelector('.popular')).not.toBeInTheDocument());
  });

  it('garde la section visible avec une bannière malgré zéro bien', async () => {
    mocks.getPopular.mockResolvedValue([]);
    mocks.fetchBanners.mockResolvedValue([banner()]);

    renderSection();

    expect(await screen.findByRole('region', { name: 'Bannières promotionnelles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bannière populaire/ })).toHaveAttribute(
      'href',
      '/ci/promos',
    );
  });

  it('interroge le marché courant et construit les liens pour ce marché', async () => {
    renderSection('/bj');
    await screen.findByRole('heading', { level: 3, name: 'Studio Cocody' });

    expect(mocks.getPopular).toHaveBeenCalledWith('BJ');
    expect(mocks.fetchBanners).toHaveBeenCalledWith('BJ', 'popular');
    expect(document.querySelector<HTMLAnchorElement>('a.stay-card__link')).toHaveAttribute(
      'href',
      '/bj/chambre/room-1',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/bj');
  });
});
