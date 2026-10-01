import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import type { Room } from '../data/rooms';
import type { Category } from '../data/categories';
import SearchResultsPage from './SearchResultsPage';

const mocks = vi.hoisted(() => ({
  fetchRoomsByMarket: vi.fn<(market: 'CI' | 'BJ') => Promise<unknown[]>>(),
  fetchAvailableRooms: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  fetchCategoriesByMarket: vi.fn<(market: 'CI' | 'BJ') => Promise<unknown[]>>(),
  request: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  cachedGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

// Couche réseau entièrement remplacée + verrou `request`/`cachedGet` : aucun
// vrai fetch ne peut partir depuis ce fichier de test.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, request: mocks.request, cachedGet: mocks.cachedGet };
});

vi.mock('../data/rooms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/rooms')>();
  return {
    ...actual,
    fetchRoomsByMarket: mocks.fetchRoomsByMarket,
    fetchAvailableRooms: mocks.fetchAvailableRooms,
  };
});

vi.mock('../data/categories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/categories')>();
  return { ...actual, fetchCategoriesByMarket: mocks.fetchCategoriesByMarket };
});

const CATEGORIES: Category[] = [
  { id: 'cat-premium', title: 'Chambres premium', img: '/images/premium.jpg', alt: 'Premium', market: 'CI' },
  { id: 'cat-moins', title: 'Chambres moins chères', img: '/images/moins.jpg', alt: 'Abordable', market: 'CI' },
];

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    title: 'Suite vue mer',
    subtitle: 'À deux pas de la plage',
    info: 'Nouveau',
    price: '25 000',
    priceNum: 25000,
    priceUnit: '/ nuit',
    img: '/images/suite.jpg',
    alt: 'Suite vue sur la mer',
    images: ['/images/suite.jpg'],
    description: 'Un espace lumineux avec terrasse.',
    capacity: '2 personnes',
    category: 'cat-premium',
    market: 'CI',
    pays: "Côte d'Ivoire",
    ville: 'Grand-Bassam',
    quartier: 'Ficaye',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '2026-01-01',
    conditions: 'Annulation gratuite',
    ...overrides,
  };
}

/** Sonde d'URL : permet d'observer les setSearchParams() de la page. */
function UrlProbe() {
  const [params] = useSearchParams();
  return <span data-testid="url-params">{params.toString()}</span>;
}

function renderPage(entry = DATED) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Routes>
          <Route path="/:market/recherche" element={<SearchResultsPage />} />
          <Route path="/:market" element={<div data-testid="home">Accueil du marché</div>} />
          <Route path="/:market/chambre/:id" element={<div data-testid="room">Détail chambre</div>} />
        </Routes>
        <UrlProbe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

const DATED = '/ci/recherche?arrivee=2026-03-01&depart=2026-03-04';

function cardCount(container: HTMLElement): number {
  return container.querySelectorAll('.stay-card').length;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.cachedGet.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.fetchRoomsByMarket.mockResolvedValue([]);
  mocks.fetchAvailableRooms.mockResolvedValue([]);
  mocks.fetchCategoriesByMarket.mockResolvedValue(CATEGORIES);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-market');
});

