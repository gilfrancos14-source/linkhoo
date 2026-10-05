import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminReservationsPage from './AdminReservationsPage';
import type {
  AdminReservation,
  AdminReservationCounts,
  AdminReservationsResponse,
} from '../../lib/adminApi';

interface PageParams {
  statut?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const mocks = vi.hoisted(() => ({
  getReservations: vi.fn<(params?: PageParams) => Promise<AdminReservationsResponse>>(),
  checkAvailability: vi.fn<(id: string) => Promise<{ statut: string; reason: string | null }>>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    getReservations: mocks.getReservations,
    checkAvailability: mocks.checkAvailability,
  },
}));

function makeReservation(overrides: Partial<AdminReservation> = {}): AdminReservation {
  return {
    id: 'r-1',
    client_name: 'Aya Koné',
    client_email: 'aya@example.com',
    client_phone: '+225070102030',
    room_id: 'room-1',
    room_title: 'Suite vue mer',
    date_debut: '2026-02-10',
    date_fin: '2026-02-14',
    montant: 120000,
    message: 'Arrivée tardive',
    statut: 'en_attente',
    created_at: '2026-01-05T10:00:00.000Z',
    responded_at: null,
    gerant_id: 'g-1',
    ...overrides,
  };
}

const frDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

/** Même normalisation que le texte de l'DOM (espaces insécables → espace ASCII). */
const num = (n: number) => n.toLocaleString().replace(/\s+/g, ' ');

function makeMany(count: number): AdminReservation[] {
  return Array.from({ length: count }, (_, i) =>
    makeReservation({
      id: `r-${i + 1}`,
      client_name: `Client ${i + 1}`,
      client_email: `client${i + 1}@example.com`,
      room_title: `Chambre ${i + 1}`,
    }),
  );
}

/** Compteurs globaux (toutes lignes, indépendamment de la page courante). */
function countsOf(rows: AdminReservation[]): AdminReservationCounts {
  return {
    total: rows.length,
    pending: rows.filter((r) => r.statut === 'en_attente').length,
    confirmed: rows.filter((r) => r.statut === 'confirmee').length,
    cancelled: rows.filter((r) => r.statut === 'annulee').length,
  };
}

function makeResponse(
  items: AdminReservation[],
  overrides: Partial<AdminReservationsResponse> = {},
): AdminReservationsResponse {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 10,
    counts: countsOf(items),
    ...overrides,
  };
}

/**
 * Simule le contrat serveur de GET /api/admin/reservations (RPC SQL) :
 * filtre statut + recherche, pagination, compteurs globaux.
 */
function serverDataset(rows: AdminReservation[]): void {
  mocks.getReservations.mockImplementation(async (params = {}) => {
    const term = (params.search ?? '').toLowerCase();
    const searched = rows.filter((row) =>
      !term ||
      row.client_name.toLowerCase().includes(term) ||
      row.room_title?.toLowerCase().includes(term) ||
      row.client_email?.toLowerCase().includes(term),
    );
    const statut = params.statut && params.statut !== 'all' ? params.statut : undefined;
    const filtered = statut ? searched.filter((row) => row.statut === statut) : searched;
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
      counts: countsOf(rows),
    };
  });
}

/** Retourne la cellule/la ligne du tableau correspondant au client affiché. */
function rowOf(clientName: string) {
  const cell = screen.getByText(clientName);
  const row = cell.closest('tr');
  if (!row) throw new Error(`aucune ligne pour ${clientName}`);
  return within(row);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getReservations.mockResolvedValue(makeResponse([makeReservation()]));
  mocks.checkAvailability.mockResolvedValue({ statut: 'confirmee', reason: null });
});

afterEach(() => {
  cleanup();
});

