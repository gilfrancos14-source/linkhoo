import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

const mocks = vi.hoisted(() => ({
  featuredBoosts: vi.fn(),
  featuredReviews: vi.fn(),
  impression: vi.fn(),
  click: vi.fn(),
  cachedGet: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  apiBoosts: {
    featured: mocks.featuredBoosts,
    impression: mocks.impression,
    click: mocks.click,
  },
  apiReviews: {
    featured: mocks.featuredReviews,
  },
  cachedGet: mocks.cachedGet,
}));

function boost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'boost-1',
    room_id: 'room-1',
    market: 'CI',
    mode: 'cpc',
    title: 'Studio moderne à Cocody',
    price: '25 000 FCFA',
    price_num: 25000,
    img: '/images/listings/cocody.jpg',
    ville: 'Abidjan',
    quartier: 'Cocody',
    category: 'appartements',
    rating: 4.8,
    reviews_count: 124,
    ...overrides,
  };
}

function review(index: number, name: string) {
  return {
    id: `review-${index}`,
    client_name: name,
    note_appartement: 4,
    commentaire: 'Un séjour très agréable.',
    created_at: '2026-01-10',
    room: { title: 'Studio', ville: 'Abidjan', market: 'CI' },
    room_avg: 4.8,
  };
}

const REVIEWS = [
  review(1, 'Adama Diallo'),
  review(2, 'Mariama Koné'),
  review(3, 'Brice Tchibozo'),
  review(4, 'Fatou Diop'),
  review(5, 'Issa Lamine'),
  review(6, 'Sophie Laurent'),
];

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cachedGet.mockResolvedValue([]);
  mocks.featuredBoosts.mockResolvedValue({
    items: [
      boost(),
      boost({
        id: 'boost-2',
        room_id: 'room-2',
        title: 'Villa de luxe',
        price: '120 000 FCFA',
        price_num: 120000,
        ville: 'Assinie',
        quartier: null,
      }),
    ],
    config: {},
  });
  mocks.featuredReviews.mockResolvedValue(REVIEWS);
  mocks.impression.mockResolvedValue({ counted: true });
  mocks.click.mockResolvedValue({ counted: true });
});

afterEach(() => {
  cleanup();
});

describe('LandingPage — maquette accueil', () => {
  it("affiche le bandeau, l'en-tête et le hero", async () => {
    renderLanding();

    expect(
      screen.getByText(
        'Vous êtes actuellement hors ligne. Certaines fonctionnalités peuvent être limitées.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Linkhoo').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Accueil' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'À propos' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Contact' }).length).toBeGreaterThan(0);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "La location directe en Afrique de l'Ouest",
    );
    expect(screen.getByText('Mot-clé')).toBeInTheDocument();
    expect(screen.getByText('Catégorie')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Pays/ })).toBeInTheDocument();
    await screen.findByText('Studio moderne à Cocody');
  }, 20000);

  it('affiche les 12 pays et permet d’en sélectionner un', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 2, name: 'Choisissez un Pays' })).toBeInTheDocument();
    const countryGrid = document.querySelector('.acc-country-grid');
    expect(countryGrid).not.toBeNull();
    expect(within(countryGrid as HTMLElement).getAllByRole('button')).toHaveLength(12);

    fireEvent.click(screen.getByRole('button', { name: /^Sénégal$/ }));

    expect(screen.getByRole('button', { name: /^Sénégal$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox', { name: /Pays/ })).toHaveValue('SN');
    expect(screen.getByRole('button', { name: 'Pays : Sénégal' })).toBeInTheDocument();
  }, 20000);

  it('affiche les annonces en vedette, le carrousel et les six avis', async () => {
    renderLanding();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Des chambres en vedette' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Studio moderne à Cocody')).toBeInTheDocument();
    expect(screen.getByText('Villa de luxe')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Des séjours inoubliables vous attendent' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explorer maintenant' })).toBeInTheDocument();

    expect(await screen.findByText('Adama Diallo')).toBeInTheDocument();
    const reviews = document.querySelector('.acc-reviews__grid');
    expect(reviews).not.toBeNull();
    expect(within(reviews as HTMLElement).getAllByRole('article')).toHaveLength(6);
    expect(screen.getByText('Sophie Laurent')).toBeInTheDocument();
  }, 20000);

  it('bascule le cœur d’une annonce en favori', async () => {
    renderLanding();

    const heart = (await screen.findAllByRole('button', { name: 'Ajouter aux favoris' }))[0];
    fireEvent.click(heart);

    expect(screen.getByRole('button', { name: 'Retirer des favoris' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }, 20000);

  it('masque les sections sans données API', async () => {
    mocks.featuredBoosts.mockResolvedValue({ items: [], config: {} });
    mocks.featuredReviews.mockResolvedValue([]);

    renderLanding();

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Des chambres en vedette' })).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Nos utilisateurs en parlent' })).toBeNull();
    });
  }, 20000);

  it('conserve le footer sombre et le copyright', () => {
    renderLanding();

    expect(screen.queryByText('Revue de presse')).toBeNull();
    expect(screen.getByText('Application mobile')).toBeInTheDocument();
    expect(screen.getByText('Newsletter')).toBeInTheDocument();
    expect(screen.getByText('© 2025 Linkhoo. Tous droits réservés.')).toBeInTheDocument();
  }, 20000);
});
