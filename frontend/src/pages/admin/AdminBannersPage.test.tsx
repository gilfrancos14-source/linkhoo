import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminBannersPage from './AdminBannersPage';
import type { AdminBanner } from '../../lib/adminApi';

const mocks = vi.hoisted(() => ({
  getBanners: vi.fn<(market?: string, section?: string) => Promise<AdminBanner[]>>(),
  createBanner: vi.fn<(data: Partial<AdminBanner>) => Promise<AdminBanner>>(),
  updateBanner: vi.fn<(id: string, data: Partial<AdminBanner>) => Promise<AdminBanner>>(),
  deleteBanner: vi.fn<(id: string) => Promise<void>>(),
  uploadFile: vi.fn<(file: File) => Promise<{ url: string; path: string }>>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    getBanners: mocks.getBanners,
    createBanner: mocks.createBanner,
    updateBanner: mocks.updateBanner,
    deleteBanner: mocks.deleteBanner,
    uploadFile: mocks.uploadFile,
  },
}));

function makeBanner(overrides: Partial<AdminBanner> = {}): AdminBanner {
  return {
    id: 'bn-1',
    section: 'popular',
    market: 'CI',
    link: '/chambres',
    alt: 'Suite populaire',
    order: 1,
    img: '/img/populaire.jpg',
    created_at: '2026-01-05T10:00:00.000Z',
    ...overrides,
  };
}

const bannerA = makeBanner();
const bannerB = makeBanner({
  id: 'bn-2',
  section: 'promos',
  market: 'BJ',
  link: 'https://ilehya.ci/promos',
  alt: '',
  order: 2,
  img: '/img/promo.jpg',
});
const bannerC = makeBanner({
  id: 'bn-3',
  section: 'events',
  market: 'CI',
  link: '/evenements',
  alt: 'Coupe d’Afrique',
  order: 0,
  img: '/img/event.jpg',
});

const threeBanners = [bannerA, bannerB, bannerC];

/** Le panneau latéral est toujours monté : on cible son contenu. */
function panel() {
  const el = document.querySelector('.banner-slide-panel');
  if (!el) throw new Error('panneau absent');
  return within(el as HTMLElement);
}

function panelRoot() {
  const el = document.querySelector('.banner-slide-panel');
  if (!el) throw new Error('panneau absent');
  return el as HTMLElement;
}

function table() {
  return within(screen.getByRole('table'));
}

function rowIn(title: string) {
  const cell = table().getByText(title);
  const row = cell.closest('tr');
  if (!row) throw new Error(`aucune ligne pour ${title}`);
  return within(row as HTMLElement);
}

function fileInput() {
  const input = panelRoot().querySelector('input[type="file"]');
  if (!input) throw new Error('input fichier absent');
  return input as HTMLInputElement;
}

