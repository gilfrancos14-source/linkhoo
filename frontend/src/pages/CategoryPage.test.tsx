import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import type { Room } from '../data/rooms';
import type { Category } from '../data/categories';
import CategoryPage from './CategoryPage';

type RoomsPage = { items: Room[]; total: number; page: number; limit: number };

type RoomsPageParams = {
  market: 'CI' | 'BJ';
  category?: string;
  ville?: string;
  quartier?: string;
  chambres?: number;
  disponible?: true;
  page?: number;
  limit?: number;
};

const mocks = vi.hoisted(() => ({
  fetchRoomsPage: vi.fn<(params: RoomsPageParams) => Promise<RoomsPage>>(),
  fetchVilles: vi.fn<(market?: 'CI' | 'BJ') => Promise<string[]>>(),
  fetchQuartiers: vi.fn<(market?: 'CI' | 'BJ') => Promise<string[]>>(),
  fetchCategoriesByMarket: vi.fn<(market: 'CI' | 'BJ') => Promise<unknown[]>>(),
  request: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  cachedGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

// Les modules de données sont la couche réseau de cette page : ils sont
// remplacés intégralement (helpers de display conservés via importOriginal).
// `request`/`cachedGet` sont verrouillés en rejet pour garantir qu'aucun
// vrai fetch ne peut partir depuis ce fichier de test.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    request: mocks.request,
    cachedGet: mocks.cachedGet,
  };
});

vi.mock('../data/rooms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/rooms')>();
  return {
    ...actual,
    fetchRoomsPage: mocks.fetchRoomsPage,
    fetchVilles: mocks.fetchVilles,
    fetchQuartiers: mocks.fetchQuartiers,
  };
});

vi.mock('../data/categories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/categories')>();
  return {
    ...actual,
    fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
  };
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

// Simule le contrat serveur de GET /api/rooms (filtres + pagination),
// à partir d'un jeu de biens, comme le ferait la base de données.
function serverDataset(rows: Room[]): void {
  mocks.fetchRoomsPage.mockImplementation(async (params) => {
    const filtered = rows.filter((row) => {
      if (params.category && row.category !== params.category) return false;
      if (params.ville && row.ville !== params.ville) return false;
      if (params.quartier && row.quartier !== params.quartier) return false;
      if (params.chambres !== undefined) {
        if (params.chambres >= 3 ? row.chambres < 3 : row.chambres !== params.chambres) return false;
      }
      if (params.disponible === true && !row.disponible) return false;
      return true;
    });
    const page = params.page || 1;
    const limit = params.limit || 6;
    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
    };
  });
  mocks.fetchVilles.mockResolvedValue([...new Set(rows.map((row) => row.ville))]);
  mocks.fetchQuartiers.mockResolvedValue([...new Set(rows.map((row) => row.quartier))]);
}

function renderPage(entry = '/ci/categorie/cat-premium') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Routes>
          <Route path="/:market/categorie/:id" element={<CategoryPage />} />
          <Route path="/:market" element={<div data-testid="home">Accueil du marché</div>} />
          <Route path="/:market/chambre/:id" element={<div data-testid="room">Détail chambre</div>} />
        </Routes>
        <Link to="/ci/categorie/cat-moins" data-testid="switch-category">
          Autre catégorie
        </Link>
        <Link to="/bj/categorie/cat-premium" data-testid="switch-market">
          Marché BJ
        </Link>
      </MarketProvider>
    </MemoryRouter>,
  );
}

