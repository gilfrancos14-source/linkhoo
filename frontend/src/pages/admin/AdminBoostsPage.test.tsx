import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminBoostsPage from './AdminBoostsPage';
import type { AdminBoostItem } from '../../lib/adminApi';

const mocks = vi.hoisted(() => ({
  getBoosts: vi.fn<(params?: { status?: string; market?: string }) => Promise<{ items: AdminBoostItem[] }>>(),
  setBoostStatus: vi.fn<
    (
      id: string,
      status: 'active' | 'paused',
    ) => Promise<{
      id: string;
      status: string;
      display_status: string;
      spent: number;
      remaining: number;
    }>
  >(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: { getBoosts: mocks.getBoosts, setBoostStatus: mocks.setBoostStatus },
}));

function makeBoost(overrides: Partial<AdminBoostItem> = {}): AdminBoostItem {
  const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: 'b-1',
    market: 'CI',
    room_id: 'room-1',
    mode: 'cpc',
    status: 'active',
    display_status: 'live',
    budget_total: 3000,
    spent: 500,
    remaining: 2500,
    starts_at: start,
    ends_at: end,
    activated_at: start,
    created_at: start,
    room: {
      id: 'room-1',
      title: 'Suite Plateau',
      price: '45 000 FCFA',
      price_num: 45000,
      img: null,
      ville: 'Abidjan',
      quartier: 'Plateau',
      market: 'CI',
      disponible: true,
    },
    gerant: { nom: 'Kouassi', prenom: 'Awa', email: 'awa@ilehya.ci', phone: null },
    ...overrides,
  };
}

function rowFor(title: string) {
  const cell = screen.getByText(title);
  const row = cell.closest('tr');
  if (!row) throw new Error(`aucune ligne pour ${title}`);
  return within(row as HTMLElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBoosts.mockResolvedValue({ items: [makeBoost()] });
  mocks.setBoostStatus.mockResolvedValue({
    id: 'b-1',
    status: 'paused',
    display_status: 'paused',
    spent: 500,
    remaining: 2500,
  });
});

afterEach(() => {
  cleanup();
});

