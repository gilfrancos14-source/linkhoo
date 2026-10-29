import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import LandingPage from './LandingPage';

const mocks = vi.hoisted(() => ({
  featuredReviews: vi.fn(),
  cachedGet: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  apiReviews: {
    featured: mocks.featuredReviews,
  },
  cachedGet: mocks.cachedGet,
}));

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
      <MarketProvider>
        <LandingPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cachedGet.mockResolvedValue([]);
  mocks.featuredReviews.mockResolvedValue(REVIEWS);
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

  it('affiche le carrousel et les six avis', async () => {
    renderLanding();

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

  it('masque les sections sans données API', async () => {
    mocks.featuredReviews.mockResolvedValue([]);

    renderLanding();

    await waitFor(() => {
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
