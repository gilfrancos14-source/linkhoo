import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminGerantsPage from './AdminGerantsPage';
import type { AdminGerant } from '../../lib/adminApi';

const mocks = vi.hoisted(() => ({
  getGerants: vi.fn<(params?: Record<string, string>) => Promise<AdminGerant[]>>(),
  revokeGerantVerification: vi.fn<(id: string) => Promise<AdminGerant>>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    getGerants: mocks.getGerants,
    revokeGerantVerification: mocks.revokeGerantVerification,
  },
}));

// Le vrai drawer importe react-leaflet : on ne teste ici que son ouverture depuis la page.
vi.mock('../../components/AdminGerantDrawer', () => ({
  default: ({
    gerant,
    onClose,
    onUpdated,
  }: {
    gerant: AdminGerant;
    onClose: () => void;
    onUpdated: (g: AdminGerant) => void;
  }) => (
    <div data-testid="gerant-drawer">
      <p>{gerant.email}</p>
      <button type="button" onClick={onClose}>
        Fermer le drawer
      </button>
      <button
        type="button"
        onClick={() => onUpdated({ ...gerant, nom: 'Nom mis à jour' })}
      >
        Simuler mise à jour
      </button>
    </div>
  ),
}));

function makeGerant(overrides: Partial<AdminGerant> = {}): AdminGerant {
  return {
    id: 'g-1',
    email: 'awa.kone@ilehya.ci',
    nom: 'Koné',
    prenom: 'Awa',
    phone: '+225070102030',
    market: 'CI',
    is_verified: false,
    verified_at: null,
    verification_requested_at: null,
    verification_status: 'pending',
    verification_rejection_reason: null,
    verification_submitted_at: '2026-01-10T09:00:00.000Z',
    verification_reviewed_at: null,
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    is_premium: false,
    premium_expires_at: null,
    created_at: '2025-12-01T00:00:00.000Z',
    ...overrides,
  };
}

const fourGerants: AdminGerant[] = [
  makeGerant(),
  makeGerant({
    id: 'g-2',
    email: 'boli.tratore@ilehya.bj',
    nom: 'Traoré',
    prenom: 'Boli',
    market: 'BJ',
    verification_status: 'under_review',
    verification_submitted_at: null,
  }),
  makeGerant({
    id: 'g-3',
    email: 'chef.moussa@ilehya.ci',
    nom: 'Moussa',
    prenom: 'Chef',
    verification_status: 'approved',
    is_verified: true,
    verified_at: '2026-01-15T00:00:00.000Z',
  }),
  makeGerant({
    id: 'g-4',
    email: 'fatou.diallo@ilehya.bj',
    nom: 'Diallo',
    prenom: 'Fatou',
    market: 'BJ',
    verification_status: 'rejected',
    verification_rejection_reason: 'Document illisible',
    verification_submitted_at: '2026-01-12T08:00:00.000Z',
  }),
];

const frDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

/**
 * La page rend à la fois un tableau desktop et des cartes mobiles avec les mêmes textes :
 * toutes les assertions de contenu sont cadrées sur le tableau.
 */
function desktop() {
  return within(screen.getByRole('table'));
}

async function desktopReady() {
  return within(await screen.findByRole('table'));
}

/** Ligne (au format RTL) du tableau correspondant à un gérant affiché. */
async function rowOf(name: string) {
  const scope = await desktopReady();
  const cell = scope.getByText(name);
  const row = cell.closest('tr');
  if (!row) throw new Error(`aucune ligne pour ${name}`);
  return within(row as HTMLElement);
}

