import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MarketProvider, type MarketCode } from '../contexts/MarketContext';
import CategoriesSection from './CategoriesSection';
import type { Category } from '../data/categories';
import type { Room } from '../data/rooms';
import type { Banner } from '../data/banners';

// BannerCarousel (importé par la section) lit window.matchMedia au chargement
// du module : jsdom ne l'implémente pas, le stub doit passer par vi.hoisted.
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
    fetchCategories: vi.fn<(market: MarketCode) => Promise<Category[]>>(),
    fetchRooms: vi.fn<(market: MarketCode) => Promise<Room[]>>(),
    fetchBanners: vi.fn<(market: MarketCode, section: string) => Promise<Banner[]>>(),
  };
});

vi.mock('../data/categories', () => ({ fetchCategoriesByMarket: mocks.fetchCategories }));
vi.mock('../data/rooms', () => ({ fetchRoomsByMarket: mocks.fetchRooms }));
vi.mock('../data/banners', () => ({ fetchBannersBySection: mocks.fetchBanners }));

const categories: Category[] = [
  { id: 'ci-appartements', title: 'Appartements', img: '/images/appart.jpg', alt: 'Appartement', market: 'CI' },
  { id: 'ci-hotels', title: 'Hôtels', img: '/images/hotel.jpg', alt: 'Hôtel', market: 'CI' },
];

function room(id: string, category: string, market: MarketCode = 'CI'): Room {
  return {
    id,
    title: `Bien ${id}`,
    subtitle: '',
    info: '',
    price: '25 000 FCFA',
    priceNum: 25000,
    priceUnit: 'FCFA / nuit',
    img: '/images/room.jpg',
    alt: 'Bien',
    images: [],
    description: '',
    capacity: '2 personnes',
    category,
    market,
    pays: 'Côte d\'Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '2026-01-01',
    conditions: '',
  };
}

function banner(id: string, section: string, order = 1): Banner {
  return {
    id,
    section: section as Banner['section'],
    img: '/images/banner.jpg',
    alt: `Bannière ${id}`,
    link: '/ci/promos',
    market: 'CI',
    order,
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
        <CategoriesSection />
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
  mocks.fetchCategories.mockResolvedValue(categories);
  mocks.fetchRooms.mockResolvedValue([]);
  mocks.fetchBanners.mockResolvedValue([]);
});

describe('CategoriesSection', () => {
  it('affiche les squelettes pendant le chargement des catégories', async () => {
    let resolveCategories!: (value: Category[]) => void;
    mocks.fetchCategories.mockReturnValue(
      new Promise<Category[]>((resolve) => {
        resolveCategories = resolve;
      }),
    );

    const { container } = renderSection();

    expect(container.querySelector('.categories__grid')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.card-skeleton')).toHaveLength(4);

    resolveCategories(categories);
    await waitFor(() => expect(container.querySelector('.categories__grid')).toHaveAttribute('aria-busy', 'false'));
  });

  it('affiche chaque catégorie avec son titre et son image', async () => {
    renderSection();

    expect(await screen.findByRole('heading', { level: 3, name: 'Appartements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Hôtels' })).toBeInTheDocument();
    expect(screen.getByAltText('Appartement')).toHaveAttribute('src', '/images/appart.jpg');
    expect(screen.getByText('Explorez par type')).toBeInTheDocument();
    expect(screen.getByText('par catégorie')).toBeInTheDocument();
  });

  it('compte les biens de chaque catégorie dans le badge', async () => {
    mocks.fetchRooms.mockResolvedValue([
      room('r1', 'ci-appartements'),
      room('r2', 'ci-appartements'),
      room('r3', 'ci-hotels'),
    ]);

    renderSection();
    await screen.findByRole('heading', { level: 3, name: 'Appartements' });

    const badges = document.querySelectorAll('.cat-card__badge');
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent('2');
    expect(badges[1]).toHaveTextContent('1');
  });

  it("mène vers la page de la catégorie au clic", async () => {
    renderSection();
    await screen.findByRole('heading', { level: 3, name: 'Appartements' });

    const link = document.querySelector<HTMLAnchorElement>('a.cat-card');
    if (!link) throw new Error('lien de catégorie introuvable');
    expect(link).toHaveAttribute('href', '/ci/categorie/ci-appartements');

    await userEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent('/ci/categorie/ci-appartements');
  });

  it('masque la section quand il n’y a ni catégorie ni bannière', async () => {
    mocks.fetchCategories.mockResolvedValue([]);

    const { container } = renderSection();
    await waitFor(() => expect(container.querySelector('.categories')).not.toBeInTheDocument());
    expect(container.querySelector('section')).not.toBeInTheDocument();
  });

  it('masque la section quand le chargement des catégories échoue', async () => {
    mocks.fetchCategories.mockRejectedValue(new Error('Réseau indisponible'));

    const { container } = renderSection();
    await waitFor(() => expect(container.querySelector('.categories')).not.toBeInTheDocument());
  });

  it('affiche la section quand des bannières existent sans catégorie', async () => {
    mocks.fetchCategories.mockResolvedValue([]);
    mocks.fetchBanners.mockResolvedValue([banner('b1', 'categories')]);

    renderSection();

    expect(await screen.findByRole('region', { name: 'Bannières promotionnelles' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Bannière b1/ });
    expect(link).toHaveAttribute('href', '/ci/promos');
  });

  it("affiche des badges à 0 quand le chargement des biens échoue", async () => {
    mocks.fetchRooms.mockRejectedValue(new Error('boom'));

    renderSection();
    await screen.findByRole('heading', { level: 3, name: 'Appartements' });

    const badges = document.querySelectorAll('.cat-card__badge');
    expect(badges[0]).toHaveTextContent('0');
  });

  it('demande les données au marché courant et construit les liens pour ce marché', async () => {
    renderSection('/bj');
    await screen.findByRole('heading', { level: 3, name: 'Appartements' });

    expect(mocks.fetchCategories).toHaveBeenCalledWith('BJ');
    expect(mocks.fetchRooms).toHaveBeenCalledWith('BJ');
    expect(mocks.fetchBanners).toHaveBeenCalledWith('BJ', 'categories');
    expect(document.querySelector<HTMLAnchorElement>('a.cat-card')).toHaveAttribute(
      'href',
      '/bj/categorie/ci-appartements',
    );
  });
});