function numberInput() {
  const input = panelRoot().querySelector('input[type="number"]');
  if (!input) throw new Error('input nombre absent');
  return input as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBanners.mockResolvedValue(threeBanners);
  mocks.createBanner.mockImplementation(async (data) => makeBanner({ id: 'bn-new', ...data }));
  mocks.updateBanner.mockImplementation(async (id, data) => makeBanner({ id, ...data }));
  mocks.deleteBanner.mockResolvedValue(undefined);
  mocks.uploadFile.mockResolvedValue({ url: '/uploads/nouvelle.jpg', path: 'uploads/nouvelle.jpg' });
  // jsdom n'implémente pas l'objet blob.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe('AdminBannersPage', () => {
  it("affiche l'état de chargement tant que les bannières ne sont pas résolues", () => {
    mocks.getBanners.mockImplementation(() => new Promise<AdminBanner[]>(() => {}));

    render(<AdminBannersPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Bannières' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("affiche l'erreur quand le chargement échoue", async () => {
    mocks.getBanners.mockRejectedValue(new Error('réseau'));

    render(<AdminBannersPage />);

    expect(
      await screen.findByText('Impossible de charger les bannières.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('charge toutes les bannières par défaut', async () => {
    render(<AdminBannersPage />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(mocks.getBanners).toHaveBeenCalledTimes(1);
    expect(mocks.getBanners).toHaveBeenCalledWith(undefined);
  });

  it('affiche chaque bannière dans le tableau avec sa section et son marché', async () => {
    render(<AdminBannersPage />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    const scope = table();
    expect(scope.getAllByRole('row')).toHaveLength(4);
    expect(scope.getByAltText('Suite populaire')).toBeInTheDocument();
    expect(scope.getByAltText('Coupe d’Afrique')).toBeInTheDocument();
    // alt vide → libellé par défaut.
    expect(scope.getByAltText('Bannière')).toBeInTheDocument();
    expect(scope.getByText('Populaires')).toBeInTheDocument();
    expect(scope.getByText('Promos')).toBeInTheDocument();
    expect(scope.getByText('Événements')).toBeInTheDocument();
    expect(scope.getByText('https://ilehya.ci/promos')).toBeInTheDocument();
    expect(scope.getByText('/chambres')).toBeInTheDocument();
    expect(scope.getByText('0')).toBeInTheDocument();
  });

  it('compte les bannières par section dans les onglets', async () => {
    render(<AdminBannersPage />);

    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: /^Toutes/ })).toHaveTextContent('Toutes3');
    expect(screen.getByRole('button', { name: /^Populaires/ })).toHaveTextContent('Populaires1');
    expect(screen.getByRole('button', { name: /^Promos/ })).toHaveTextContent('Promos1');
    expect(screen.getByRole('button', { name: /^Catégories/ })).toHaveTextContent('Catégories0');
    expect(screen.getByRole('button', { name: /^Événements/ })).toHaveTextContent('Événements1');
    expect(screen.getByRole('button', { name: /^Toutes/ })).toHaveClass(
      'gerants-filter-card__tab--active',
    );
  });

  it('filtre la liste par section sans recharger', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: /^Promos/ }));

    expect(table().getByText('https://ilehya.ci/promos')).toBeInTheDocument();
    expect(screen.queryByText('/chambres')).not.toBeInTheDocument();
    expect(table().getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Promos/ })).toHaveClass(
      'gerants-filter-card__tab--active',
    );
    expect(mocks.getBanners).toHaveBeenCalledTimes(1);
  });

  it("affiche l'état vide quand la section sélectionnée est vide", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: /^Catégories/ }));

    expect(screen.getByText('Aucune bannière trouvée.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('/chambres')).not.toBeInTheDocument();
  });

  it('recharge les bannières quand le marché change', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    const filterCard = within(document.querySelector('.gerants-filter-card') as HTMLElement);
    await user.selectOptions(filterCard.getByRole('combobox'), 'BJ');

    await waitFor(() => expect(mocks.getBanners).toHaveBeenLastCalledWith('BJ'));
    expect(mocks.getBanners).toHaveBeenCalledTimes(2);
  });

  it("ouvre le panneau d'ajout avec un formulaire vierge", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(panelRoot()).toHaveClass('banner-slide-panel--open');
    expect(panel().getByRole('heading', { name: 'Ajouter une bannière' })).toBeInTheDocument();

    const selects = panel().getAllByRole('combobox');
    expect(selects[0]).toHaveValue('popular');
    expect(selects[1]).toHaveValue('CI');
    expect(panel().getByPlaceholderText('https://...')).toHaveValue('');
    expect(panel().getByPlaceholderText('Description de la bannière')).toHaveValue('');
    expect(numberInput()).toHaveValue(0);
    expect(panel().queryByAltText('Aperçu')).not.toBeInTheDocument();
    expect(panel().getByText('Cliquez ou glissez une image')).toBeInTheDocument();
  });

  it("refuse l'enregistrement d'une bannière sans image", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await user.type(panel().getByPlaceholderText('https://...'), 'https://ilehya.ci/nouvelle');
    await user.click(panel().getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Veuillez sélectionner une image.')).toBeInTheDocument();
    expect(mocks.createBanner).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(panelRoot()).toHaveClass('banner-slide-panel--open');
  });

  it('crée une bannière en téléversant son image', async () => {
    // Saisie longue : on supprime l'inter-lettrage pour rester sous le délai.
    const user = userEvent.setup({ delay: null });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await user.type(panel().getByPlaceholderText('https://...'), 'https://ilehya.ci/nouvelle');
    await user.type(
      panel().getByPlaceholderText('Description de la bannière'),
      'Nouvelle bannière',
    );
    fireEvent.change(numberInput(), { target: { value: '7' } });
    expect(numberInput()).toHaveValue(7);
    const file = new File(['contenu'], 'banniere.png', { type: 'image/png' });
    await user.upload(fileInput(), file);

    expect(panel().getByAltText('Aperçu')).toBeInTheDocument();
    await user.click(panel().getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createBanner).toHaveBeenCalledTimes(1));
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1);
    expect(mocks.uploadFile.mock.calls[0][0]).toBe(file);
    expect(mocks.createBanner).toHaveBeenCalledWith({
      section: 'popular',
      market: 'CI',
      link: 'https://ilehya.ci/nouvelle',
      alt: 'Nouvelle bannière',
      order: 7,
      img: '/uploads/nouvelle.jpg',
    });

    await waitFor(() =>
      expect(document.querySelector('.banner-slide-panel')).not.toHaveClass(
        'banner-slide-panel--open',
      ),
    );
    expect(await table().findByText('https://ilehya.ci/nouvelle')).toBeInTheDocument();
    expect(table().getAllByRole('row')).toHaveLength(5);
  }, 20000);

  it("pré-remplit le panneau quand on modifie une bannière", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(rowIn('/chambres').getByRole('button', { name: 'Modifier' }));

    expect(panel().getByRole('heading', { name: 'Modifier la bannière' })).toBeInTheDocument();
    const selects = panel().getAllByRole('combobox');
    expect(selects[0]).toHaveValue('popular');
    expect(selects[1]).toHaveValue('CI');
    expect(panel().getByPlaceholderText('https://...')).toHaveValue('/chambres');
    expect(panel().getByPlaceholderText('Description de la bannière')).toHaveValue(
      'Suite populaire',
    );
    expect(numberInput()).toHaveValue(1);
    expect(panel().getByAltText('Aperçu')).toHaveAttribute('src', '/img/populaire.jpg');
    expect(panel().queryByText('Cliquez ou glissez une image')).not.toBeInTheDocument();
  });

  it('met à jour une bannière existante sans repasser par le téléversement', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(rowIn('/chambres').getByRole('button', { name: 'Modifier' }));
    await user.clear(panel().getByPlaceholderText('https://...'));
    await user.type(panel().getByPlaceholderText('https://...'), '/nouveau-lien');
    await user.click(panel().getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.updateBanner).toHaveBeenCalledTimes(1));
    expect(mocks.updateBanner).toHaveBeenCalledWith('bn-1', {
      section: 'popular',
      market: 'CI',
      link: '/nouveau-lien',
      alt: 'Suite populaire',
      order: 1,
      img: '/img/populaire.jpg',
    });
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.createBanner).not.toHaveBeenCalled();
    expect(await table().findByText('/nouveau-lien')).toBeInTheDocument();
    expect(panelRoot()).not.toHaveClass('banner-slide-panel--open');
  });

  it("remplace l'image d'une bannière quand un nouveau fichier est choisi", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(rowIn('/chambres').getByRole('button', { name: 'Modifier' }));
    await user.upload(
      fileInput(),
      new File(['x'], 'remplacement.jpg', { type: 'image/jpeg' }),
    );
    await user.click(panel().getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.updateBanner).toHaveBeenCalledTimes(1));
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1);
    expect(mocks.updateBanner).toHaveBeenCalledWith(
      'bn-1',
      expect.objectContaining({ img: '/uploads/nouvelle.jpg' }),
    );
  });

  it("affiche le message d'erreur renvoyé par l'API", async () => {
    mocks.createBanner.mockRejectedValue(new Error('Lien déjà utilisé'));
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await user.upload(fileInput(), new File(['x'], 'a.png', { type: 'image/png' }));
    await user.click(panel().getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Lien déjà utilisé')).toBeInTheDocument();
    expect(panelRoot()).toHaveClass('banner-slide-panel--open');
  });

  it("désactive le bouton pendant l'enregistrement", async () => {
    let resolveCreate: (b: AdminBanner) => void = () => {};
    mocks.createBanner.mockImplementation(
      () =>
        new Promise<AdminBanner>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await user.upload(fileInput(), new File(['x'], 'a.png', { type: 'image/png' }));
    await user.click(panel().getByRole('button', { name: 'Enregistrer' }));

    const busy = await panel().findByRole('button', { name: 'Enregistrement...' });
    expect(busy).toBeDisabled();

    resolveCreate(makeBanner({ id: 'bn-new' }));
    await waitFor(() =>
      expect(document.querySelector('.banner-slide-panel')).not.toHaveClass(
        'banner-slide-panel--open',
      ),
    );
  });

  it('ferme le panneau avec Annuler', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(panelRoot()).toHaveClass('banner-slide-panel--open');

    await user.click(panel().getByRole('button', { name: 'Annuler' }));

    expect(panelRoot()).not.toHaveClass('banner-slide-panel--open');
    expect(mocks.createBanner).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it('supprime une bannière après confirmation', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(rowIn('/chambres').getByRole('button', { name: 'Supprimer' }));

    expect(
      screen.getByText('Supprimer cette bannière ?'),
    ).toBeInTheDocument();
    const modal = screen.getByText('Supprimer cette bannière ?').closest('.verify-modal');
    expect(mocks.deleteBanner).not.toHaveBeenCalled();

    await user.click(within(modal as HTMLElement).getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(mocks.deleteBanner).toHaveBeenCalledWith('bn-1'));
    await waitFor(() => expect(screen.queryByText('/chambres')).not.toBeInTheDocument());
    expect(screen.queryByText('Supprimer cette bannière ?')).not.toBeInTheDocument();
    expect(table().getAllByRole('row')).toHaveLength(3);
    expect(mocks.getBanners).toHaveBeenCalledTimes(1);
  });

  it('annule la suppression sans rien appeler', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(rowIn('/chambres').getByRole('button', { name: 'Supprimer' }));
    const modal = screen
      .getByText('Supprimer cette bannière ?')
      .closest('.verify-modal') as HTMLElement;
    await user.click(within(modal).getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByText('Supprimer cette bannière ?')).not.toBeInTheDocument();
    expect(mocks.deleteBanner).not.toHaveBeenCalled();
    expect(table().getByText('/chambres')).toBeInTheDocument();
  });

  it("affiche une erreur quand la suppression échoue", async () => {
    mocks.deleteBanner.mockRejectedValue(new Error('403'));
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(rowIn('/chambres').getByRole('button', { name: 'Supprimer' }));
    const modal = screen
      .getByText('Supprimer cette bannière ?')
      .closest('.verify-modal') as HTMLElement;
    await user.click(within(modal).getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByText('Erreur lors de la suppression.')).toBeInTheDocument();
    expect(screen.getByText('Supprimer cette bannière ?')).toBeInTheDocument();
    expect(table().getByText('/chambres')).toBeInTheDocument();
    expect(mocks.deleteBanner).toHaveBeenCalledTimes(1);
  });

  it('gère le dépôt d’une image par glisser-déposer', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<AdminBannersPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    const zone = screen.getByText('Cliquez ou glissez une image').closest(
      '.banner-upload-zone',
    ) as HTMLElement;
    const file = new File(['x'], 'glisse.png', { type: 'image/png' });
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ['Files'] } });

    expect(panel().getByAltText('Aperçu')).toBeInTheDocument();
    expect(panel().queryByText('Cliquez ou glissez une image')).not.toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
