import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MarketProvider, type MarketCode } from '../contexts/MarketContext';
import EventsSection from './EventsSection';
import { formatEventDate, type Event } from '../data/events';
import type { Room } from '../data/rooms';
import type { Banner } from '../data/banners';

// BannerCarousel (importé par la section) lit window.matchMedia au chargement
// du module, et les panneaux d'événements appellent scroll/scrollIntoView :
// jsdom ne fournit rien de tout cela, les stubs passent par vi.hoisted.
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
    fetchEvents: vi.fn<(market: MarketCode) => Promise<Event[]>>(),
    fetchBanners: vi.fn<(market: MarketCode, section: string) => Promise<Banner[]>>(),
    fetchRooms: vi.fn<(market: string, arrivee: string, depart: string, ville?: string) => Promise<Room[]>>(),
  };
});

vi.mock('../data/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/events')>();
  return { ...actual, fetchEventsByMarket: mocks.fetchEvents };
});
vi.mock('../data/banners', () => ({ fetchBannersBySection: mocks.fetchBanners }));
vi.mock('../data/rooms', () => ({ fetchAvailableRooms: mocks.fetchRooms }));

function event(overrides: Partial<Event> & { id: string }): Event {
  return {
    market: 'CI',
    city: 'Abidjan',
    title: 'Festival des arts',
    description: 'Trois jours de concerts en plein air.',
    eventDate: '2099-01-15',
    img: '/images/event.jpg',
    alt: 'Affiche du festival',
    ...overrides,
  };
}

const twoAbidjanEvents: Event[] = [
  event({ id: 'e1' }),
  event({ id: 'e2', title: 'Salon du livre', description: 'Rencontres avec des auteurs.', eventDate: '2099-01-20' }),
  event({ id: 'e3', city: 'Bouaké', title: 'Carnaval', description: 'Défilé traditionnel.', eventDate: '2099-02-01' }),
];