function cardCount(container: HTMLElement): number {
  return container.querySelectorAll('.stay-card').length;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.cachedGet.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.fetchCategoriesByMarket.mockResolvedValue(CATEGORIES);
  serverDataset([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-market');
});

describe('CategoryPage — états', () => {
  it('affiche le chargement tant que les données ne sont pas revenues', () => {
    mocks.fetchRoomsPage.mockReturnValue(new Promise<never>(() => {}));
    mocks.fetchCategoriesByMarket.mockReturnValue(new Promise<never>(() => {}));

    renderPage();

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(document.querySelector('.cat-page__grid')).toBeNull();
  });

  it('affiche le titre de la catégorie et son nombre de résultats', async () => {
    serverDataset([
      makeRoom(),
      makeRoom({ id: 'r2', title: 'Bungalow jardin' }),
      makeRoom({ id: 'r3', title: 'Loft terrasse' }),
    ]);

    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Chambres premium' })).toBeInTheDocument();
    expect(screen.getByText('3 résultats')).toBeInTheDocument();
  });

  it('accorde le compteur au singulier pour un seul résultat', async () => {
    serverDataset([makeRoom()]);

    renderPage();

    expect(await screen.findByText('1 résultat')).toBeInTheDocument();
  });

  it("affiche l'état vide quand la catégorie n'existe pas", async () => {
    renderPage('/ci/categorie/inconnue');

    expect(await screen.findByText('Catégorie introuvable.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "← Retour à l'accueil" })).toHaveAttribute('href', '/ci');
  });

  it("remonte l'erreur de chargement en état catégorie introuvable", async () => {
    mocks.fetchRoomsPage.mockRejectedValue(new Error('panne api'));
    mocks.fetchCategoriesByMarket.mockRejectedValue(new Error('panne api'));

    renderPage();

    expect(await screen.findByText('Catégorie introuvable.')).toBeInTheDocument();
  });

  it("affiche l'état vide des filtres quand aucun bien ne correspond", async () => {
    // Les options des listes viennent du serveur pour tout le marché : la
    // combinaison Ville + Quartier (Abidjan + Ficaye, qui appartient à
    // Grand-Bassam) est vide.
    serverDataset([
      makeRoom({ ville: 'Grand-Bassam', quartier: 'Ficaye' }),
      makeRoom({ id: 'r2', ville: 'Abidjan', quartier: 'Cocody' }),
    ]);

    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Abidjan');
    await userEvent.selectOptions(screen.getByLabelText('Quartier'), 'Ficaye');

    expect(await screen.findByText('Aucun résultat ne correspond à vos filtres.')).toBeInTheDocument();
    expect(cardCount(document.body)).toBe(0);
  });
});

describe('CategoryPage — contenu', () => {
  it('affiche le fil d’Ariane avec la catégorie courante', async () => {
    serverDataset([makeRoom()]);

    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });
    const breadcrumb = screen.getByRole('navigation', { name: "Fil d'Ariane" });
    expect(breadcrumb).toHaveTextContent('Accueil');
    expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent('Chambres premium');
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/ci');
  });

  it("n'affiche que les chambres de la catégorie demandée", async () => {
    serverDataset([
      makeRoom(),
      makeRoom({ id: 'r2', category: 'cat-moins', title: 'Chambre économique' }),
    ]);

    renderPage();

    await screen.findByRole('heading', { level: 3, name: 'Suite vue mer' });
    expect(screen.queryByRole('heading', { level: 3, name: 'Chambre économique' })).not.toBeInTheDocument();
    expect(cardCount(document.body)).toBe(1);
  });

  it('mène vers la page de la chambre au clic', async () => {
    serverDataset([makeRoom()]);

    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    const link = screen.getByRole('link', { name: 'Suite vue mer, dès 25 000 FCFA / nuit' });
    expect(link).toHaveAttribute('href', '/ci/chambre/r1');
    await userEvent.click(link);

    expect(screen.getByTestId('room')).toBeInTheDocument();
  });

  it('marque les chambres indisponibles d’un badge explicite', async () => {
    serverDataset([
      makeRoom(),
      makeRoom({ id: 'r2', disponible: false, title: 'Chambre fermée' }),
    ]);

    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    expect(screen.getByText('Indisponible')).toBeInTheDocument();
    expect(document.querySelectorAll('.stay-card__badge')).toHaveLength(1);
  });

  it("affiche le badge « Premium » sur les biens d’un gérant premium", async () => {
    serverDataset([makeRoom({ gerantPremium: true }), makeRoom({ id: 'r2', title: 'Chambre classique' })]);

    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(document.querySelector('.stay-card__badge--premium')).toBeInTheDocument();
    expect(document.querySelectorAll('.stay-card__badge')).toHaveLength(1);
  });

  it('détaille les caractéristiques (capacité et chambres) de chaque bien', async () => {
    serverDataset([
      makeRoom({ id: 'r1', title: 'Suite deux chambres', chambres: 2 }),
      makeRoom({ id: 'r2', title: 'Chambre simple', chambres: 1 }),
    ]);

    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    expect(screen.getByText('2 chambres')).toBeInTheDocument();
    expect(screen.getByText('1 chambre')).toBeInTheDocument();
  });

  it('interroge les données pour le marché de l’URL', async () => {
    renderPage('/bj/categorie/cat-premium');

    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });
    expect(mocks.fetchRoomsPage).toHaveBeenCalledWith(
      expect.objectContaining({ market: 'BJ', category: 'cat-premium' }),
    );
    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('BJ');
    expect(mocks.fetchVilles).toHaveBeenCalledWith('BJ');
    expect(mocks.fetchQuartiers).toHaveBeenCalledWith('BJ');
  });

  it('construit les liens dans le marché courant (BJ)', async () => {
    serverDataset([makeRoom({ market: 'BJ' })]);

    renderPage('/bj/categorie/cat-premium');
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/bj');
    expect(screen.getByRole('link', { name: 'Suite vue mer, dès 25 000 FCFA / nuit' })).toHaveAttribute(
      'href',
      '/bj/chambre/r1',
    );
  });

  it('ne laisse partir aucune requête réseau non mockée', async () => {
    serverDataset([makeRoom()]);

    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.cachedGet).not.toHaveBeenCalled();
  });

  it('repasse par l’état de chargement quand le marché change', async () => {
    serverDataset([makeRoom({ market: 'BJ' })]);

    renderPage('/ci/categorie/cat-premium');
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    fireEvent.click(screen.getByTestId('switch-market'));

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Chambres premium' })).toBeInTheDocument();
    expect(mocks.fetchRoomsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ market: 'BJ', category: 'cat-premium' }),
    );
  });
});

