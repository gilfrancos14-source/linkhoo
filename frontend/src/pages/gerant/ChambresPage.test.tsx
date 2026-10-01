import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import ChambresPage from './ChambresPage';
import type { Room } from '../../data/rooms';
import type { Category } from '../../data/categories';

const mocks = vi.hoisted(() => ({
  fetchMyRooms: vi.fn<() => Promise<Room[]>>(),
  updateRoom: vi.fn<(id: string, updates: Partial<Room>) => Promise<void>>(),
  deleteRoom: vi.fn<(id: string) => Promise<void>>(),
  toggleRoom: vi.fn<(id: string) => Promise<Room>>(),
  fetchCategoriesByMarket: vi.fn<(market: string) => Promise<Category[]>>(),
}));

vi.mock('../../data/rooms', () => ({
  fetchMyRooms: mocks.fetchMyRooms,
  updateRoom: mocks.updateRoom,
  deleteRoom: mocks.deleteRoom,
  toggleRoom: mocks.toggleRoom,
}));

vi.mock('../../data/categories', () => ({
  fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
}));

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    title: 'Suite vue mer',
    subtitle: 'Cocon face à l’océan',
    info: '2 lits · salle de bain privée',
    price: '25 000',
    priceNum: 25000,
    priceUnit: '/ nuit',
    img: '/images/suite.jpg',
    alt: 'Suite vue mer',
    images: ['/images/suite.jpg'],
    description: 'Une suite confortable',
    capacity: '2 personnes',
    category: 'ci-chambres-premium',
    market: 'CI',
    pays: 'Côte d’Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '2026-10-01',
    conditions: 'Annulation gratuite',
    isPopular: false,
    ...overrides,
  };
}

const categories: Category[] = [
  {
    id: 'ci-chambres-premium',
    title: 'Chambres premium',
    img: '/images/1.jpg',
    alt: 'premium',
    market: 'CI',
  },
  {
    id: 'ci-hotels',
    title: 'Hôtels',
    img: '/images/2.jpg',
    alt: 'hôtels',
    market: 'CI',
  },
];

function renderChambres(entry = '/ci/gerant/chambres') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <ChambresPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function rowOf(title: string): HTMLElement {
  const cell = screen.getByText(title);
  const tr = cell.closest('tr');
  if (!tr) throw new Error(`ligne introuvable pour ${title}`);
  return tr;
}

function filters() {
  const selects = screen.getAllByRole('combobox');
  return { category: selects[0], status: selects[1] };
}

let confirmSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMyRooms.mockResolvedValue([makeRoom()]);
  mocks.fetchCategoriesByMarket.mockResolvedValue(categories);
  mocks.updateRoom.mockResolvedValue(undefined);
  mocks.deleteRoom.mockResolvedValue(undefined);
  mocks.toggleRoom.mockResolvedValue(makeRoom());
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  confirmSpy?.mockRestore();
  confirmSpy = null;
});