function room(overrides: Partial<Room> & { id: string }): Room {
  return {
    title: 'Appartement proche',
    subtitle: 'Idéal pour la soirée',
    info: '2 personnes',
    price: '30 000 FCFA',
    priceNum: 30000,
    priceUnit: 'FCFA / nuit',
    img: '/images/room.jpg',
    alt: 'Appartement proche',
    images: [],
    description: '',
    capacity: '2 personnes',
    category: 'ci-appartements',
    market: 'CI',
    pays: 'Côte d\'Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '2099-01-01',
    conditions: '',
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderSection(entry = '/ci') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <EventsSection />
        <LocationProbe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function cityCards(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.event-card'));
}

function detailPanel(container: ParentNode): HTMLElement | null {
  return container.querySelector<HTMLElement>('#event-detail');
}

async function openCity(container: ParentNode, city: string) {
  await waitFor(() => expect(cityCards(container).length).toBeGreaterThan(0));
  const card = cityCards(container).find(
    (c) => c.getAttribute('aria-label')?.startsWith(city),
  );
  if (!card) throw new Error(`carte de ville introuvable : ${city}`);
  await userEvent.click(card);
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchEvents.mockResolvedValue(twoAbidjanEvents);
  mocks.fetchBanners.mockResolvedValue([]);
  mocks.fetchRooms.mockResolvedValue([]);
});

describe('EventsSection', () => {
  it('affiche les squelettes pendant le chargement des événements', async () => {
    let resolveEvents!: (value: Event[]) => void;
    mocks.fetchEvents.mockReturnValue(
      new Promise<Event[]>((resolve) => {
        resolveEvents = resolve;
      }),
    );

    const { container } = renderSection();

    expect(container.querySelector('.events__grid')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.card-skeleton')).toHaveLength(3);
    expect(screen.getByText('Événements')).toBeInTheDocument();

    resolveEvents(twoAbidjanEvents);
    await waitFor(() =>
      expect(container.querySelector('.events__grid')).toHaveAttribute('aria-busy', 'false'),
    );
  });

  it('affiche une carte par ville avec le nombre d’événements', async () => {
    const { container } = renderSection();

    await waitFor(() => expect(cityCards(container)).toHaveLength(2));
    const labels = cityCards(container).map((c) => c.getAttribute('aria-label'));
    expect(labels).toContain('Abidjan — 2 événements');
    expect(labels).toContain('Bouaké — 1 événement');
    expect(screen.getByRole('heading', { level: 3, name: 'Abidjan' })).toBeInTheDocument();
  });

  it("ouvre le détail de la ville au clic et affiche le premier événement", async () => {
    const { container } = renderSection();
    await openCity(container, 'Abidjan');

    const panel = detailPanel(container);
    expect(panel).toHaveClass('is-open');
    expect(panel).toHaveAttribute('aria-hidden', 'false');
    expect(panel?.querySelector('.event-detail__city')).toHaveTextContent('Abidjan');
    expect(screen.getByText('2 événements')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Festival des arts' })).toBeInTheDocument();
    expect(
      screen.getByText('Trois jours de concerts en plein air.'),
    ).toBeInTheDocument();
    expect(screen.getByText(formatEventDate('2099-01-15'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Abidjan — 2 événements' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it("referme le détail avec le bouton Fermer", async () => {
    const { container } = renderSection();
    await openCity(container, 'Abidjan');

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(detailPanel(container)).toHaveAttribute('aria-hidden', 'true');
    expect(detailPanel(container)).not.toHaveClass('is-open');
    expect(
      screen.getByRole('button', { name: 'Abidjan — 2 événements' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument();
  });

  it("referme le détail en recliquant sur la même ville", async () => {
    const { container } = renderSection();
    await openCity(container, 'Abidjan');
    expect(detailPanel(container)).toHaveAttribute('aria-hidden', 'false');

    await userEvent.click(cityCards(container)[0]);

    expect(detailPanel(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it("ouvre le détail au clavier avec Entrée puis referme avec Espace", async () => {
    const { container } = renderSection();
    await waitFor(() => expect(cityCards(container)).toHaveLength(2));

    cityCards(container)[0].focus();
    await userEvent.keyboard('{Enter}');
    expect(detailPanel(container)).toHaveAttribute('aria-hidden', 'false');

    cityCards(container)[0].focus();
    await userEvent.keyboard(' ');
    expect(detailPanel(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('parcours les événements de la ville avec les flèches et les puces', async () => {
    const { container } = renderSection();
    await openCity(container, 'Abidjan');

    const prev = screen.getByRole('button', { name: 'Événement précédent' });
    const next = screen.getByRole('button', { name: 'Événement suivant' });
    expect(prev).toBeDisabled();
    expect(screen.getByRole('tablist', { name: 'Liste des événements' })).toBeInTheDocument();

    await userEvent.click(next);
    expect(screen.getByRole('heading', { level: 4, name: 'Salon du livre' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Salon du livre/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(next).toBeDisabled();
    expect(prev).toBeEnabled();

    await userEvent.click(prev);
    expect(screen.getByRole('heading', { level: 4, name: 'Festival des arts' })).toBeInTheDocument();
    expect(prev).toBeDisabled();
    expect(container.querySelectorAll('.event-slide')).toHaveLength(2);
  });

  it("affiche l'état de chargement des appartements puis les biens trouvés", async () => {
    let resolveRooms!: (value: Room[]) => void;
    mocks.fetchRooms.mockReturnValue(
      new Promise<Room[]>((resolve) => {
        resolveRooms = resolve;
      }),
    );

    const { container } = renderSection();
    await openCity(container, 'Abidjan');

    expect(
      screen.getByText('Recherche des appartements disponibles…'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Appartements disponibles à Abidjan' })).toBeInTheDocument();

    resolveRooms([room({ id: 'r1', title: 'Loft Cocody' })]);
    await screen.findByRole('heading', { level: 3, name: 'Loft Cocody' });

    expect(screen.queryByText('Recherche des appartements disponibles…')).not.toBeInTheDocument();
    expect(container.querySelectorAll('a.stay-card__link')).toHaveLength(1);
    expect(
      mocks.fetchRooms,
    ).toHaveBeenCalledWith('CI', '2099-01-08', '2099-01-22', 'Abidjan');
  });

  it("affiche l'absence d'appartement quand la recherche ne renvoie rien", async () => {
    renderSection();
    await openCity(document, 'Abidjan');

    expect(
      screen.getByText('Aucun appartement disponible à Abidjan autour de cette date.'),
    ).toBeInTheDocument();
    expect(document.querySelector('.event-detail__stays-fallback')).not.toBeInTheDocument();
  });

  it("replie sur tout le marché quand la ville ne donne rien", async () => {
    mocks.fetchRooms.mockResolvedValueOnce([]).mockResolvedValueOnce([
      room({ id: 'r2', title: 'Studio Grand-Bassam' }),
    ]);

    const { container } = renderSection();
    await openCity(container, 'Abidjan');

    const fallback = container.querySelector('.event-detail__stays-fallback');
    expect(fallback).toHaveTextContent(/Aucun bien trouvé à Abidjan/);
    expect(fallback).toHaveTextContent(/Côte d'Ivoire/);
    expect(mocks.fetchRooms).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('a.stay-card__link')).toHaveLength(1);
  });

  it("ouvre la recherche complète avec la semaine autour de l'événement", async () => {
    renderSection();
    await openCity(document, 'Abidjan');

    const link = screen.getByRole('link', { name: 'Voir tous les appartements' });
    expect(link).toHaveAttribute(
      'href',
      '/ci/recherche?arrivee=2099-01-08&depart=2099-01-22',
    );

    await userEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/ci/recherche?arrivee=2099-01-08&depart=2099-01-22',
    );
  });

  it('masque la section quand il n’y a ni événement ni bannière', async () => {
    mocks.fetchEvents.mockResolvedValue([]);

    const { container } = renderSection();
    await waitFor(() => expect(container.querySelector('.events')).not.toBeInTheDocument());
  });

  it("affiche la section avec ses bannières même sans événement", async () => {
    mocks.fetchEvents.mockResolvedValue([]);
    mocks.fetchBanners.mockResolvedValue([
      {
        id: 'be',
        section: 'events',
        img: '/images/be.jpg',
        alt: 'Bannière événements',
        link: '/ci/hotels',
        market: 'CI',
        order: 1,
      },
    ]);

    renderSection();

    expect(await screen.findByRole('region', { name: 'Bannières promotionnelles' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Retrouvez-nous, dans votre ville' }),
    ).toBeInTheDocument();
  });

  it('interroge les événements du marché courant', async () => {
    renderSection('/bj');

    await waitFor(() => expect(mocks.fetchEvents).toHaveBeenCalledWith('BJ'));
    expect(mocks.fetchBanners).toHaveBeenCalledWith('BJ', 'events');
  });
});