function tab(name: RegExp) {
  return screen.getByRole('button', { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getGerants.mockResolvedValue(fourGerants);
  mocks.revokeGerantVerification.mockImplementation(async (id) => {
    const found = fourGerants.find((g) => g.id === id) ?? fourGerants[0];
    return { ...found, is_verified: false, verification_status: 'none', verified_at: null };
  });
});

afterEach(() => {
  cleanup();
});

describe('AdminGerantsPage', () => {
  it("affiche l'état de chargement tant que la liste n'est pas résolue", () => {
    mocks.getGerants.mockImplementation(() => new Promise<AdminGerant[]>(() => {}));

    render(<AdminGerantsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Gérants' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("affiche l'erreur quand la liste des gérants ne peut pas être chargée", async () => {
    mocks.getGerants.mockRejectedValue(new Error('réseau coupé'));

    render(<AdminGerantsPage />);

    expect(
      await screen.findByText('Impossible de charger la liste des gérants.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun gérant n'existe", async () => {
    mocks.getGerants.mockResolvedValue([]);

    render(<AdminGerantsPage />);

    expect(await screen.findByText('Aucun gérant trouvé.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mocks.getGerants).toHaveBeenCalledWith({});
  });

  it('affiche une ligne par gérant avec son identité, son marché et son statut', async () => {
    render(<AdminGerantsPage />);

    const scope = await desktopReady();
    expect(scope.getByText('Awa Koné')).toBeInTheDocument();
    expect(scope.getByText('awa.kone@ilehya.ci')).toBeInTheDocument();
    expect(scope.getByText('Boli Traoré')).toBeInTheDocument();
    expect(scope.getByText('fatou.diallo@ilehya.bj')).toBeInTheDocument();

    expect(scope.getAllByText('CI')).toHaveLength(2);
    expect(scope.getAllByText('BJ')).toHaveLength(2);
    expect(scope.getByText('En attente')).toBeInTheDocument();
    expect(scope.getByText('En révision')).toBeInTheDocument();
    expect(scope.getByText('Vérifié')).toBeInTheDocument();
    expect(scope.getByText('Rejeté')).toBeInTheDocument();
    expect(scope.getAllByRole('row')).toHaveLength(5);
  });

  it('affiche les dates d’inscription et de soumission, avec un tiret si elle manque', async () => {
    render(<AdminGerantsPage />);

    const scope = await desktopReady();
    // Tous les gérants sont inscrits le même jour, deux sont soumis le 10/01.
    expect(scope.getAllByText(frDate('2025-12-01T00:00:00.000Z'))).toHaveLength(4);
    expect(scope.getAllByText(frDate('2026-01-10T09:00:00.000Z'))).toHaveLength(2);
    expect(scope.getAllByText(frDate('2026-01-12T08:00:00.000Z'))).toHaveLength(1);
    expect(scope.getAllByText('—')).toHaveLength(1);
  });

  it('compte les gérants dans chaque onglet de statut', async () => {
    render(<AdminGerantsPage />);

    await desktopReady();
    expect(tab(/^Tous/)).toHaveTextContent('4');
    expect(tab(/^En attente/)).toHaveTextContent('1');
    expect(tab(/^En révision/)).toHaveTextContent('1');
    expect(tab(/^Vérifiés/)).toHaveTextContent('1');
    expect(tab(/^Rejetés/)).toHaveTextContent('1');
    expect(tab(/^Tous/)).toHaveClass('gerants-filter-card__tab--active');
  });

  it('recharge la liste avec le bon filtre de vérification au changement d’onglet', async () => {
    const user = userEvent.setup();
    render(<AdminGerantsPage />);
    await desktopReady();
    expect(mocks.getGerants).toHaveBeenCalledWith({});

    await user.click(tab(/^Rejetés/));

    await waitFor(() =>
      expect(mocks.getGerants).toHaveBeenLastCalledWith({
        verification_status: 'rejected',
      }),
    );
    expect(mocks.getGerants).toHaveBeenCalledTimes(2);
  });

  it('recharge la liste avec le marché sélectionné', async () => {
    const user = userEvent.setup();
    render(<AdminGerantsPage />);
    await desktopReady();

    await user.selectOptions(screen.getByRole('combobox'), 'BJ');

    await waitFor(() =>
      expect(mocks.getGerants).toHaveBeenLastCalledWith({ market: 'BJ' }),
    );
    expect(mocks.getGerants).toHaveBeenCalledTimes(2);
  });

  it('combine le filtre de marché et le filtre de statut dans la requête', async () => {
    const user = userEvent.setup();
    render(<AdminGerantsPage />);
    await desktopReady();

    await user.selectOptions(screen.getByRole('combobox'), 'CI');
    await user.click(tab(/^Vérifiés/));

    await waitFor(() =>
      expect(mocks.getGerants).toHaveBeenLastCalledWith({
        verification_status: 'approved',
        market: 'CI',
      }),
    );
  });

  it('filtre côté client par nom sans rappeler l’API', async () => {
    const user = userEvent.setup();
    render(<AdminGerantsPage />);
    await desktopReady();
    expect(mocks.getGerants).toHaveBeenCalledTimes(1);

    await user.type(
      screen.getByPlaceholderText('Rechercher par nom ou email...'),
      'AWA',
    );

    expect(desktop().getByText('Awa Koné')).toBeInTheDocument();
    expect(desktop().queryByText('Boli Traoré')).not.toBeInTheDocument();
    expect(desktop().getAllByRole('row')).toHaveLength(2);
    expect(mocks.getGerants).toHaveBeenCalledTimes(1);
  });

  it('filtre aussi par email et affiche le message de recherche vide', async () => {
    const user = userEvent.setup();
    render(<AdminGerantsPage />);
    await desktopReady();

    const input = screen.getByPlaceholderText('Rechercher par nom ou email...');
    await user.type(input, 'ilehya.bj');

    expect(desktop().queryByText('Awa Koné')).not.toBeInTheDocument();
    expect(desktop().getAllByRole('row')).toHaveLength(3);

    await user.clear(input);
    await user.type(input, 'personne-inconnu');

    expect(
      screen.getByText('Aucun gérant ne correspond à la recherche.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mocks.getGerants).toHaveBeenCalledTimes(1);
  });

  it('ouvre le drawer de documents pour un gérant en attente puis le referme', async () => {
    const user = userEvent.setup();
    render(<AdminGerantsPage />);
    const scope = await desktopReady();

    expect(scope.getAllByRole('button', { name: 'Documents' })).toHaveLength(2);
    const awaRow = scope.getByText('Awa Koné').closest('tr') as HTMLElement;
    await user.click(within(awaRow).getByRole('button', { name: 'Documents' }));

    expect(await screen.findByTestId('gerant-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('gerant-drawer')).toHaveTextContent('awa.kone@ilehya.ci');

    await user.click(screen.getByRole('button', { name: 'Fermer le drawer' }));
    expect(screen.queryByTestId('gerant-drawer')).not.toBeInTheDocument();
  });

  it("n'offre ni documents ni révocation à un gérant vérifié", async () => {
    render(<AdminGerantsPage />);

    const chefRow = await rowOf('Chef Moussa');
    expect(chefRow.queryByRole('button', { name: 'Documents' })).toBeNull();
    expect(chefRow.getByRole('button', { name: 'Révoquer' })).toBeInTheDocument();
  });

  it('révoque la vérification et met à jour la ligne', async () => {
    const user = userEvent.setup();
    render(<AdminGerantsPage />);

    const before = await rowOf('Chef Moussa');
    await user.click(before.getByRole('button', { name: 'Révoquer' }));

    await waitFor(() =>
      expect(mocks.revokeGerantVerification).toHaveBeenCalledTimes(1),
    );
    expect(mocks.revokeGerantVerification).toHaveBeenCalledWith('g-3');

    const after = await rowOf('Chef Moussa');
    expect(await after.findByText('Non vérifié')).toBeInTheDocument();
    expect(after.queryByRole('button', { name: 'Révoquer' })).toBeNull();
  });

  it("désactive le bouton de révocation pendant la requête", async () => {
    let resolveRevoke: (g: AdminGerant) => void = () => {};
    mocks.revokeGerantVerification.mockImplementation(
      () =>
        new Promise<AdminGerant>((resolve) => {
          resolveRevoke = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<AdminGerantsPage />);

    const row = await rowOf('Chef Moussa');
    await user.click(row.getByRole('button', { name: 'Révoquer' }));

    const busy = await within(
      desktop().getByText('Chef Moussa').closest('tr') as HTMLElement,
    ).findByRole('button', { name: '...' });
    expect(busy).toBeDisabled();

    resolveRevoke({ ...fourGerants[2], is_verified: false, verification_status: 'none' });

    await waitFor(() => {
      const current = desktop().getByText('Chef Moussa').closest('tr') as HTMLElement;
      expect(within(current).getByText('Non vérifié')).toBeInTheDocument();
    });
  });

  it("affiche une erreur quand la révocation échoue", async () => {
    mocks.revokeGerantVerification.mockRejectedValue(new Error('403'));
    const user = userEvent.setup();
    render(<AdminGerantsPage />);

    const row = await rowOf('Chef Moussa');
    await user.click(row.getByRole('button', { name: 'Révoquer' }));

    expect(await screen.findByText('Erreur lors de la révocation.')).toBeInTheDocument();
    const stillVerified = await rowOf('Chef Moussa');
    expect(stillVerified.getByRole('button', { name: 'Révoquer' })).toBeInTheDocument();
  });

  it('applique la mise à jour renvoyée par le drawer à la ligne', async () => {
    const user = userEvent.setup();
    render(<AdminGerantsPage />);

    const scope = await desktopReady();
    const awaRow = scope.getByText('Awa Koné').closest('tr') as HTMLElement;
    await user.click(within(awaRow).getByRole('button', { name: 'Documents' }));
    await screen.findByTestId('gerant-drawer');

    await user.click(screen.getByRole('button', { name: 'Simuler mise à jour' }));

    expect(await desktop().findByText('Awa Nom mis à jour')).toBeInTheDocument();
    expect(desktop().queryByText('Awa Koné')).not.toBeInTheDocument();
  });

  it('affiche le bouclier des gérants vérifiés et l’initiale des autres', async () => {
    render(<AdminGerantsPage />);

    await desktopReady();
    const avatars = document.querySelectorAll('.cell-avatar');
    expect(avatars).toHaveLength(4);
    expect(avatars[0].querySelector('svg')).toBeNull();
    expect(avatars[0].textContent).toBe('A');
    expect(avatars[2].querySelector('svg')).not.toBeNull();
    expect(avatars[2].textContent).toBe('');
  });
});
