import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Room } from '../data/rooms';
import PremiumRoomsCarousel from './PremiumRoomsCarousel';

function room(id: string, overrides: Partial<Room> = {}): Room {
  return {
    id,
    title: `Bien ${id}`,
    subtitle: '',
    info: '',
    price: '25 000',
    priceNum: 25000,
    priceUnit: '/ nuit',
    img: '/images/suite.jpg',
    alt: `Photo de ${id}`,
    images: [],
    description: '',
    category: 'Studio',
    market: 'CI',
    pays: 'Côte d’Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '',
    conditions: '',
    gerantPremium: true,
    ...overrides,
  };
}

const HREF = (item: Room) => `/ci/chambre/${item.id}`;
const META = () => ['1 ch.', '1 sdb'];

function renderCarousel(rooms: Room[]) {
  return render(
    <MemoryRouter>
      <PremiumRoomsCarousel rooms={rooms} hrefFor={HREF} metaFor={META} />
    </MemoryRouter>,
  );
}

const FOUR_ROOMS = [room('a'), room('b'), room('c'), room('d')];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PremiumRoomsCarousel', () => {
  it('affiche les chambres de la sélection premium', () => {
    renderCarousel([room('a'), room('b')]);

    const carousel = screen.getByRole('region', { name: 'Sélection premium' });
    expect(within(carousel).getByText('Bien a')).toBeInTheDocument();
    expect(within(carousel).getByText('Bien b')).toBeInTheDocument();
    expect(carousel.querySelectorAll('.premium-carousel__item')).toHaveLength(2);
  });

  it('ne rend rien sans chambre', () => {
    const { container } = renderCarousel([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('défile automatiquement quand il y a plus de trois chambres', () => {
    renderCarousel(FOUR_ROOMS);

    expect(screen.getByText('1 sur 4')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('2 sur 4')).toBeInTheDocument();
  });

  it('ne défile pas automatiquement avec trois chambres ou moins', () => {
    renderCarousel(FOUR_ROOMS.slice(0, 3));

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByText('1 sur 3')).toBeInTheDocument();
  });

  it('met le défilement en pause au survol', () => {
    renderCarousel(FOUR_ROOMS);

    fireEvent.mouseEnter(document.querySelector('.premium-carousel') as HTMLElement);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('1 sur 4')).toBeInTheDocument();

    fireEvent.mouseLeave(document.querySelector('.premium-carousel') as HTMLElement);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('2 sur 4')).toBeInTheDocument();
  });

  it('avance et recule avec les flèches', () => {
    renderCarousel(FOUR_ROOMS);

    fireEvent.click(screen.getByRole('button', { name: 'Chambre suivante' }));
    expect(screen.getByText('2 sur 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chambre suivante' }));
    expect(screen.getByText('3 sur 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chambre précédente' }));
    expect(screen.getByText('2 sur 4')).toBeInTheDocument();
  });

  it('permet de choisir une chambre avec les pastilles', () => {
    renderCarousel(FOUR_ROOMS);

    fireEvent.click(screen.getByRole('button', { name: 'Aller à la chambre 4' }));

    expect(screen.getByText('4 sur 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aller à la chambre 4' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('suspend le défilement automatique avec le bouton pause', () => {
    renderCarousel(FOUR_ROOMS);

    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause le défilement automatique' }));

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('1 sur 4')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reprendre le défilement automatique' }),
    ).toBeInTheDocument();
  });

  it('désactive le défilement automatique si l’utilisateur préfère moins d’animations', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );

    renderCarousel(FOUR_ROOMS);

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByText('1 sur 4')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mettre en pause le défilement automatique' }),
    ).not.toBeInTheDocument();
  });
});
