import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPromotionsPage from './AdminPromotionsPage';
import type { RoomData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn<(market?: string, opts?: { fresh?: boolean }) => Promise<RoomData[]>>(),
  updateRoomPromoGroup: vi.fn<
    (
      roomId: string,
      data: {
        promo_group: string | null;
        promo_start?: string | null;
        promo_end?: string | null;
      },
    ) => Promise<Partial<RoomData>>
  >(),
}));

vi.mock('../../lib/api', () => ({
  apiRooms: { list: mocks.list },
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: { updateRoomPromoGroup: mocks.updateRoomPromoGroup },
}));

function makeRoom(overrides: Partial<RoomData> = {}): RoomData {
  return {
    id: 'room-1',
    title: 'Suite Lagune',
    subtitle: 'Vue lagune',
    info: '',
    price: '45 000',
    price_num: 45000,
    price_unit: 'FCFA / nuit',
    img: '/img/suite.jpg',
    alt: 'Suite Lagune',
    images: [],
    description: '',
    capacity: '2',
    category: 'Suite',
    market: 'CI',
    pays: "Côte d'Ivoire",
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    date_dispo: '',
    conditions: '',
    gerant: {
      nom: 'Koné',
      prenom: 'Awa',
      phone: null,
      is_verified: true,
      is_premium: false,
    },
    promo_group: null,
    promo_start: null,
    promo_end: null,
    ...overrides,
  };
}

const available = makeRoom();
const activePromo = makeRoom({
  id: 'room-2',
  title: 'Studio Acacia',
  promo_group: 'promo_15',
  promo_start: '2026-01-01T00:00:00.000Z',
  promo_end: '2027-12-31T00:00:00.000Z',
});
const expiredPromo = makeRoom({
  id: 'room-3',
  title: 'Loft Expiré',
  promo_group: 'promo_15',
  promo_start: '2019-01-01T00:00:00.000Z',
  promo_end: '2020-01-01T00:00:00.000Z',
});
const noDatePromo = makeRoom({
  id: 'room-4',
  title: 'Chambre Sans date',
  promo_group: 'promo_15',
  promo_start: null,
  promo_end: null,
  gerant: { nom: 'Moussa', prenom: 'Boli', phone: null, is_verified: true, is_premium: false },
});

const threeInGroup = [available, activePromo, expiredPromo, noDatePromo];

/** Deux tableaux sont rendus : [0] = chambres du groupe, [1] = chambres disponibles. */
function groupTable() {
  return within(screen.getAllByRole('table')[0]);
}

function availTable() {
  return within(screen.getAllByRole('table')[1]);
}

function rowIn(scope: ReturnType<typeof within>, title: string) {
  const cell = scope.getByText(title);
  const row = cell.closest('tr');
  if (!row) throw new Error(`aucune ligne pour ${title}`);
  return within(row as HTMLElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue(threeInGroup);
  mocks.updateRoomPromoGroup.mockImplementation(async (roomId, data) => ({
    ...data,
    id: roomId,
  }));
});

afterEach(() => {
  cleanup();
});

