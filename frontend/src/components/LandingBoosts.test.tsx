import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LandingBoosts, { boostVisitorId } from './LandingBoosts';
import type { BoostFeaturedItem } from '../lib/api';

const mocks = vi.hoisted(() => ({
  featured: vi.fn<() => Promise<unknown>>(),
  impression: vi.fn<() => Promise<unknown>>(),
  click: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('../lib/api', () => ({
  apiBoosts: {
    featured: mocks.featured,
    impression: mocks.impression,
    click: mocks.click,
  },
}));

// jsdom n'implémente pas IntersectionObserver : ce stub contrôlable laisse
// le test déclencher (ou non) l'intersection des cartes à la main.
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.add(el);
  }

  unobserve(el: Element) {
    this.observed.delete(el);
  }

  disconnect() {
    this.observed.clear();
  }

  trigger(entries: Array<{ target: Element; isIntersecting?: boolean }>) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

function featuredItem(overrides: Partial<BoostFeaturedItem> = {}): BoostFeaturedItem {
  return {
    id: 'boost-1',
    room_id: 'room-9',
    market: 'CI',
    mode: 'cpi',
    title: 'Suite Plateau',
    price: '45 000 FCFA',
    price_num: 45000,
    img: '/images/suite.jpg',
    ville: 'Abidjan',
    quartier: 'Plateau',
    category: 'chambres',
    ...overrides,
  };
}

function renderBoosts() {
  return render(
    <MemoryRouter>
      <LandingBoosts />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  window.localStorage.clear();
  mocks.featured.mockResolvedValue({ items: [featuredItem()], config: {} });
  mocks.impression.mockResolvedValue({ counted: true, billed: true, exhausted: false, remaining: 900 });
  mocks.click.mockResolvedValue({ counted: true, billed: true, exhausted: false, remaining: 850 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LandingBoosts', () => {
  it('affiche les squelettes pendant le chargement', async () => {
    let resolveFeatured!: (value: unknown) => void;
    mocks.featured.mockReturnValue(
      new Promise((resolve) => {
        resolveFeatured = resolve;
      }),
    );

    const { container } = renderBoosts();

    expect(container.querySelector('.landing-boosts__track')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.card-skeleton')).toHaveLength(4);
    expect(screen.getByText('Sponsorisé')).toBeInTheDocument();

    resolveFeatured({ items: [featuredItem()], config: {} });
    await waitFor(() =>
      expect(container.querySelector('.landing-boosts__track')).toHaveAttribute('aria-busy', 'false'),
    );
  });

  it("affiche la carte sponsorisée avec son lien vers la chambre", async () => {
    renderBoosts();

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Suite Plateau' }),
    ).toBeInTheDocument();
    // Le surtitre de section et la pastille de carte portent le même mot.
    expect(screen.getAllByText('Sponsorisé')).toHaveLength(2);
    expect(screen.getByText('Plateau')).toBeInTheDocument();
    expect(document.querySelector('.stay-card__price')).toHaveTextContent('45 000');
    expect(document.querySelector<HTMLAnchorElement>('a.stay-card__link')).toHaveAttribute(
      'href',
      '/ci/chambre/room-9',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Des chambres en vedette' }),
    ).toBeInTheDocument();
  });

  it("construit le lien à partir du marché de l'annonce, pas du marché courant", async () => {
    mocks.featured.mockResolvedValue({ items: [featuredItem({ market: 'BJ' })], config: {} });

    renderBoosts();
    await screen.findByRole('heading', { level: 3, name: 'Suite Plateau' });

    expect(document.querySelector<HTMLAnchorElement>('a.stay-card__link')).toHaveAttribute(
      'href',
      '/bj/chambre/room-9',
    );
  });

  it("masque la section quand l'API échoue", async () => {
    mocks.featured.mockRejectedValue(new Error('Réseau indisponible'));

    const { container } = renderBoosts();
    await waitFor(() => expect(container.querySelector('.landing-boosts')).not.toBeInTheDocument());
  });

  it("masque la section quand aucune campagne n'est en ligne", async () => {
    mocks.featured.mockResolvedValue({ items: [], config: {} });

    const { container } = renderBoosts();
    await waitFor(() => expect(container.querySelector('.landing-boosts')).not.toBeInTheDocument());
  });

  it("masque la section face à une réponse sans items (fallback e2e)", async () => {
    mocks.featured.mockResolvedValue({});

    const { container } = renderBoosts();
    await waitFor(() => expect(container.querySelector('.landing-boosts')).not.toBeInTheDocument());
  });

  it("compte une impression à l'intersection, puis n'en renvoie plus", async () => {
    renderBoosts();
    const card = await screen.findByRole('heading', { level: 3, name: 'Suite Plateau' });
    const item = card.closest('[data-boost-id]');
    if (!item) throw new Error('emplacement boost introuvable');

    const observer = MockIntersectionObserver.instances[0];
    expect(observer).toBeDefined();

    observer.trigger([{ target: item, isIntersecting: true }]);
    await waitFor(() => expect(mocks.impression).toHaveBeenCalledTimes(1));
    expect(mocks.impression).toHaveBeenCalledWith('boost-1', boostVisitorId());

    // Deuxième intersection de la même carte : déjà comptée pour ce visiteur.
    observer.trigger([{ target: item, isIntersecting: true }]);
    expect(mocks.impression).toHaveBeenCalledTimes(1);
  });

  it("n'envoie aucune impression tant que la carte n'est pas visible", async () => {
    renderBoosts();
    const card = await screen.findByRole('heading', { level: 3, name: 'Suite Plateau' });
    const item = card.closest('[data-boost-id]');
    if (!item) throw new Error('emplacement boost introuvable');

    MockIntersectionObserver.instances[0].trigger([{ target: item, isIntersecting: false }]);
    expect(mocks.impression).not.toHaveBeenCalled();
  });

  it('compte le clic avec le même identifiant de visiteur', async () => {
    renderBoosts();
    const link = await screen.findByRole('heading', { level: 3, name: 'Suite Plateau' });
    const item = link.closest('[data-boost-id]');
    if (!item) throw new Error('emplacement boost introuvable');

    await userEvent.click(item);

    expect(mocks.click).toHaveBeenCalledTimes(1);
    expect(mocks.click).toHaveBeenCalledWith('boost-1', boostVisitorId());
    expect(window.localStorage.getItem('ilehya_boost_visitor')).toBeTruthy();
  });
});

describe('boostVisitorId', () => {
  it('persiste le même identifiant entre deux appels', () => {
    window.localStorage.clear();

    const first = boostVisitorId();
    const second = boostVisitorId();

    expect(first).toBe(second);
    expect(window.localStorage.getItem('ilehya_boost_visitor')).toBe(first);
  });
});
