import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MarketProvider, type MarketCode } from '../contexts/MarketContext';
import PromosSection from './PromosSection';
import type { Room } from '../data/rooms';
import type { Banner } from '../data/banners';

// BannerCarousel (importé par la section) lit window.matchMedia au chargement
// du module, et les panneaux promo appellent scroll/scrollIntoView : jsdom ne
// fournit rien de tout cela, les stubs passent par vi.hoisted.
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
  Element.prototype.scrollBy = (() => {}) as unknown as typeof Element.prototype.scrollBy;
  Element.prototype.scrollIntoView = (() => {}) as unknown as typeof Element.prototype.scrollIntoView;
  return {
    fetchRooms: vi.fn<(market: MarketCode) => Promise<Room[]>>(),
    fetchBanners: vi.fn<(market: MarketCode, section: string) => Promise<Banner[]>>(),
  };
});

vi.mock('../data/rooms', () => ({ fetchRoomsByMarket: mocks.fetchRooms }));
vi.mock('../data/banners', () => ({ fetchBannersBySection: mocks.fetchBanners }));

function room(overrides: Partial<Room> & { id: string }): Room {
  return {
    title: 'Appartement spacieux',
    subtitle: '',
    info: 'Salon séparé',
    price: '50 000 FCFA',
    priceNum: 50000,
    priceUnit: 'FCFA / nuit',
    img: '/images/promo.jpg',
    alt: 'Appartement en promotion',
    images: [],
    description: '',
    capacity: '4 personnes',
    category: 'ci-appartements',
    market: 'CI',
    pays: 'Côte d\'Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 2,
    douches: 1,
    disponible: true,
    dateDispo: '2026-01-01',
    conditions: '',
    promoGroup: 'promo_15',
    promoStart: null,
    promoEnd: null,
    ...overrides,
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
        <PromosSection />
        <LocationProbe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function promoCards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.promo-card'));
}

function detailPanel(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('#promo-detail');
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchRooms.mockResolvedValue([]);
  mocks.fetchBanners.mockResolvedValue([]);
});