describe('SearchResultsPage — états', () => {
  it('affiche le chargement tant que les biens ne sont pas revenus', () => {
    mocks.fetchAvailableRooms.mockReturnValue(new Promise<Room[]>(() => {}));

    renderPage(DATED);

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(document.querySelector('.search-page__layout')).toBeNull();
  });

  it("affiche le panneau de dates quand les dates manquent", async () => {
    mocks.fetchRoomsByMarket.mockResolvedValue([makeRoom()]);

    renderPage('/ci/recherche');

    expect(await screen.findByRole('heading', { level: 1, name: 'Sélectionnez vos dates' })).toBeInTheDocument();
    expect(screen.getByText(/Renseignez vos dates d'arrivée et de départ/)).toBeInTheDocument();
  });

  it('affiche la requête dans le titre du panneau de dates', async () => {
    mocks.fetchRoomsByMarket.mockResolvedValue([makeRoom()]);

    renderPage('/ci/recherche?q=bord%20de%20mer');

    expect(await screen.findByRole('heading', { level: 1, name: /Recherche pour/ })).toHaveTextContent(
      'bord de mer',
    );
  });

  it('affiche le compteur de résultats au singulier', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([makeRoom()]);

    renderPage(DATED);

    expect(await screen.findByText('1 bien trouvé')).toBeInTheDocument();
  });

  it('affiche le compteur de résultats au pluriel', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([
      makeRoom(),
      makeRoom({ id: 'r2', title: 'Bungalow' }),
    ]);

    renderPage(DATED);

    expect(await screen.findByText('2 biens trouvés')).toBeInTheDocument();
  });

  it("affiche l'état vide de disponibilité pour ces dates", async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([]);

    renderPage(DATED);

    expect(await screen.findByText('Aucune disponibilité pour ces dates')).toBeInTheDocument();
    expect(
      screen.getByText("Essayez d'autres dates ou modifiez vos critères de recherche."),
    ).toBeInTheDocument();
  });

  it("convertit une erreur de chargement en état vide", async () => {
    mocks.fetchAvailableRooms.mockRejectedValue(new Error('panne api'));

    renderPage(DATED);

    expect(await screen.findByText('Aucune disponibilité pour ces dates')).toBeInTheDocument();
  });

  it('affiche « Tous les biens » quand aucune requête libre', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([makeRoom()]);

    renderPage(DATED);

    expect(
      await screen.findByRole('heading', { level: 1, name: /Résultats pour Tous les biens/ }),
    ).toBeInTheDocument();
  });
});