describe('AdminPromotionsPage', () => {
  it("affiche l'état de chargement tant que les chambres ne sont pas résolues", () => {
    mocks.list.mockImplementation(() => new Promise<RoomData[]>(() => {}));

    render(<AdminPromotionsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Promotions' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("affiche l'erreur quand la liste des chambres échoue", async () => {
    mocks.list.mockRejectedValue(new Error('réseau coupé'));

    render(<AdminPromotionsPage />);

    expect(await screen.findByText('Impossible de charger les chambres.')).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('demande les chambres fraîches du marché CI par défaut', async () => {
    render(<AdminPromotionsPage />);

    expect(await screen.findByText('Suite Lagune')).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledWith('CI', { fresh: true });
  });

  it('sépare les chambres du groupe des chambres disponibles', async () => {
    render(<AdminPromotionsPage />);

    expect(await screen.findByText('Suite Lagune')).toBeInTheDocument();
    expect(screen.getByText(/Chambres dans Offres à -15 %/)).toBeInTheDocument();
    expect(screen.getByText('Chambres disponibles')).toBeInTheDocument();

    expect(groupTable().getByText('Studio Acacia')).toBeInTheDocument();
    expect(groupTable().getByText('Loft Expiré')).toBeInTheDocument();
    expect(groupTable().getByText('Chambre Sans date')).toBeInTheDocument();
    expect(groupTable().getAllByRole('row')).toHaveLength(4);

    expect(availTable().getByText('Suite Lagune')).toBeInTheDocument();
    expect(availTable().queryByText('Studio Acacia')).not.toBeInTheDocument();
    expect(availTable().getAllByRole('row')).toHaveLength(2);
  });

  it('compte les chambres dans chaque onglet de promotion', async () => {
    render(<AdminPromotionsPage />);

    expect(await screen.findByText('Suite Lagune')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^-15 %/ })).toHaveTextContent('-15 %3');
    expect(screen.getByRole('button', { name: /^-10 %/ })).toHaveTextContent('-10 %0');
    expect(screen.getByRole('button', { name: /^-5 %/ })).toHaveTextContent('-5 %0');
    expect(screen.getByRole('button', { name: /^-15 %/ })).toHaveClass(
      'gerants-filter-card__tab--active',
    );
  });

  it('bascule d’onglet sans recharger la liste et vide le groupe courant', async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Suite Lagune');

    await user.click(screen.getByRole('button', { name: /^-10 %/ }));

    expect(screen.getByText(/Chambres dans Offres à -10 %/)).toBeInTheDocument();
    expect(
      screen.getByText('Aucune chambre assignée à cette promotion. Ajoutez des chambres ci-dessous.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByText('Suite Lagune')).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /^-10 %/ })).toHaveClass(
      'gerants-filter-card__tab--active',
    );
  });

  it('recharge les chambres quand le marché change', async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Suite Lagune');

    await user.selectOptions(screen.getByRole('combobox'), 'BJ');

    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith('BJ', { fresh: true }));
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it('filtre les deux tableaux par titre de chambre', async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Suite Lagune');

    await user.type(
      screen.getByPlaceholderText('Nom du chambre ou du gérant...'),
      'acacia',
    );

    expect(groupTable().getByText('Studio Acacia')).toBeInTheDocument();
    expect(groupTable().queryByText('Loft Expiré')).not.toBeInTheDocument();
    expect(screen.queryByText('Suite Lagune')).not.toBeInTheDocument();
    expect(
      screen.getByText('Aucune chambre disponible à ajouter.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });

  it('filtre aussi par nom de gérant', async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Suite Lagune');

    await user.type(
      screen.getByPlaceholderText('Nom du chambre ou du gérant...'),
      'BOLI',
    );

    expect(screen.queryByText('Studio Acacia')).not.toBeInTheDocument();
    expect(screen.queryByText('Suite Lagune')).not.toBeInTheDocument();
    expect(screen.getByText('Chambre Sans date')).toBeInTheDocument();
    expect(screen.getByText('Boli Moussa')).toBeInTheDocument();
  });

  it('affiche l’état des périodes : active, expirée, sans date', async () => {
    render(<AdminPromotionsPage />);

    expect(await screen.findByText('Studio Acacia')).toBeInTheDocument();
    expect(rowIn(groupTable(), 'Studio Acacia').getByText('Active')).toBeInTheDocument();
    expect(rowIn(groupTable(), 'Loft Expiré').getByText('Expirée')).toBeInTheDocument();
    expect(rowIn(groupTable(), 'Chambre Sans date').getByText('Sans date')).toBeInTheDocument();
  });

  it('assigne une chambre disponible au groupe courant', async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Suite Lagune');

    await user.click(rowIn(availTable(), 'Suite Lagune').getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => expect(mocks.updateRoomPromoGroup).toHaveBeenCalledTimes(1));
    expect(mocks.updateRoomPromoGroup).toHaveBeenCalledWith('room-1', {
      promo_group: 'promo_15',
      promo_start: expect.any(String),
      promo_end: null,
    });
    expect(await groupTable().findByText('Suite Lagune')).toBeInTheDocument();
    expect(screen.getByText('Aucune chambre disponible à ajouter.')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('retire une chambre du groupe courant', async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Studio Acacia');

    await user.click(rowIn(groupTable(), 'Studio Acacia').getByRole('button', { name: 'Retirer' }));

    await waitFor(() => expect(mocks.updateRoomPromoGroup).toHaveBeenCalledTimes(1));
    expect(mocks.updateRoomPromoGroup).toHaveBeenCalledWith('room-2', {
      promo_group: null,
      promo_start: null,
      promo_end: null,
    });
    expect(await availTable().findByText('Studio Acacia')).toBeInTheDocument();
    expect(groupTable().queryByText('Studio Acacia')).not.toBeInTheDocument();
  });

  it("affiche une erreur quand l'assignation échoue", async () => {
    mocks.updateRoomPromoGroup.mockRejectedValue(new Error('403'));
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Suite Lagune');

    await user.click(rowIn(availTable(), 'Suite Lagune').getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText('Erreur lors de la mise à jour.')).toBeInTheDocument();
    expect(availTable().getByText('Suite Lagune')).toBeInTheDocument();
    expect(mocks.updateRoomPromoGroup).toHaveBeenCalledTimes(1);
  });

  it("désactive le bouton pendant l'enregistrement", async () => {
    let resolveUpdate: (value: Partial<RoomData>) => void = () => {};
    mocks.updateRoomPromoGroup.mockImplementation(
      () =>
        new Promise<Partial<RoomData>>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Suite Lagune');

    await user.click(rowIn(availTable(), 'Suite Lagune').getByRole('button', { name: 'Ajouter' }));

    const busy = await rowIn(availTable(), 'Suite Lagune').findByRole('button', { name: '...' });
    expect(busy).toBeDisabled();

    resolveUpdate({ id: 'room-1', promo_group: 'promo_15' });
    expect(await groupTable().findByText('Suite Lagune')).toBeInTheDocument();
  });

  it('ouvre la période promo pré-remplie puis l’enregistre', async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Studio Acacia');

    await user.click(
      rowIn(groupTable(), 'Studio Acacia').getByRole('button', { name: 'Dates' }),
    );

    expect(await screen.findByText('Définir la période promotionnelle')).toBeInTheDocument();
    const [startInput, endInput] = document.querySelectorAll<HTMLInputElement>(
      'input[type="datetime-local"]',
    );
    expect(startInput).toHaveValue('2026-01-01T00:00');
    expect(endInput).toHaveValue('2027-12-31T00:00');

    fireEvent.change(startInput, { target: { value: '2026-06-15T08:30' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.updateRoomPromoGroup).toHaveBeenCalledTimes(1));
    expect(mocks.updateRoomPromoGroup).toHaveBeenCalledWith('room-2', {
      promo_group: 'promo_15',
      promo_start: new Date('2026-06-15T08:30').toISOString(),
      promo_end: new Date('2027-12-31T00:00').toISOString(),
    });
    expect(
      screen.queryByText('Définir la période promotionnelle'),
    ).not.toBeInTheDocument();
  });

  it('ferme la période promo sans rien appeler quand on annule', async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Chambre Sans date');

    await user.click(
      rowIn(groupTable(), 'Chambre Sans date').getByRole('button', { name: 'Dates' }),
    );
    expect(await screen.findByText('Définir la période promotionnelle')).toBeInTheDocument();
    const [startInput, endInput] = document.querySelectorAll<HTMLInputElement>(
      'input[type="datetime-local"]',
    );
    expect(startInput).toHaveValue('');
    expect(endInput).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(
      screen.queryByText('Définir la période promotionnelle'),
    ).not.toBeInTheDocument();
    expect(mocks.updateRoomPromoGroup).not.toHaveBeenCalled();
  });

  it("affiche une erreur quand la sauvegarde des dates échoue", async () => {
    mocks.updateRoomPromoGroup.mockRejectedValue(new Error('403'));
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);
    await screen.findByText('Studio Acacia');

    await user.click(
      rowIn(groupTable(), 'Studio Acacia').getByRole('button', { name: 'Dates' }),
    );
    await screen.findByText('Définir la période promotionnelle');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('Erreur lors de la sauvegarde des dates.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Définir la période promotionnelle')).toBeInTheDocument();
  });

  it('affiche l’état vide du groupe quand aucune chambre n’est en promotion', async () => {
    mocks.list.mockResolvedValue([available]);

    render(<AdminPromotionsPage />);

    expect(await screen.findByText('Suite Lagune')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(
      screen.getByText('Aucune chambre assignée à cette promotion. Ajoutez des chambres ci-dessous.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Chambres disponibles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^-15 %/ })).toHaveTextContent('-15 %0');
    expect(screen.getByRole('button', { name: /^-10 %/ })).toHaveTextContent('-10 %0');
  });
});
