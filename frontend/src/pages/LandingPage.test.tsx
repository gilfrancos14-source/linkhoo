import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import LandingPage from './LandingPage';

const mocks = vi.hoisted(() => ({
  featured: vi.fn<() => Promise<unknown[]>>(),
  fetchCategoriesByMarket: vi.fn<(market: string) => Promise<unknown[]>>(),
}));

vi.mock('../lib/api', () => ({
  apiReviews: { featured: mocks.featured },
  cachedGet: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../data/categories', () => ({
  fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
}));

function LocationProbe() {
  const { pathname, search } = useLocation();
  return (
    <span data-testid="location">
      {pathname}
      {search}
    </span>
  );
}

function renderLanding(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <LandingPage />
    </MemoryRouter>,
  );
}

function countrySelect(): HTMLSelectElement {
  return screen.getByLabelText('Pays') as HTMLSelectElement;
}

function categorySelect(): HTMLSelectElement {
  return screen.getByLabelText('Catégories') as HTMLSelectElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.featured.mockResolvedValue([]);
  mocks.fetchCategoriesByMarket.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('LandingPage', () => {
  it('présente le hero CoinAfrique et sa recherche multicritères', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Linkhoo — La location directe en Afrique de l’Ouest',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Des biens proches de chez vous, sans intermédiaire'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Chercher sur Linkhoo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lancer la recherche' })).toBeInTheDocument();

    // Les catégories restent bloquées tant qu'aucun pays n'est choisi.
    expect(categorySelect()).toBeDisabled();
    expect(within(categorySelect()).getByText('Choisissez un pays')).toBeInTheDocument();
    expect(countrySelect()).toBeEnabled();
  });

  it('refuse la recherche sans pays choisi', async () => {
    renderLanding();

    await userEvent.click(screen.getByRole('button', { name: 'Lancer la recherche' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choisissez un pays pour lancer la recherche.',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('charge les catégories du pays puis lance la recherche', async () => {
    mocks.fetchCategoriesByMarket.mockResolvedValue([
      { id: 'cat-chambres', title: 'Chambres' },
    ]);
    renderLanding();

    await userEvent.selectOptions(countrySelect(), 'ci');
    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('CI');

    await waitFor(() =>
      expect(within(categorySelect()).getByRole('option', { name: 'Chambres' })).toBeInTheDocument(),
    );
    expect(categorySelect()).toBeEnabled();

    await userEvent.selectOptions(categorySelect(), 'cat-chambres');
    await userEvent.type(screen.getByPlaceholderText('Chercher sur Linkhoo'), 'Abidjan');
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la recherche' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/ci/recherche?q=Abidjan&categorie=cat-chambres',
    );
  });

  it('ouvre les 12 marchés : plus aucun pays « Bientôt »', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Choisissez un Pays' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Côte d’Ivoire/ })).toHaveAttribute('href', '/ci');
    expect(screen.getByRole('link', { name: /Bénin/ })).toHaveAttribute('href', '/bj');
    expect(screen.getByRole('link', { name: /Sénégal/ })).toHaveAttribute('href', '/sn');
    expect(screen.getByRole('link', { name: /RDC/ })).toHaveAttribute('href', '/cd');

    // Les 12 pays du registre sont des liens actifs, aucun « Bientôt ».
    expect(document.querySelectorAll('.landing-countries__item')).toHaveLength(12);
    expect(document.querySelectorAll('.landing-countries__card.is-disabled')).toHaveLength(0);
    expect(screen.queryAllByText('Bientôt')).toHaveLength(0);
  });

  it('affiche le carrousel et les témoignages', async () => {
    renderLanding();

    expect(screen.getByRole('region', { name: 'En images' })).toBeInTheDocument();
    expect(screen.getByAltText('Chambre lumineuse prête pour un séjour')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Image 1 sur 4' })).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Nos utilisateurs en parlent' }),
    ).toBeInTheDocument();
    // L'API ne renvoie rien : repli sur les six témoignages statiques.
    expect(await screen.findByText('Awa Kouassi')).toBeInTheDocument();
    expect(document.querySelectorAll('.landing-testimonials__card')).toHaveLength(6);
  });
});