describe('CategoryPage — filtres', () => {
  beforeEach(async () => {
    serverDataset([
      makeRoom({ id: 'r1', title: 'Suite Ficaye', ville: 'Grand-Bassam', quartier: 'Ficaye', chambres: 1 }),
      makeRoom({ id: 'r2', title: 'Bungalow Cocody', ville: 'Abidjan', quartier: 'Cocody', chambres: 2 }),
      makeRoom({
        id: 'r3',
        title: 'Loft Plateau',
        ville: 'Abidjan',
        quartier: 'Plateau',
        chambres: 4,
        disponible: false,
      }),
    ]);
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });
  });

  it('filtre par ville', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Abidjan');

    expect(await screen.findByText('2 résultats')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Suite Ficaye' })).not.toBeInTheDocument();
  });

  it('filtre par quartier', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Quartier'), 'Cocody');

    expect(await screen.findByText('1 résultat')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Bungalow Cocody' })).toBeInTheDocument();
  });

  it('filtre par nombre de chambres avec la borne « 3+ »', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Chambres'), '1');
    expect(await screen.findByRole('heading', { level: 3, name: 'Suite Ficaye' })).toBeInTheDocument();
    expect(screen.getByText('1 résultat')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Chambres'), '3');
    expect(await screen.findByRole('heading', { level: 3, name: 'Loft Plateau' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Suite Ficaye' })).not.toBeInTheDocument();
    expect(screen.getByText('1 résultat')).toBeInTheDocument();
  });

  it('filtre sur les seules chambres disponibles', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Disponible'), 'yes');

    expect(await screen.findByText('2 résultats')).toBeInTheDocument();
    expect(screen.queryByText('Indisponible')).not.toBeInTheDocument();
  });

  it('réinitialise les filtres avec le bouton du panneau', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Abidjan');
    expect(await screen.findByText('2 résultats')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    expect(await screen.findByText('3 résultats')).toBeInTheDocument();
    expect(screen.getByLabelText('Ville')).toHaveValue('');
  });

  it('réinitialise les filtres depuis l’état vide', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Abidjan');
    await userEvent.selectOptions(screen.getByLabelText('Quartier'), 'Ficaye');
    expect(await screen.findByText('Aucun résultat ne correspond à vos filtres.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));

    expect(await screen.findByText('3 résultats')).toBeInTheDocument();
  });
});

describe('CategoryPage — pagination et changement de catégorie', () => {
  it('pagine au-delà de six chambres', async () => {
    serverDataset(
      Array.from({ length: 7 }, (_, i) => makeRoom({ id: `r${i + 1}`, title: `Chambre ${i + 1}` })),
    );

    const { container } = renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(cardCount(container)).toBe(6);

    await userEvent.click(screen.getByRole('button', { name: '2' }));

    expect(await screen.findByRole('heading', { level: 3, name: 'Chambre 7' })).toBeInTheDocument();
    expect(cardCount(container)).toBe(1);
  });

  it('réinitialise la page courante quand un filtre est modifié', async () => {
    serverDataset([
      makeRoom({ id: 'r1', title: 'Suite Abidjan', ville: 'Abidjan' }),
      ...Array.from({ length: 7 }, (_, i) =>
        makeRoom({ id: `x${i}`, title: `Suite ${i}`, ville: 'Grand-Bassam' }),
      ),
    ]);

    const { container } = renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Suite 6' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Abidjan');

    expect(await screen.findByText('1 résultat')).toBeInTheDocument();
    expect(cardCount(container)).toBe(1);
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('remet les filtres à zéro quand on change de catégorie', async () => {
    serverDataset([
      makeRoom({ id: 'r1', title: 'Suite Abidjan', ville: 'Abidjan' }),
      makeRoom({ id: 'r2', title: 'Suite Bassam', ville: 'Grand-Bassam' }),
    ]);
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Chambres premium' });

    await userEvent.selectOptions(screen.getByLabelText('Ville'), 'Abidjan');
    expect(screen.getByLabelText('Ville')).toHaveValue('Abidjan');

    await userEvent.click(screen.getByTestId('switch-category'));

    expect(await screen.findByRole('heading', { level: 1, name: 'Chambres moins chères' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ville')).toHaveValue('');
  });
});