describe('ChambresPage', () => {
  it("affiche l'état de chargement avant la première réponse", () => {
    mocks.fetchMyRooms.mockImplementation(() => new Promise<Room[]>(() => {}));

    renderChambres();

    expect(
      screen.getByRole('heading', { name: 'Gestion des chambres' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('propose le lien de création et les filtres une fois chargé', async () => {
    renderChambres();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '+ Nouvelle chambre' }),
    ).toHaveAttribute('href', '/ci/gerant/chambres/ajouter');
    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument();
    expect(screen.getByText('Toutes catégories')).toBeInTheDocument();
    expect(screen.getByText('Tous statuts')).toBeInTheDocument();
    // Filtres catégorie/statut + select de catégorie de la ligne.
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
  });

  it('construit le lien et les catégories pour le marché BJ', async () => {
    renderChambres('/bj/gerant/chambres');

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('BJ');
    expect(
      screen.getByRole('link', { name: '+ Nouvelle chambre' }),
    ).toHaveAttribute('href', '/bj/gerant/chambres/ajouter');
  });

  it('affiche une ligne par chambre avec ses colonnes', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom(),
      makeRoom({
        id: 'room-2',
        title: 'Chambre économique',
        ville: 'Cotonou',
        disponible: false,
        isPopular: true,
        price: '12 000',
        category: 'ci-hotels',
      }),
    ]);

    renderChambres();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    const rows = screen.getAllByRole('rowgroup')[1].querySelectorAll('tr');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Suite vue mer')).toBeInTheDocument();
    expect(screen.getByText('Chambre économique')).toBeInTheDocument();
    expect(screen.getByText('Cotonou')).toBeInTheDocument();
    // La catégorie est portée par le select de chaque ligne (le texte
    // « Chambres premium » existe aussi dans le filtre : on cible la ligne).
    expect(
      within(rowOf('Suite vue mer')).getByRole('combobox'),
    ).toHaveValue('ci-chambres-premium');
    expect(
      within(rowOf('Chambre économique')).getByRole('combobox'),
    ).toHaveValue('ci-hotels');
    expect(screen.getByText(/25 000 FCFA/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disponible' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Occupée' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '★ Populaire' }),
    ).toBeInTheDocument();
  });

  it('ne répète pas la devise quand le prix stocké contient déjà FCFA', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom({ price: '25 000 FCFA', priceUnit: '/ mois' }),
    ]);

    renderChambres();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    const cell = rowOf('Suite vue mer').querySelector('.admin-table__price');
    expect(cell).toHaveTextContent('25 000 FCFA / mois');
    expect(cell?.textContent).not.toContain('FCFA FCFA');
  });

  it('affiche l’état vide quand aucune chambre n’est enregistrée', async () => {
    mocks.fetchMyRooms.mockResolvedValue([]);

    renderChambres();

    expect(await screen.findByText('Aucune chambre trouvée')).toBeInTheDocument();
    // Entête + unique ligne « aucune chambre trouvée ».
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(
      screen.getByText('Aucune chambre trouvée').closest('td'),
    ).toHaveAttribute('colspan', '8');
  });

  it('filtre par titre de chambre, insensible à la casse', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom(),
      makeRoom({ id: 'room-2', title: 'Chambre économique', ville: 'Cotonou' }),
    ]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.type(screen.getByPlaceholderText('Rechercher...'), 'ÉCONOMIQUE');

    expect(screen.getByText('Chambre économique')).toBeInTheDocument();
    expect(screen.queryByText('Suite vue mer')).not.toBeInTheDocument();
  });

  it('filtre par ville', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom(),
      makeRoom({ id: 'room-2', title: 'Chambre économique', ville: 'Cotonou' }),
    ]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.type(screen.getByPlaceholderText('Rechercher...'), 'cotonou');

    expect(screen.getByText('Chambre économique')).toBeInTheDocument();
    expect(screen.queryByText('Suite vue mer')).not.toBeInTheDocument();
  });

  it("affiche l'état vide quand la recherche ne correspond à rien", async () => {
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.type(screen.getByPlaceholderText('Rechercher...'), 'inexistant');

    expect(screen.getByText('Aucune chambre trouvée')).toBeInTheDocument();
    expect(screen.queryByText('Suite vue mer')).not.toBeInTheDocument();
  });

  it('filtre par catégorie via le premier select', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom(),
      makeRoom({ id: 'room-2', title: 'Chambre économique', category: 'ci-hotels' }),
    ]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.selectOptions(filters().category, 'ci-hotels');

    expect(screen.getByText('Chambre économique')).toBeInTheDocument();
    expect(screen.queryByText('Suite vue mer')).not.toBeInTheDocument();
  });

  it('filtre les chambres disponibles', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom(),
      makeRoom({ id: 'room-2', title: 'Chambre économique', disponible: false }),
    ]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.selectOptions(filters().status, 'true');

    expect(screen.getByText('Suite vue mer')).toBeInTheDocument();
    expect(screen.queryByText('Chambre économique')).not.toBeInTheDocument();
  });

  it('filtre les chambres occupées', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom(),
      makeRoom({ id: 'room-2', title: 'Chambre économique', disponible: false }),
    ]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.selectOptions(filters().status, 'false');

    expect(screen.getByText('Chambre économique')).toBeInTheDocument();
    expect(screen.queryByText('Suite vue mer')).not.toBeInTheDocument();
  });

  it('combine recherche et filtre de statut', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom(),
      makeRoom({ id: 'room-2', title: 'Suite familiale', disponible: false }),
    ]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.selectOptions(filters().status, 'false');
    await user.type(screen.getByPlaceholderText('Rechercher...'), 'suite');

    expect(screen.getByText('Suite familiale')).toBeInTheDocument();
    expect(screen.queryByText('Suite vue mer')).not.toBeInTheDocument();
  });

  it('bascule la disponibilité puis recharge la liste', async () => {
    mocks.fetchMyRooms
      .mockResolvedValueOnce([makeRoom()])
      .mockResolvedValueOnce([makeRoom({ disponible: false })]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Disponible' }));

    expect(mocks.toggleRoom).toHaveBeenCalledWith('room-1');
    expect(await screen.findByRole('button', { name: 'Occupée' })).toBeInTheDocument();
    expect(mocks.fetchMyRooms).toHaveBeenCalledTimes(2);
  });

  it('marque une chambre comme populaire', async () => {
    mocks.fetchMyRooms
      .mockResolvedValueOnce([makeRoom()])
      .mockResolvedValueOnce([makeRoom({ isPopular: true })]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: '☆' }));

    expect(mocks.updateRoom).toHaveBeenCalledWith('room-1', { isPopular: true });
    expect(
      await screen.findByRole('button', { name: '★ Populaire' }),
    ).toBeInTheDocument();
  });

  it('retire le marquage populaire d’une chambre mise en avant', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom({ isPopular: true }),
    ]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: '★ Populaire' }));

    expect(mocks.updateRoom).toHaveBeenCalledWith('room-1', { isPopular: false });
  });

  it('change la catégorie d’une chambre depuis la ligne', async () => {
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    const row = rowOf('Suite vue mer');
    await user.selectOptions(within(row).getByRole('combobox'), 'ci-hotels');

    expect(mocks.updateRoom).toHaveBeenCalledWith('room-1', {
      category: 'ci-hotels',
    });
    expect(mocks.fetchMyRooms).toHaveBeenCalledTimes(2);
  });

  it('ne supprime rien quand l’utilisateur annule la confirmation', async () => {
    confirmSpy!.mockReturnValue(false);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.click(
      within(rowOf('Suite vue mer')).getByRole('button', {
        name: 'Supprimer',
      }),
    );

    expect(window.confirm).toHaveBeenCalledWith('Supprimer cette chambre ?');
    expect(mocks.deleteRoom).not.toHaveBeenCalled();
    expect(mocks.fetchMyRooms).toHaveBeenCalledTimes(1);
  });

  it('supprime la chambre confirmée puis recharge la liste', async () => {
    // 1ᵉʳ appel : la chambre ; rechargement suivant : liste vide.
    mocks.fetchMyRooms.mockResolvedValue([]);
    mocks.fetchMyRooms.mockResolvedValueOnce([makeRoom()]);
    const user = userEvent.setup();
    renderChambres();
    await screen.findByRole('table');

    await user.click(
      within(rowOf('Suite vue mer')).getByRole('button', {
        name: 'Supprimer',
      }),
    );

    expect(mocks.deleteRoom).toHaveBeenCalledWith('room-1');
    expect(await screen.findByText('Aucune chambre trouvée')).toBeInTheDocument();
    expect(mocks.fetchMyRooms).toHaveBeenCalledTimes(2);
  });

  it("affiche l'état vide quand le chargement échoue", async () => {
    mocks.fetchMyRooms.mockRejectedValue(new Error('réseau coupé'));

    renderChambres();

    expect(await screen.findByText('Aucune chambre trouvée')).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('CI');
  });
});