describe('AdminReservationsPage', () => {
  it("affiche l'état de chargement tant que la liste n'est pas résolue", () => {
    mocks.getReservations.mockImplementation(() => new Promise<AdminReservationsResponse>(() => {}));

    render(<AdminReservationsPage />);

    expect(screen.getByRole('heading', { name: 'Réservations' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('affiche un tableau vide et des compteurs à zéro sans réservation', async () => {
    mocks.getReservations.mockResolvedValue(makeResponse([]));

    render(<AdminReservationsPage />);

    expect(await screen.findByText('Aucune réservation trouvée')).toBeInTheDocument();
    expect(screen.getByText('Gérants non qualifiés — 0 en attente')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4);
    expect(mocks.getReservations).toHaveBeenCalledTimes(1);
    expect(mocks.getReservations).toHaveBeenCalledWith({
      statut: 'all',
      search: '',
      page: 1,
      limit: 10,
    });
  });

  it('affiche une ligne complète pour chaque réservation', async () => {
    mocks.getReservations.mockResolvedValue(
      makeResponse([
        makeReservation(),
        makeReservation({
          id: 'r-2',
          client_name: 'Boli Traoré',
          client_email: 'boli@example.com',
          client_phone: '+22505050505',
          room_title: 'Studio Acacia',
          montant: 45000,
          statut: 'confirmee',
        }),
      ]),
    );

    render(<AdminReservationsPage />);

    expect(await screen.findByText('Aya Koné')).toBeInTheDocument();
    expect(screen.getByText('aya@example.com')).toBeInTheDocument();
    expect(screen.getByText('+225070102030')).toBeInTheDocument();
    expect(screen.getByText('Suite vue mer')).toBeInTheDocument();
    expect(screen.getByText(`${num(120000)} FCFA`)).toBeInTheDocument();

    expect(screen.getByText('Boli Traoré')).toBeInTheDocument();
    expect(screen.getByText('Studio Acacia')).toBeInTheDocument();
    expect(screen.getByText(`${num(45000)} FCFA`)).toBeInTheDocument();
    expect(screen.getByText('boli@example.com')).toBeInTheDocument();
  });

  it('affiche le badge de statut correspondant à chaque réservation', async () => {
    mocks.getReservations.mockResolvedValue(
      makeResponse([
        makeReservation({ id: 'r-1', statut: 'en_attente' }),
        makeReservation({ id: 'r-2', client_name: 'Boli Traoré', statut: 'confirmee' }),
        makeReservation({ id: 'r-3', client_name: 'Chef Moussa', statut: 'annulee' }),
      ]),
    );

    render(<AdminReservationsPage />);

    expect(await screen.findByText('Boli Traoré')).toBeInTheDocument();
    expect(rowOf('Aya Koné').getByText('En attente')).toBeInTheDocument();
    expect(rowOf('Boli Traoré').getByText('Confirmée')).toBeInTheDocument();
    expect(rowOf('Chef Moussa').getByText('Annulée')).toBeInTheDocument();
    expect(screen.getByText('Gérants non qualifiés — 1 en attente')).toBeInTheDocument();
    expect(screen.getByText('Confirmées')).toBeInTheDocument();
  });

  it('formate les dates de séjour et affiche un tiret si la date manque', async () => {
    mocks.getReservations.mockResolvedValue(
      makeResponse([
        makeReservation(),
        makeReservation({ id: 'r-2', date_debut: '', date_fin: '' }),
      ]),
    );

    render(<AdminReservationsPage />);

    expect(await screen.findByText(frDate('2026-02-10'))).toBeInTheDocument();
    expect(screen.getByText(`→ ${frDate('2026-02-14')}`)).toBeInTheDocument();
    // La date de fin est préfixée d'une flèche dans la cellule : son texte n'est donc pas « — » seul.
    expect(screen.getAllByText('—')).toHaveLength(1);
    expect(screen.getByText('→ —')).toBeInTheDocument();
  });

  it('masque le téléphone absent plutôt que d’afficher une valeur vide', async () => {
    mocks.getReservations.mockResolvedValue(
      makeResponse([
        makeReservation({ client_phone: null }),
        makeReservation({
          id: 'r-2',
          client_name: 'Boli Traoré',
          client_email: 'boli@example.com',
          client_phone: '+22501020304',
        }),
      ]),
    );

    render(<AdminReservationsPage />);

    expect(await screen.findByText('Boli Traoré')).toBeInTheDocument();
    expect(rowOf('Aya Koné').queryByText(/\+225/)).not.toBeInTheDocument();
    expect(rowOf('Aya Koné').getByText('aya@example.com')).toBeInTheDocument();
    expect(rowOf('Boli Traoré').getByText('+22501020304')).toBeInTheDocument();
  });

  it('filtre par statut en reinterrogeant le serveur avec le bon paramètre', async () => {
    serverDataset([
      makeReservation({ id: 'r-1', statut: 'en_attente' }),
      makeReservation({ id: 'r-2', client_name: 'Boli Traoré', statut: 'confirmee' }),
    ]);
    const user = userEvent.setup();

    render(<AdminReservationsPage />);
    expect(await screen.findByText('Boli Traoré')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), 'confirmee');

    await waitFor(() => expect(screen.queryByText('Aya Koné')).not.toBeInTheDocument());
    expect(screen.getByText('Boli Traoré')).toBeInTheDocument();
    expect(screen.queryByText('Aucune réservation trouvée')).not.toBeInTheDocument();
    expect(mocks.getReservations).toHaveBeenCalledWith({
      statut: 'confirmee',
      search: '',
      page: 1,
      limit: 10,
    });
  });

  it('filtre par nom de client (insensible à la casse) côté serveur', async () => {
    serverDataset([
      makeReservation({ id: 'r-1', statut: 'en_attente' }),
      makeReservation({
        id: 'r-2',
        client_name: 'Boli Traoré',
        client_email: 'boli@example.com',
        statut: 'confirmee',
      }),
    ]);
    const user = userEvent.setup();

    render(<AdminReservationsPage />);
    await screen.findByText('Boli Traoré');

    await user.type(screen.getByPlaceholderText('Rechercher par client ou chambre...'), 'AYA');

    await waitFor(() => expect(screen.queryByText('Boli Traoré')).not.toBeInTheDocument());
    expect(screen.getByText('Aya Koné')).toBeInTheDocument();
    expect(mocks.getReservations).toHaveBeenCalledWith({
      statut: 'all',
      search: 'AYA',
      page: 1,
      limit: 10,
    });
  });

  it('filtre par chambre et par email du client', async () => {
    serverDataset([
      makeReservation(),
      makeReservation({
        id: 'r-2',
        client_name: 'Boli Traoré',
        client_email: 'boli@example.com',
        room_title: 'Loft Plateau',
      }),
    ]);
    const user = userEvent.setup();

    render(<AdminReservationsPage />);
    const input = await screen.findByPlaceholderText('Rechercher par client ou chambre...');

    await user.type(input, 'loft');
    await waitFor(() => expect(screen.queryByText('Aya Koné')).not.toBeInTheDocument());
    expect(screen.getByText('Boli Traoré')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'AYA@EXAMPLE');
    await waitFor(() => expect(screen.queryByText('Boli Traoré')).not.toBeInTheDocument());
    expect(screen.getByText('Aya Koné')).toBeInTheDocument();
  });

  it('affiche l’état vide quand la recherche ne correspond à rien', async () => {
    serverDataset([makeReservation()]);
    const user = userEvent.setup();

    render(<AdminReservationsPage />);
    await screen.findByText('Aya Koné');

    await user.type(
      screen.getByPlaceholderText('Rechercher par client ou chambre...'),
      'introuvable',
    );

    expect(await screen.findByText('Aucune réservation trouvée')).toBeInTheDocument();
    expect(screen.queryByText('Aya Koné')).not.toBeInTheDocument();
  });

  it('maintient les compteurs globaux même quand le tableau est filtré', async () => {
    serverDataset([
      makeReservation({ id: 'r-1', statut: 'en_attente' }),
      makeReservation({
        id: 'r-2',
        client_name: 'Boli Traoré',
        client_email: 'boli@example.com',
        statut: 'confirmee',
      }),
    ]);
    const user = userEvent.setup();

    render(<AdminReservationsPage />);
    expect(await screen.findByText('Boli Traoré')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Rechercher par client ou chambre...'), 'AYA');

    await waitFor(() => expect(screen.queryByText('Boli Traoré')).not.toBeInTheDocument());
    // Les cartes restent globales (counts SQL sur toutes les lignes).
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Gérants non qualifiés — 1 en attente')).toBeInTheDocument();
  });

  it('ne propose la vérification de disponibilité que pour les réservations en attente', async () => {
    mocks.getReservations.mockResolvedValue(
      makeResponse([
        makeReservation({ id: 'r-1', statut: 'en_attente' }),
        makeReservation({ id: 'r-2', client_name: 'Boli Traoré', statut: 'confirmee' }),
        makeReservation({ id: 'r-3', client_name: 'Chef Moussa', statut: 'annulee' }),
      ]),
    );

    render(<AdminReservationsPage />);

    expect(await screen.findByRole('button', { name: 'Vérifier dispo' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Vérifier dispo' })).toHaveLength(1);
    expect(mocks.checkAvailability).not.toHaveBeenCalled();
  });

  it('passe la réservation en confirmée après une vérification réussie', async () => {
    const user = userEvent.setup();
    render(<AdminReservationsPage />);

    expect(await screen.findByText('Aya Koné')).toBeInTheDocument();
    expect(rowOf('Aya Koné').getByText('En attente')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Vérifier dispo' }));

    expect(await rowOf('Aya Koné').findByText('Confirmée')).toBeInTheDocument();
    expect(mocks.checkAvailability).toHaveBeenCalledTimes(1);
    expect(mocks.checkAvailability).toHaveBeenCalledWith('r-1');
    expect(screen.queryByRole('button', { name: 'Vérifier dispo' })).not.toBeInTheDocument();
    expect(screen.getByText('Gérants non qualifiés — 0 en attente')).toBeInTheDocument();
  });

  it('désactive le bouton de vérification pendant la requête', async () => {
    let resolveCheck: (value: { statut: string; reason: string | null }) => void = () => {};
    mocks.checkAvailability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    const user = userEvent.setup();

    render(<AdminReservationsPage />);
    await user.click(await screen.findByRole('button', { name: 'Vérifier dispo' }));

    const busy = await screen.findByRole('button', { name: '...' });
    expect(busy).toBeDisabled();

    resolveCheck({ statut: 'annulee', reason: 'conflit_dates' });
    expect(await rowOf('Aya Koné').findByText('Annulée')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '...' })).not.toBeInTheDocument();
  });

  it("conserve la réservation quand la vérification échoue", async () => {
    mocks.checkAvailability.mockRejectedValue(new Error('API KO'));
    const user = userEvent.setup();

    render(<AdminReservationsPage />);
    await user.click(await screen.findByRole('button', { name: 'Vérifier dispo' }));

    await waitFor(() => expect(mocks.checkAvailability).toHaveBeenCalledTimes(1));
    expect(await rowOf('Aya Koné').findByText('En attente')).toBeInTheDocument();
    expect(screen.queryByText('API KO')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vérifier dispo' })).toBeEnabled();
  });

  it('affiche un tableau vide quand le chargement initial échoue', async () => {
    mocks.getReservations.mockRejectedValue(new Error('réseau coupé'));

    render(<AdminReservationsPage />);

    expect(await screen.findByText('Aucune réservation trouvée')).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('pagine les réservations au-delà de dix lignes côté serveur', async () => {
    serverDataset(makeMany(25));
    const user = userEvent.setup();

    render(<AdminReservationsPage />);

    expect(await screen.findByText('Client 1')).toBeInTheDocument();
    expect(screen.getByText('Client 10')).toBeInTheDocument();
    expect(screen.queryByText('Client 11')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '←' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(await screen.findByText('Client 11')).toBeInTheDocument();
    expect(screen.getByText('Client 20')).toBeInTheDocument();
    expect(screen.queryByText('Client 1')).not.toBeInTheDocument();
    expect(mocks.getReservations).toHaveBeenCalledWith({
      statut: 'all',
      search: '',
      page: 2,
      limit: 10,
    });
    expect(screen.getByRole('button', { name: '2' })).toHaveClass(
      'admin-pagination__btn--active',
    );
    expect(screen.getByRole('button', { name: '→' })).toBeEnabled();
  });

  it('avance puis recule d’une page avec les flèches de pagination', async () => {
    serverDataset(makeMany(25));
    const user = userEvent.setup();

    render(<AdminReservationsPage />);
    await screen.findByText('Client 1');

    await user.click(screen.getByRole('button', { name: '→' }));
    expect(await screen.findByText('Client 11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '←' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '←' }));
    expect(await screen.findByText('Client 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '3' }));
    expect(await screen.findByText('Client 21')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '→' })).toBeDisabled();
  });

  it('revient à la première page quand la recherche change', async () => {
    serverDataset(makeMany(25));
    const user = userEvent.setup();

    render(<AdminReservationsPage />);
    await screen.findByText('Client 1');
    await user.click(screen.getByRole('button', { name: '2' }));
    await screen.findByText('Client 11');

    await user.type(
      screen.getByPlaceholderText('Rechercher par client ou chambre...'),
      'chambre',
    );

    expect(await screen.findByText('Client 1')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Client 11')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '←' })).toBeDisabled();
    expect(mocks.getReservations).toHaveBeenCalledWith({
      statut: 'all',
      search: 'chambre',
      page: 1,
      limit: 10,
    });
  });

  it('n’affiche pas les boutons de pagination avec dix réservations ou moins', async () => {
    serverDataset(makeMany(10));

    render(<AdminReservationsPage />);

    expect(await screen.findByText('Client 10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '←' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '→' })).not.toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    // 1 ligne d'en-tête + 10 lignes de données
    expect(rows).toHaveLength(11);
    expect(within(rows[1]).getByText('Client 1')).toBeInTheDocument();
  });
});