describe('SearchResultsPage — panneau de dates', () => {
  beforeEach(() => {
    mocks.fetchRoomsByMarket.mockResolvedValue([makeRoom()]);
  });

  it('refuse la soumission sans dates', async () => {
    renderPage('/ci/recherche');

    await screen.findByRole('heading', { level: 1, name: 'Sélectionnez vos dates' });
    await userEvent.click(screen.getByRole('button', { name: 'Voir les disponibilités' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Veuillez renseigner les deux dates.');
    expect(screen.getByTestId('url-params')).not.toHaveTextContent('arrivee=');
  });

  it('refuse un départ antérieur ou égal à l’arrivée', async () => {
    renderPage('/ci/recherche');

    await screen.findByRole('heading', { level: 1, name: 'Sélectionnez vos dates' });
    fireEvent.change(screen.getByLabelText(/Arrivée/), { target: { value: '2026-03-04' } });
    fireEvent.change(screen.getByLabelText(/Départ/), { target: { value: '2026-03-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Voir les disponibilités' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      "La date de départ doit être ultérieure à la date d'arrivée.",
    );
  });

  it('efface l’erreur dès qu’une date est saisie', async () => {
    renderPage('/ci/recherche');

    await screen.findByRole('heading', { level: 1, name: 'Sélectionnez vos dates' });
    await userEvent.click(screen.getByRole('button', { name: 'Voir les disponibilités' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Arrivée/), { target: { value: '2026-03-01' } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('valide les dates, met à jour l’URL et affiche les disponibilités', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([makeRoom()]);

    renderPage('/ci/recherche?q=mer');

    await screen.findByRole('heading', { level: 1, name: /Recherche pour/ });
    fireEvent.change(screen.getByLabelText(/Arrivée/), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText(/Départ/), { target: { value: '2026-03-04' } });
    await userEvent.click(screen.getByRole('button', { name: 'Voir les disponibilités' }));

    expect(await screen.findByRole('heading', { level: 1, name: /Résultats pour/ })).toBeInTheDocument();
    expect(screen.getByTestId('url-params')).toHaveTextContent('arrivee=2026-03-01');
    expect(screen.getByTestId('url-params')).toHaveTextContent('depart=2026-03-04');
    expect(screen.getByTestId('url-params')).toHaveTextContent('q=mer');
    expect(mocks.fetchAvailableRooms).toHaveBeenCalledWith('CI', '2026-03-01', '2026-03-04');
  });

  it('revient au panneau de dates avec le bouton Modifier', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([makeRoom()]);

    renderPage(DATED);
    await screen.findByRole('heading', { level: 1, name: /Résultats pour/ });

    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sélectionnez vos dates' })).toBeInTheDocument();
    expect(screen.getByTestId('url-params')).not.toHaveTextContent('arrivee=');
  });
});

describe('SearchResultsPage — requêtes', () => {
  it('interroge les disponibilités avec le marché et les dates', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([makeRoom()]);

    renderPage(DATED);
    await screen.findByRole('heading', { level: 1, name: /Résultats pour/ });

    expect(mocks.fetchAvailableRooms).toHaveBeenCalledWith('CI', '2026-03-01', '2026-03-04');
    expect(mocks.fetchRoomsByMarket).not.toHaveBeenCalled();
    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('CI');
  });

  it('interroge tous les biens du marché quand les dates manquent', async () => {
    renderPage('/ci/recherche');

    await screen.findByRole('heading', { level: 1, name: 'Sélectionnez vos dates' });

    expect(mocks.fetchRoomsByMarket).toHaveBeenCalledWith('CI');
    expect(mocks.fetchAvailableRooms).not.toHaveBeenCalled();
  });

  it('interroge le marché indiqué dans l’URL (BJ)', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([makeRoom({ market: 'BJ' })]);

    renderPage('/bj/recherche?arrivee=2026-03-01&depart=2026-03-04');
    await screen.findByText('1 bien trouvé');

    expect(mocks.fetchAvailableRooms).toHaveBeenCalledWith('BJ', '2026-03-01', '2026-03-04');
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/bj');
    expect(screen.getByRole('link', { name: 'Suite vue mer, dès 25 000 FCFA / nuit' })).toHaveAttribute(
      'href',
      '/bj/chambre/r1?arrivee=2026-03-01&depart=2026-03-04',
    );
  });

  it('ne laisse partir aucune requête réseau non mockée', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([makeRoom()]);

    renderPage(DATED);
    await screen.findByRole('heading', { level: 1, name: /Résultats pour/ });

    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.cachedGet).not.toHaveBeenCalled();
  });
});

describe('SearchResultsPage — résultats', () => {
  beforeEach(async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([
      makeRoom({
        id: 'r1',
        title: 'Suite Ficaye',
        ville: 'Grand-Bassam',
        quartier: 'Ficaye',
        priceNum: 25000,
        price: '25 000',
      }),
      makeRoom({
        id: 'r2',
        title: 'Bungalow Cocody',
        ville: 'Abidjan',
        quartier: 'Cocody',
        priceNum: 40000,
        price: '40 000',
        category: 'cat-moins',
      }),
      makeRoom({
        id: 'r3',
        title: 'Loft Plateau',
        ville: 'Abidjan',
        quartier: 'Plateau',
        priceNum: 60000,
        price: '60 000',
        disponible: false,
      }),
    ]);
    renderPage(DATED);
    // Attendre le compteur et non le titre : le plafond de prix (priceMax)
    // n'est calculé qu'après le rendu des biens, ce qui laisse un rendu
    // transitoire « 0 biens trouvés » avec le titre déjà visible.
    await screen.findByText('3 biens trouvés');
  });

  it('affiche le résumé des dates de séjour', () => {
    expect(screen.getByText('2026-03-01 → 2026-03-04')).toBeInTheDocument();
  });

  it('construit le lien de chaque carte avec les dates en query', () => {
    const link = screen.getByRole('link', { name: 'Suite Ficaye, dès 25 000 FCFA / nuit' });
    expect(link).toHaveAttribute('href', '/ci/chambre/r1?arrivee=2026-03-01&depart=2026-03-04');
  });

  it('marque les biens indisponibles d’un badge', () => {
    expect(screen.getByText('Indisponible')).toBeInTheDocument();
    expect(document.querySelectorAll('.stay-card__badge')).toHaveLength(1);
  });

  it('filtre par ville', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Abidjan');

    expect(screen.getByText('2 biens trouvés')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Suite Ficaye' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réinitialiser les filtres' })).toBeInTheDocument();
  });

  it('filtre par quartier', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Quartier'), 'Cocody');

    expect(screen.getByText('1 bien trouvé')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Bungalow Cocody' })).toBeInTheDocument();
  });

  it('filtre par catégorie', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Catégorie'), 'cat-moins');

    expect(screen.getByText('1 bien trouvé')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Bungalow Cocody' })).toBeInTheDocument();
  });

  it('filtre au prix maximal avec le curseur', () => {
    const range = screen.getByLabelText<HTMLInputElement>(/Prix max/);
    expect(range.value).toBe('60000');

    fireEvent.change(range, { target: { value: '30000' } });

    expect(screen.getByLabelText<HTMLInputElement>(/Prix max/).value).toBe('30000');
    expect(screen.getByText('1 bien trouvé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réinitialiser les filtres' })).toBeInTheDocument();
  });

  it('réinitialise tous les filtres', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Abidjan');
    await userEvent.selectOptions(screen.getByLabelText('Catégorie'), 'cat-moins');
    expect(screen.getByText('1 bien trouvé')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));

    expect(screen.getByText('3 biens trouvés')).toBeInTheDocument();
    expect(screen.getByLabelText('Ville')).toHaveValue('');
    expect(screen.getByLabelText('Catégorie')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Réinitialiser les filtres' })).not.toBeInTheDocument();
  });

  it('ne montre pas de bouton de réinitialisation sans filtre actif', () => {
    expect(screen.queryByRole('button', { name: 'Réinitialiser les filtres' })).not.toBeInTheDocument();
  });
});