describe('AdminBoostsPage', () => {
  it("affiche l'état de chargement tant que la liste n'est pas résolue", () => {
    mocks.getBoosts.mockImplementation(() => new Promise(() => {}));

    render(<AdminBoostsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Booster' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('liste les campagnes avec gérant, marché, mode, budget et période', async () => {
    render(<AdminBoostsPage />);

    expect(await screen.findByText('Suite Plateau')).toBeInTheDocument();
    const row = rowFor('Suite Plateau');
    expect(row.getByText('Awa Kouassi')).toBeInTheDocument();
    expect(row.getByText('CI')).toBeInTheDocument();
    expect(row.getByText('Par clic')).toBeInTheDocument();
    expect(row.getByText('En ligne')).toBeInTheDocument();
    expect(row.getByText('500 F / 3 000 F')).toBeInTheDocument();
    expect(row.getByText(/^du .+ au .+$/)).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Suspendre' })).toBeInTheDocument();
  });

  it("tombe sur l'e-mail du gérant quand le nom est absent", async () => {
    mocks.getBoosts.mockResolvedValue({
      items: [
        makeBoost({
          id: 'b-2',
          gerant: { nom: null, prenom: null, email: 'contact@hotel.ci', phone: null },
        }),
      ],
    });

    render(<AdminBoostsPage />);

    expect(await screen.findByText('contact@hotel.ci')).toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun filtre ne renvoie de campagne", async () => {
    mocks.getBoosts.mockResolvedValue({ items: [] });

    render(<AdminBoostsPage />);

    expect(await screen.findByText('Aucune campagne pour ces filtres.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('signale un échec de chargement puis permet de réessayer', async () => {
    mocks.getBoosts.mockRejectedValueOnce(new Error('réseau'));
    render(<AdminBoostsPage />);

    expect(await screen.findByText('Impossible de charger les campagnes.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Suite Plateau')).toBeInTheDocument();
    expect(screen.queryByText('Impossible de charger les campagnes.')).not.toBeInTheDocument();
  });

  it('transmet le filtre de statut au serveur', async () => {
    render(<AdminBoostsPage />);
    await screen.findByText('Suite Plateau');

    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'paused' } });

    await waitFor(() => expect(mocks.getBoosts).toHaveBeenCalledTimes(2));
    expect(mocks.getBoosts.mock.calls[1][0]).toEqual({ status: 'paused', market: undefined });
  });

  it('transmet le filtre de marché au serveur', async () => {
    render(<AdminBoostsPage />);
    await screen.findByText('Suite Plateau');

    fireEvent.change(screen.getByLabelText('Marché'), { target: { value: 'BJ' } });

    await waitFor(() => expect(mocks.getBoosts).toHaveBeenCalledTimes(2));
    expect(mocks.getBoosts.mock.calls[1][0]).toEqual({ status: undefined, market: 'BJ' });
  });

  it('suspend une campagne active puis repropage le statut', async () => {
    render(<AdminBoostsPage />);
    await screen.findByText('Suite Plateau');

    fireEvent.click(screen.getByRole('button', { name: 'Suspendre' }));

    await waitFor(() => expect(mocks.setBoostStatus).toHaveBeenCalledWith('b-1', 'paused'));
    const row = rowFor('Suite Plateau');
    expect(await row.findByText('En pause')).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reprend une campagne en pause', async () => {
    mocks.getBoosts.mockResolvedValue({
      items: [makeBoost({ status: 'paused', display_status: 'paused' })],
    });
    mocks.setBoostStatus.mockResolvedValue({
      id: 'b-1',
      status: 'active',
      display_status: 'live',
      spent: 500,
      remaining: 2500,
    });

    render(<AdminBoostsPage />);
    await screen.findByText('Suite Plateau');

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));

    await waitFor(() => expect(mocks.setBoostStatus).toHaveBeenCalledWith('b-1', 'active'));
    expect(await rowFor('Suite Plateau').findByText('En ligne')).toBeInTheDocument();
  });

  it('affiche le refus 409 du serveur sans modifier la ligne', async () => {
    mocks.setBoostStatus.mockRejectedValue(
      new Error('Budget épuisé : reprise impossible.'),
    );
    render(<AdminBoostsPage />);
    await screen.findByText('Suite Plateau');

    fireEvent.click(screen.getByRole('button', { name: 'Suspendre' }));

    expect(
      await screen.findByText('Budget épuisé : reprise impossible.'),
    ).toBeInTheDocument();
    const row = rowFor('Suite Plateau');
    expect(row.getByText('En ligne')).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Suspendre' })).toBeEnabled();
  });

  it('ne propose aucune action sur une campagne non modifiable', async () => {
    mocks.getBoosts.mockResolvedValue({
      items: [
        makeBoost({
          id: 'b-pending',
          status: 'pending',
          display_status: 'pending',
          room: { ...makeBoost().room!, title: 'Chambre En attente' },
        }),
        makeBoost({
          id: 'b-canceled',
          status: 'canceled',
          display_status: 'canceled',
          room: { ...makeBoost().room!, title: 'Chambre Annulée' },
        }),
        makeBoost({
          id: 'b-exhausted',
          status: 'exhausted',
          display_status: 'exhausted',
          room: { ...makeBoost().room!, title: 'Chambre Épuisée' },
        }),
      ],
    });

    render(<AdminBoostsPage />);
    const table = within(await screen.findByRole('table'));

    expect(mocks.setBoostStatus).not.toHaveBeenCalled();
    for (const label of ['Paiement en attente', 'Annulée', 'Budget épuisé']) {
      const cell = table.getByText(label);
      const row = cell.closest('tr');
      expect(within(row as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
      expect(within(row as HTMLElement).getByText('—')).toBeInTheDocument();
    }
  });
});