describe('PromosSection', () => {
  it('affiche les squelettes pendant le chargement des biens', async () => {
    let resolveRooms!: (value: Room[]) => void;
    mocks.fetchRooms.mockReturnValue(
      new Promise<Room[]>((resolve) => {
        resolveRooms = resolve;
      }),
    );

    const { container } = renderSection();

    expect(container.querySelector('.promos__grid')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.card-skeleton')).toHaveLength(3);
    expect(screen.getByText('Offres promotionnelles')).toBeInTheDocument();

    resolveRooms([]);
    await waitFor(() =>
      expect(container.querySelector('.promos__grid')).toHaveAttribute('aria-busy', 'false'),
    );
  });

  it("affiche les trois cartes de promotion avec leurs remises", async () => {
    const { container } = renderSection();

    await waitFor(() => expect(promoCards(container)).toHaveLength(3));
    expect(screen.getByText('-15 %')).toBeInTheDocument();
    expect(screen.getByText('-10 %')).toBeInTheDocument();
    expect(screen.getByText('-5 %')).toBeInTheDocument();
  });

  it("ouvre le détail de la promotion au clic sur sa carte", async () => {
    const { container } = renderSection();
    await waitFor(() => expect(promoCards(container)).toHaveLength(3));

    await userEvent.click(promoCards(container)[0]);

    const panel = detailPanel(container);
    expect(panel).toHaveClass('is-open');
    expect(panel).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('heading', { level: 3, name: 'Nos offres promotionnelles à -15 %' })).toBeInTheDocument();
    expect(screen.getByText(/Profitez de 15 % de réduction/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });

  it("referme le détail quand on reclique sur la carte active", async () => {
    const { container } = renderSection();
    await waitFor(() => expect(promoCards(container)).toHaveLength(3));

    await userEvent.click(promoCards(container)[2]);
    expect(detailPanel(container)).toHaveAttribute('aria-hidden', 'false');

    await userEvent.click(promoCards(container)[2]);
    expect(detailPanel(container)).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument();
  });

  it("referme le détail avec le bouton Fermer", async () => {
    const { container } = renderSection();
    await waitFor(() => expect(promoCards(container)).toHaveLength(3));

    await userEvent.click(promoCards(container)[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(detailPanel(container)).toHaveAttribute('aria-hidden', 'true');
    expect(detailPanel(container)).not.toHaveClass('is-open');
  });

  it("ouvre le détail au clavier avec la touche Entrée", async () => {
    const { container } = renderSection();
    await waitFor(() => expect(promoCards(container)).toHaveLength(3));

    promoCards(container)[0].focus();
    await userEvent.keyboard('{Enter}');

    expect(detailPanel(container)).toHaveAttribute('aria-hidden', 'false');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Nos offres promotionnelles à -15 %' }),
    ).toBeInTheDocument();
  });

  it('liste les biens concernés par la promotion active', async () => {
    mocks.fetchRooms.mockResolvedValue([
      room({ id: 'r15', promoGroup: 'promo_15' }),
      room({ id: 'r15b', promoGroup: 'promo_15', title: 'Deuxième bien' }),
    ]);

    const { container } = renderSection();
    await waitFor(() => expect(promoCards(container)).toHaveLength(3));

    await userEvent.click(promoCards(container)[0]);

    const offers = container.querySelectorAll('a.promo-room');
    expect(offers).toHaveLength(2);
    expect(offers[0]).toHaveAttribute('href', '/ci/chambre/r15');
    expect(offers[1]).toHaveAttribute('href', '/ci/chambre/r15b');
    expect(container.querySelector('.promo-room__price')).toHaveTextContent('50000 FCFA');
    expect(screen.getAllByText('Salon séparé')).toHaveLength(2);
  });

  it("affiche un état vide quand aucun bien n'est en promotion", async () => {
    const { container } = renderSection();
    await waitFor(() => expect(promoCards(container)).toHaveLength(3));

    await userEvent.click(promoCards(container)[0]);

    expect(screen.getByText("Pas d'offre disponible pour le moment")).toBeInTheDocument();
    expect(
      screen.getByText('Revenez bientôt pour découvrir nos prochaines promotions.'),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('a.promo-room')).toHaveLength(0);
  });

  it('ignore les promotions dont la période est déjà passée', async () => {
    mocks.fetchRooms.mockResolvedValue([
      room({ id: 'expired', promoGroup: 'promo_15', promoEnd: '2000-01-01' }),
      room({ id: 'future', promoGroup: 'promo_15', promoStart: '2099-01-01' }),
    ]);

    const { container } = renderSection();
    await waitFor(() => expect(promoCards(container)).toHaveLength(3));

    await userEvent.click(promoCards(container)[0]);

    expect(container.querySelectorAll('a.promo-room')).toHaveLength(0);
    expect(screen.getByText("Pas d'offre disponible pour le moment")).toBeInTheDocument();
  });

  it('n’affiche pas les biens des autres groupes de promotion', async () => {
    mocks.fetchRooms.mockResolvedValue([room({ id: 'r10', promoGroup: 'promo_10' })]);

    const { container } = renderSection();
    await waitFor(() => expect(promoCards(container)).toHaveLength(3));

    await userEvent.click(promoCards(container)[0]);
    expect(container.querySelectorAll('a.promo-room')).toHaveLength(0);

    await userEvent.click(promoCards(container)[1]);
    expect(container.querySelectorAll('a.promo-room')).toHaveLength(1);
    expect(container.querySelector('a.promo-room')).toHaveAttribute('href', '/ci/chambre/r10');
  });

  it("affiche les flèches de navigation avec la précédente désactivée", async () => {
    mocks.fetchRooms.mockResolvedValue([
      room({ id: 'a', promoGroup: 'promo_10' }),
      room({ id: 'b', promoGroup: 'promo_10' }),
    ]);

    const { container } = renderSection();
    await waitFor(() => expect(promoCards(container)).toHaveLength(3));

    await userEvent.click(promoCards(container)[1]);

    const prev = screen.getByRole('button', { name: 'Précédent' });
    expect(prev).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument();
    expect(container.querySelectorAll('.promo-carousel__dot')).toHaveLength(2);
  });

  it('affiche les bannières de la section promos', async () => {
    mocks.fetchBanners.mockResolvedValue([
      {
        id: 'bp',
        section: 'promos',
        img: '/images/bp.jpg',
        alt: 'Bannière promos',
        link: '/ci/hotels',
        market: 'CI',
        order: 1,
      },
    ]);

    renderSection();

    expect(await screen.findByRole('region', { name: 'Bannières promotionnelles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bannière promos' })).toHaveAttribute(
      'href',
      '/ci/hotels',
    );
  });

  it('interroge les données du marché courant', async () => {
    renderSection('/bj');
    await waitFor(() => expect(mocks.fetchRooms).toHaveBeenCalledWith('BJ'));

    expect(mocks.fetchBanners).toHaveBeenCalledWith('BJ', 'promos');
    expect(screen.getByTestId('location')).toHaveTextContent('/bj');
  });
});