describe('SearchResultsPage — requête libre et pagination', () => {
  it('filtre les biens sur la requête libre q', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([
      makeRoom({ id: 'r1', title: 'Suite vue mer' }),
      makeRoom({ id: 'r2', title: 'Chambre centre-ville', ville: 'Abidjan' }),
    ]);

    renderPage('/ci/recherche?q=mer&arrivee=2026-03-01&depart=2026-03-04');

    expect(await screen.findByText('1 bien trouvé')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Résultats pour mer/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Suite vue mer' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Chambre centre-ville' })).not.toBeInTheDocument();
    expect(screen.getByText('1 bien trouvé')).toBeInTheDocument();
  });

  it('pagine au-delà de six résultats', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => makeRoom({ id: `r${i + 1}`, title: `Bien ${i + 1}` })),
    );

    const { container } = renderPage(DATED);
    await screen.findByRole('navigation', { name: 'Pagination' });

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(cardCount(container)).toBe(6);

    await userEvent.click(screen.getByRole('button', { name: '2' }));

    expect(cardCount(container)).toBe(1);
    expect(screen.getByRole('heading', { level: 3, name: 'Bien 7' })).toBeInTheDocument();
  });

  it('revient à la première page quand un filtre change', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([
      makeRoom({ id: 'r1', title: 'Bien Abidjan', ville: 'Abidjan' }),
      ...Array.from({ length: 7 }, (_, i) =>
        makeRoom({ id: `x${i}`, title: `Bien ${i}`, ville: 'Grand-Bassam' }),
      ),
    ]);

    const { container } = renderPage(DATED);
    await screen.findByRole('navigation', { name: 'Pagination' });

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Bien 6' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Abidjan');

    expect(cardCount(container)).toBe(1);
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('affiche l’état vide quand la requête ne correspond à aucun bien', async () => {
    mocks.fetchAvailableRooms.mockResolvedValue([
      makeRoom({ id: 'r1', title: 'Suite vue mer' }),
      makeRoom({ id: 'r2', title: 'Chambre centre-ville' }),
    ]);

    renderPage('/ci/recherche?q=mountain&arrivee=2026-03-01&depart=2026-03-04');

    // Pluriel aussi à zéro : le compteur n'est pas au singulier que pour 1.
    expect(await screen.findByText('0 biens trouvés')).toBeInTheDocument();
    expect(screen.getByText('Aucune disponibilité pour ces dates')).toBeInTheDocument();
  });
});
