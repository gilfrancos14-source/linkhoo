import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import TourismSection from './TourismSection';
import type { TourismCard, TourismView } from './viewModel';

function card(overrides: Partial<TourismCard> = {}): TourismCard {
  return {
    id: 'card-1',
    city: 'Abidjan',
    title: 'Abidjan',
    text: 'Le Plateau, Cocody et la lagune Ébrié.',
    image: '/images/destination.jpg',
    alt: 'Vue de la destination',
    count: 0,
    ...overrides,
  };
}

function renderTourism(view: TourismView) {
  return render(<TourismSection market="CI" view={view} />);
}

function featuredRegion() {
  return screen.getByRole('region', { name: 'Destinations mises en avant' });
}

beforeEach(() => {
  // Pas d'auto-défilement en test : le carrousel reste sur la première slide.
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
});

afterEach(cleanup);

describe('TourismSection (accueil marché)', () => {
  it('déroule les deux grandes cartes de la base quand aucune petite carte n’est sélectionnée', () => {
    renderTourism({
      bannerImage: '/images/banner.jpg',
      longCards: [
        card({ id: 'big-1', city: 'Abidjan', title: 'Abidjan', count: 3 }),
        card({ id: 'big-2', city: 'Bouaké', title: 'Bouaké', count: 0 }),
      ],
      minis: [card({ id: 'small-1', city: 'Assinie', title: 'Assinie', count: 1 })],
    });

    expect(screen.getByAltText(/Plage et aventure/)).toHaveAttribute('src', '/images/banner.jpg');
    expect(within(featuredRegion()).getByRole('heading', { name: 'Abidjan' })).toBeInTheDocument();
    expect(within(featuredRegion()).getByText('3 biens')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);

    fireEvent.click(screen.getByRole('tab', { name: 'Destination 2' }));
    expect(within(featuredRegion()).getByRole('heading', { name: 'Bouaké' })).toBeInTheDocument();
  });

  it('ne montre aucune pagination quand une seule grande carte est disponible', () => {
    renderTourism({
      bannerImage: '/images/banner.jpg',
      longCards: [card({ id: 'big-1', title: 'Abidjan' })],
      minis: [],
    });

    expect(within(featuredRegion()).getByRole('heading', { name: 'Abidjan' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('sans grande carte, la première petite occupe la carte longue et les autres la grille', () => {
    renderTourism({
      bannerImage: '/images/banner.jpg',
      longCards: [card({ id: 'small-1', city: 'Assinie', title: 'Assinie' })],
      minis: [card({ id: 'small-2', city: 'Korhogo', title: 'Korhogo' })],
    });

    expect(within(featuredRegion()).getByRole('heading', { name: 'Assinie' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Korhogo/ })).toBeInTheDocument();
  });

  it('affiche une carte unique pour la petite carte cliquée, puis revient au carrousel', () => {
    renderTourism({
      bannerImage: '/images/banner.jpg',
      longCards: [
        card({ id: 'big-1', city: 'Abidjan', title: 'Abidjan', text: 'Capitale économique.' }),
      ],
      minis: [
        card({ id: 'small-1', city: 'Assinie', title: 'Assinie', text: 'Plages et lagune.' }),
      ],
    });

    expect(within(featuredRegion()).getByRole('heading', { name: 'Abidjan' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Assinie/ }));

    expect(within(featuredRegion()).getByRole('heading', { name: 'Assinie' })).toBeInTheDocument();
    expect(within(featuredRegion()).getByText('Plages et lagune.')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Assinie/ }));

    expect(within(featuredRegion()).getByRole('heading', { name: 'Abidjan' })).toBeInTheDocument();
  });
});
