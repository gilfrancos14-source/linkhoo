import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminEventsPage from './AdminEventsPage';
import type { AdminEvent } from '../../lib/adminApi';

const mocks = vi.hoisted(() => ({
  getEvents: vi.fn<(market: string) => Promise<AdminEvent[]>>(),
  createEvent: vi.fn<(data: Record<string, unknown>) => Promise<AdminEvent>>(),
  updateEvent: vi.fn<(id: string, data: Record<string, unknown>) => Promise<AdminEvent>>(),
  deleteEvent: vi.fn<(id: string) => Promise<void>>(),
  uploadFile: vi.fn<(file: File) => Promise<{ url: string; path: string }>>(),
  villes: vi.fn<() => Promise<string[]>>(),
  createBlob: vi.fn<() => string>(),
  revokeBlob: vi.fn<(url: string) => void>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    getEvents: mocks.getEvents,
    createEvent: mocks.createEvent,
    updateEvent: mocks.updateEvent,
    deleteEvent: mocks.deleteEvent,
    uploadFile: mocks.uploadFile,
  },
}));

vi.mock('../../lib/api', () => ({
  apiRooms: { villes: mocks.villes },
}));

function makeEvent(overrides: Partial<AdminEvent> = {}): AdminEvent {
  return {
    id: 'ev-ci-1',
    market: 'CI',
    city: 'Abidjan',
    title: 'Festival des masques',
    description: 'Défilé de masques au quartier',
    event_date: '2026-03-15',
    img: '/img/festival.jpg',
    alt: 'Masques de danse',
    created_at: '2026-01-05T10:00:00.000Z',
    ...overrides,
  };
}

const festival = makeEvent();
const salon = makeEvent({
  id: 'ev-ci-2',
  title: 'Salon du livre',
  description: 'Rencontres et dédicaces',
  event_date: '2026-01-20',
});
const carnaval = makeEvent({
  id: 'ev-bj-1',
  market: 'BJ',
  city: 'Cotonou',
  title: 'Carnaval de Grand Popo',
  description: 'Défilé sur la plage',
  event_date: '2026-02-10',
  img: '/img/carnaval.jpg',
  alt: 'Carnaval',
});

/** Données réinitialisées avant chaque test (surchargeables par test). */
let ciEvents: AdminEvent[] = [];
let bjEvents: AdminEvent[] = [];

function user() {
  return userEvent.setup({ delay: null, pointerEventsCheck: 0 });
}

/** Saisie bulk : `userEvent.type` est trop lent sous jsdom pour les formulaires. */
function setText(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

function table() {
  return within(screen.getByRole('table'));
}

async function tableReady() {
  return within(await screen.findByRole('table'));
}

function rowIn(scope: ReturnType<typeof within>, title: string) {
  const cell = scope.getByText(title);
  const row = cell.closest('tr');
  if (!row) throw new Error(`aucune ligne pour ${title}`);
  return within(row as HTMLElement);
}

function panelRoot() {
  const el = document.querySelector('.banner-slide-panel');
  if (!el) throw new Error('panneau absent');
  return el as HTMLElement;
}

function overlay() {
  return document.querySelector('.banner-slide-panel__overlay');
}

function closeBtn() {
  const el = document.querySelector('.banner-slide-panel__close');
  if (!el) throw new Error('bouton de fermeture absent');
  return el as HTMLElement;
}

function uploadZone() {
  const el = document.querySelector('.banner-upload-zone');
  if (!el) throw new Error('zone d’image absente');
  return el as HTMLElement;
}

function fileInput() {
  const el = document.querySelector('.banner-slide-panel input[type="file"]');
  if (!el) throw new Error('champ fichier absent');
  return el as HTMLInputElement;
}

function dateInput() {
  const el = document.querySelector('.banner-slide-panel input[type="date"]');
  if (!el) throw new Error('champ date absent');
  return el as HTMLInputElement;
}

function marketSelect() {
  const el = document.querySelector('.banner-field select');
  if (!el) throw new Error('sélecteur de marché du formulaire absent');
  return el as HTMLSelectElement;
}

function filterSelect() {
  const el = document.querySelector('.gerants-filter-card__select');
  if (!el) throw new Error('sélecteur de marché absent');
  return el as HTMLSelectElement;
}

function cityInput() {
  return screen.getByPlaceholderText('Cotonou, Abidjan...') as HTMLInputElement;
}

function titleInput() {
  return screen.getByPlaceholderText("Nom de l'événement") as HTMLInputElement;
}

function descInput() {
  return screen.getByPlaceholderText("Description de l'événement") as HTMLInputElement;
}

function altInput() {
  return screen.getByPlaceholderText("Description de l'image") as HTMLInputElement;
}

function tab(name: RegExp) {
  return screen.getByRole('button', { name });
}

function modal() {
  const el = document.querySelector('.verify-modal');
  if (!el) throw new Error('modale de confirmation absente');
  return within(el as HTMLElement);
}

function pickFile(name = 'fete.jpg', type = 'image/jpeg') {
  return new File(['contenu'], name, { type });
}

/** Remplit le formulaire obligatoire d'un événement (sans image). */
function fillRequired(city = 'Cotonou', title = 'Fête des récoltes', date = '2026-06-01') {
  setText(cityInput(), city);
  setText(titleInput(), title);
  fireEvent.change(dateInput(), { target: { value: date } });
}

beforeEach(() => {
  vi.clearAllMocks();
  ciEvents = [festival, salon];
  bjEvents = [carnaval];
  mocks.getEvents.mockImplementation(async (market) => (market === 'CI' ? ciEvents : bjEvents));
  mocks.createEvent.mockImplementation(async (data) =>
    makeEvent({ id: 'ev-new', created_at: '2026-02-01T00:00:00.000Z', ...data }),
  );
  mocks.updateEvent.mockImplementation(async (id, data) => makeEvent({ id, ...data }));
  mocks.deleteEvent.mockResolvedValue(undefined);
  mocks.uploadFile.mockResolvedValue({ url: '/uploads/fete.jpg', path: 'uploads/fete.jpg' });
  mocks.villes.mockResolvedValue([]);

  // jsdom n'implémente pas les URL d'objet blob.
  let counter = 0;
  mocks.createBlob.mockImplementation(() => `blob:preview-${++counter}`);
  URL.createObjectURL = mocks.createBlob as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = mocks.revokeBlob as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  cleanup();
});

describe('AdminEventsPage — chargement des événements', () => {
  it("affiche l'état de chargement tant que les deux marchés ne sont pas résolus", () => {
    mocks.getEvents.mockImplementation(() => new Promise<AdminEvent[]>(() => {}));

    render(<AdminEventsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Événements' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("interroge les événements des deux marchés puis masque le chargement", async () => {
    render(<AdminEventsPage />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    expect(mocks.getEvents).toHaveBeenCalledTimes(2);
    expect(mocks.getEvents).toHaveBeenNthCalledWith(1, 'CI');
    expect(mocks.getEvents).toHaveBeenNthCalledWith(2, 'BJ');
    expect(mocks.villes).toHaveBeenCalledTimes(1);
  });

  it("affiche l'erreur quand le chargement des deux marchés échoue", async () => {
    mocks.getEvents.mockRejectedValue(new Error('réseau coupé'));

    render(<AdminEventsPage />);

    expect(
      await screen.findByText('Impossible de charger les événements.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it("affiche la même erreur quand un seul marché est en échec", async () => {
    mocks.getEvents.mockImplementation(async (market) => {
      if (market === 'BJ') throw new Error('500');
      return ciEvents;
    });

    render(<AdminEventsPage />);

    expect(
      await screen.findByText('Impossible de charger les événements.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun événement n'existe sur les deux marchés", async () => {
    ciEvents = [];
    bjEvents = [];

    render(<AdminEventsPage />);

    expect(await screen.findByText('Aucun événement trouvé.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByText('Aucun événement trouvé.')).toHaveLength(1);
  });

  it('affiche une ligne par événement avec titre, description, ville, date et marché', async () => {
    render(<AdminEventsPage />);

    const scope = await tableReady();
    expect(scope.getAllByRole('row')).toHaveLength(4);
    expect(scope.getByText('Festival des masques')).toBeInTheDocument();
    expect(scope.getByText('Défilé de masques au quartier')).toBeInTheDocument();
    expect(scope.getByText('Carnaval de Grand Popo')).toBeInTheDocument();
    expect(scope.getByText('Cotonou')).toBeInTheDocument();
    expect(scope.getByText('15/03/2026')).toBeInTheDocument();
    expect(scope.getByText('10/02/2026')).toBeInTheDocument();
    expect(scope.getAllByText('CI')).toHaveLength(2);
    expect(scope.getAllByText('BJ')).toHaveLength(1);
  });

  it('trie les événements des deux marchés par date croissante', async () => {
    render(<AdminEventsPage />);

    const scope = await tableReady();
    const titles = scope.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1].textContent);
    expect(titles[0]).toContain('Salon du livre');
    expect(titles[1]).toContain('Carnaval de Grand Popo');
    expect(titles[2]).toContain('Festival des masques');
  });

  it("brise les égalités de date par identifiant d'événement", async () => {
    ciEvents = [
      makeEvent({ id: 'ev-z', title: 'Z Festival', event_date: '2026-05-01' }),
      makeEvent({ id: 'ev-a', title: 'A Festival', event_date: '2026-05-01' }),
    ];
    bjEvents = [];

    render(<AdminEventsPage />);

    const scope = await tableReady();
    const titles = scope.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1].textContent);
    expect(titles).toHaveLength(2);
    expect(titles[0]).toContain('A Festival');
    expect(titles[1]).toContain('Z Festival');
  });

  it('affiche les cartes mobiles en regard du tableau', async () => {
    render(<AdminEventsPage />);

    await tableReady();
    const cards = document.querySelectorAll('.banners-mobile-cards .gerant-card');
    expect(cards).toHaveLength(3);
    // Les cartes reprennent l'ordre chronologique du tableau.
    expect(cards[0].textContent).toContain('Salon du livre');
    expect(cards[1].textContent).toContain('Carnaval de Grand Popo');
    expect(cards[2].textContent).toContain('Festival des masques');
  });

  it("affiche la date vide comme cellule vide quand event_date est absent", async () => {
    ciEvents = [makeEvent({ event_date: '', title: 'Sans date' })];
    bjEvents = [];

    render(<AdminEventsPage />);

    const scope = await tableReady();
    const row = scope.getByText('Sans date').closest('tr') as HTMLElement;
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(6);
    expect(cells[3].textContent).toBe('');
    expect(scope.queryByText(/\d{2}\/\d{2}\/\d{4}/)).toBeNull();
  });

  it("retombe sur le titre de l'événement quand aucune description d'image n'est fournie", async () => {
    ciEvents = [makeEvent({ alt: null, img: null })];
    bjEvents = [];

    render(<AdminEventsPage />);

    const scope = await tableReady();
    const row = scope.getByText('Festival des masques').closest('tr') as HTMLElement;
    expect(within(row).getByRole('img', { name: 'Festival des masques' })).toBeInTheDocument();
  });

  it("construit les suggestions de ville depuis les événements et les biens", async () => {
    mocks.villes.mockResolvedValue(['abidjan', 'Lomé', 'Cotonou']);

    render(<AdminEventsPage />);

    await tableReady();
    await waitFor(() =>
      expect(document.querySelectorAll('#admin-event-city-options option')).toHaveLength(3),
    );
    const values = [...document.querySelectorAll('#admin-event-city-options option')].map(
      (o) => (o as HTMLOptionElement).value,
    );
    // Dédoublonnage insensible à la casse en conservant la première occurrence, tri fr.
    expect(values).toEqual(['Abidjan', 'Cotonou', 'Lomé']);
  });

  it("ignore l'échec du chargement des villes des biens sans casser les suggestions", async () => {
    mocks.villes.mockRejectedValue(new Error('réseau coupé'));

    render(<AdminEventsPage />);

    await tableReady();
    await waitFor(() =>
      expect(document.querySelectorAll('#admin-event-city-options option')).toHaveLength(2),
    );
    const values = [...document.querySelectorAll('#admin-event-city-options option')].map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(values).toEqual(['Abidjan', 'Cotonou']);
    expect(screen.queryByText('Impossible de charger les événements.')).not.toBeInTheDocument();
  });
});

describe('AdminEventsPage — filtres marché et ville', () => {
  it('compte les événements dans chaque onglet de ville', async () => {
    render(<AdminEventsPage />);

    await tableReady();
    expect(within(tab(/^Toutes/)).getByText('3')).toBeInTheDocument();
    expect(within(tab(/^Abidjan/)).getByText('2')).toBeInTheDocument();
    expect(within(tab(/^Cotonou/)).getByText('1')).toBeInTheDocument();
    expect(tab(/^Toutes/)).toHaveClass('gerants-filter-card__tab--active');
  });

  it('filtre les lignes par ville au clic sur un onglet', async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(tab(/^Cotonou/));

    expect(table().getAllByRole('row')).toHaveLength(2);
    expect(table().getByText('Carnaval de Grand Popo')).toBeInTheDocument();
    expect(table().queryByText('Festival des masques')).not.toBeInTheDocument();
    expect(tab(/^Cotonou/)).toHaveClass('gerants-filter-card__tab--active');
    expect(mocks.getEvents).toHaveBeenCalledTimes(2);
  });

  it("revient à tous les événements avec l'onglet Toutes", async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(tab(/^Cotonou/));
    expect(table().getAllByRole('row')).toHaveLength(2);

    await u.click(tab(/^Toutes/));
    expect(table().getAllByRole('row')).toHaveLength(4);
  });

  it('filtre par marché sans recharger les événements', async () => {
    render(<AdminEventsPage />);
    await tableReady();

    fireEvent.change(filterSelect(), { target: { value: 'BJ' } });

    await waitFor(() => expect(table().getAllByRole('row')).toHaveLength(2));
    expect(table().getByText('Carnaval de Grand Popo')).toBeInTheDocument();
    expect(mocks.getEvents).toHaveBeenCalledTimes(2);
    expect(within(tab(/^Toutes/)).getByText('1')).toBeInTheDocument();
  });

  it('réinitialise le filtre de ville au changement de marché', async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(tab(/^Abidjan/));
    expect(table().getAllByRole('row')).toHaveLength(3);

    fireEvent.change(filterSelect(), { target: { value: 'BJ' } });

    await waitFor(() => expect(table().getAllByRole('row')).toHaveLength(2));
    expect(tab(/^Toutes/)).toHaveClass('gerants-filter-card__tab--active');
    expect(tab(/^Cotonou/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Abidjan/ })).toBeNull();
  });

  it("affiche l'état vide quand le marché sélectionné n'a aucun événement", async () => {
    bjEvents = [];
    render(<AdminEventsPage />);
    await tableReady();

    fireEvent.change(filterSelect(), { target: { value: 'BJ' } });

    expect(await screen.findByText('Aucun événement trouvé.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('AdminEventsPage — création', () => {
  it("ouvre le panneau en mode création avec un formulaire vierge", async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(panelRoot()).toHaveClass('banner-slide-panel--open');
    expect(overlay()).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Ajouter un événement' })).toBeInTheDocument();
    expect(cityInput().value).toBe('');
    expect(titleInput().value).toBe('');
    expect(dateInput().value).toBe('');
    expect(marketSelect().value).toBe('CI');
    expect(screen.queryByAltText('Aperçu')).toBeNull();
  });

  it('réinitialise le formulaire quand on rouvre la création après une édition', async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('heading', { level: 2, name: "Modifier l'événement" })).toBeInTheDocument();
    expect(titleInput().value).toBe('Festival des masques');

    await u.click(screen.getByRole('button', { name: 'Annuler' }));
    await u.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(titleInput().value).toBe('');
    expect(cityInput().value).toBe('');
    expect(dateInput().value).toBe('');
    expect(screen.queryByAltText('Aperçu')).toBeNull();
  });

  it("refuse la sauvegarde quand ville, titre et date manquent", async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('Ville, titre et date sont obligatoires.'),
    ).toBeInTheDocument();
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(panelRoot()).toHaveClass('banner-slide-panel--open');
  });

  it("refuse la sauvegarde dès qu'une seule donnée obligatoire manque", async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    setText(cityInput(), 'Cotonou');
    setText(titleInput(), 'Fête des récoltes');
    // date volontairement laissée vide
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('Ville, titre et date sont obligatoires.'),
    ).toBeInTheDocument();
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("refuse la sauvegarde sans image", async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    fillRequired();
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Veuillez sélectionner une image.')).toBeInTheDocument();
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it('crée un événement avec son image téléversée puis referme le panneau', async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    fillRequired('  Cotonou  ', '  Fête des récoltes  ', '2026-06-01');
    setText(altInput(), '  Danseurs  ');
    fireEvent.change(fileInput(), { target: { files: [pickFile()] } });
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createEvent).toHaveBeenCalledTimes(1));
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1);
    expect(mocks.createEvent).toHaveBeenCalledWith({
      market: 'CI',
      city: 'Cotonou',
      title: 'Fête des récoltes',
      description: '',
      event_date: '2026-06-01',
      alt: 'Danseurs',
      img: '/uploads/fete.jpg',
    });
    await waitFor(() => expect(panelRoot()).not.toHaveClass('banner-slide-panel--open'));
    expect(await table().findByText('Fête des récoltes')).toBeInTheDocument();
    expect(screen.queryByText('Veuillez sélectionner une image.')).not.toBeInTheDocument();
  });

  it('conserve le marché choisi dans le formulaire de création', async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    fireEvent.change(marketSelect(), { target: { value: 'BJ' } });
    fillRequired();
    fireEvent.change(fileInput(), { target: { files: [pickFile()] } });
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createEvent).toHaveBeenCalledTimes(1));
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({ market: 'BJ' }));
  });

  it("affiche l'erreur remontée par l'API et garde le panneau ouvert", async () => {
    mocks.createEvent.mockRejectedValue(new Error('Titre déjà utilisé'));
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    fillRequired();
    fireEvent.change(fileInput(), { target: { files: [pickFile()] } });
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Titre déjà utilisé')).toBeInTheDocument();
    expect(panelRoot()).toHaveClass('banner-slide-panel--open');
    expect(await table().findByText('Festival des masques')).toBeInTheDocument();
  });

  it("affiche une erreur générique quand le rejet n'est pas une instance d'Error", async () => {
    mocks.createEvent.mockRejectedValue('boom');
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    fillRequired();
    fireEvent.change(fileInput(), { target: { files: [pickFile()] } });
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Erreur lors de la sauvegarde.')).toBeInTheDocument();
  });

  it("désactive le bouton et annonce l'enregistrement pendant la requête", async () => {
    let resolveUpdate: (e: AdminEvent) => void = () => {};
    mocks.updateEvent.mockImplementation(
      () =>
        new Promise<AdminEvent>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Modifier' }));
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    const busy = await screen.findByRole('button', { name: 'Enregistrement...' });
    expect(busy).toBeDisabled();

    resolveUpdate(festival);
    await waitFor(() => expect(panelRoot()).not.toHaveClass('banner-slide-panel--open'));
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  it("efface l'erreur d'une première tentative au moment d'une nouvelle sauvegarde", async () => {
    mocks.createEvent.mockRejectedValueOnce(new Error('Titre déjà utilisé'));
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    fillRequired();
    fireEvent.change(fileInput(), { target: { files: [pickFile()] } });
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Titre déjà utilisé')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createEvent).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Titre déjà utilisé')).not.toBeInTheDocument();
    await waitFor(() => expect(panelRoot()).not.toHaveClass('banner-slide-panel--open'));
  });

  it("referme le panneau avec la croix sans rien créer", async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(panelRoot()).toHaveClass('banner-slide-panel--open');

    await u.click(closeBtn());

    expect(panelRoot()).not.toHaveClass('banner-slide-panel--open');
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("referme le panneau en cliquant sur le fond noir", async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    await u.click(screen.getByRole('button', { name: 'Ajouter' }));
    fireEvent.click(overlay() as Element);

    expect(panelRoot()).not.toHaveClass('banner-slide-panel--open');
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("n'affiche aucun aperçu tant qu'aucune image n'est choisie", async () => {
    render(<AdminEventsPage />);
    await tableReady();

    expect(screen.queryByAltText('Aperçu')).toBeNull();
    expect(uploadZone().textContent).toContain('Cliquez ou glissez une image');
    expect(uploadZone().textContent).toContain('JPEG, PNG, WebP, GIF — 2 Mo max');
    expect(mocks.createBlob).not.toHaveBeenCalled();
  });
});

describe('AdminEventsPage — image et aperçu', () => {
  it('affiche un aperçu blob quand une image est choisie dans le champ fichier', async () => {
    render(<AdminEventsPage />);
    await tableReady();

    fireEvent.change(fileInput(), { target: { files: [pickFile('fete.png', 'image/png')] } });

    expect(await screen.findByAltText('Aperçu')).toBeInTheDocument();
    expect(screen.getByAltText('Aperçu')).toHaveAttribute('src', 'blob:preview-1');
    expect(mocks.createBlob).toHaveBeenCalledTimes(1);
    expect(uploadZone().textContent).not.toContain('Cliquez ou glissez une image');
  });

  it("libère l'URL blob de l'aperçu précédent quand on choisit une autre image", async () => {
    render(<AdminEventsPage />);
    await tableReady();

    fireEvent.change(fileInput(), { target: { files: [pickFile('a.jpg')] } });
    fireEvent.change(fileInput(), { target: { files: [pickFile('b.jpg')] } });

    expect(mocks.createBlob).toHaveBeenCalledTimes(2);
    expect(mocks.revokeBlob).toHaveBeenCalledTimes(1);
    expect(mocks.revokeBlob).toHaveBeenCalledWith('blob:preview-1');
    expect(screen.getByAltText('Aperçu')).toHaveAttribute('src', 'blob:preview-2');
  });

  it("accepte un fichier image déposé sur la zone", async () => {
    render(<AdminEventsPage />);
    await tableReady();

    fireEvent.drop(uploadZone(), { dataTransfer: { files: [pickFile('glisse.jpg')] } });

    expect(await screen.findByAltText('Aperçu')).toBeInTheDocument();
    expect(screen.getByAltText('Aperçu')).toHaveAttribute('src', 'blob:preview-1');
  });

  it('ignore un fichier non image déposé sur la zone', async () => {
    render(<AdminEventsPage />);
    await tableReady();

    fireEvent.drop(uploadZone(), { dataTransfer: { files: [pickFile('rapport.pdf', 'application/pdf')] } });

    expect(screen.queryByAltText('Aperçu')).toBeNull();
    expect(mocks.createBlob).not.toHaveBeenCalled();
    expect(uploadZone().textContent).toContain('Cliquez ou glissez une image');
  });

  it("libère l'aperçu blob au démontage du panneau ouvert", async () => {
    const { unmount } = render(<AdminEventsPage />);
    await tableReady();

    fireEvent.change(fileInput(), { target: { files: [pickFile()] } });
    expect(screen.getByAltText('Aperçu')).toBeInTheDocument();
    expect(mocks.revokeBlob).not.toHaveBeenCalled();

    unmount();

    expect(mocks.revokeBlob).toHaveBeenCalledWith('blob:preview-1');
  });

  it("ne libère rien au démontage quand l'aperçu est l'image distante d'un événement", async () => {
    const u = user();
    const { unmount } = render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Modifier' }));
    expect(screen.getByAltText('Aperçu')).toHaveAttribute('src', '/img/festival.jpg');

    unmount();

    expect(mocks.revokeBlob).not.toHaveBeenCalled();
  });

  it("remplace l'image distante de l'événement par un nouvel aperçu local", async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Modifier' }));
    expect(screen.getByAltText('Aperçu')).toHaveAttribute('src', '/img/festival.jpg');

    fireEvent.change(fileInput(), { target: { files: [pickFile('neuve.jpg')] } });

    expect(screen.getByAltText('Aperçu')).toHaveAttribute('src', 'blob:preview-1');
    expect(mocks.revokeBlob).not.toHaveBeenCalled();
  });

  it('compte les caractères de la description saisis', async () => {
    render(<AdminEventsPage />);
    await tableReady();

    const counter = screen.getByText('0 / 2000');
    expect(counter).toBeInTheDocument();

    setText(descInput(), 'Un défilé coloré');
    expect(screen.getByText('16 / 2000')).toBeInTheDocument();

    setText(descInput(), '');
    expect(screen.getByText('0 / 2000')).toBeInTheDocument();
  });
});

describe('AdminEventsPage — édition', () => {
  it("ouvre le panneau en édition pré-rempli avec l'image existante", async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Modifier' }));

    expect(panelRoot()).toHaveClass('banner-slide-panel--open');
    expect(screen.getByRole('heading', { level: 2, name: "Modifier l'événement" })).toBeInTheDocument();
    expect(titleInput().value).toBe('Festival des masques');
    expect(cityInput().value).toBe('Abidjan');
    expect(dateInput().value).toBe('2026-03-15');
    expect(descInput().value).toBe('Défilé de masques au quartier');
    expect(altInput().value).toBe('Masques de danse');
    expect(marketSelect().value).toBe('CI');
    expect(screen.getByAltText('Aperçu')).toHaveAttribute('src', '/img/festival.jpg');
  });

  it("met à jour l'événement avec l'image d'origine sans passer par l'upload", async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Modifier' }));
    setText(titleInput(), 'Festival des masques 2026');
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.updateEvent).toHaveBeenCalledTimes(1));
    expect(mocks.updateEvent).toHaveBeenCalledWith('ev-ci-1', {
      market: 'CI',
      city: 'Abidjan',
      title: 'Festival des masques 2026',
      description: 'Défilé de masques au quartier',
      event_date: '2026-03-15',
      alt: 'Masques de danse',
      img: '/img/festival.jpg',
    });
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(await table().findByText('Festival des masques 2026')).toBeInTheDocument();
    expect(table().queryByText('Festival des masques')).not.toBeInTheDocument();
  });

  it("téléverse une nouvelle image pendant l'édition", async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Modifier' }));
    fireEvent.change(fileInput(), { target: { files: [pickFile('neuve.jpg')] } });
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.updateEvent).toHaveBeenCalledTimes(1));
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1);
    expect(mocks.updateEvent).toHaveBeenCalledWith(
      'ev-ci-1',
      expect.objectContaining({ img: '/uploads/fete.jpg' }),
    );
  });

  it("affiche l'erreur quand la mise à jour échoue", async () => {
    mocks.updateEvent.mockRejectedValue(new Error('403'));
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Modifier' }));
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('403')).toBeInTheDocument();
    expect(panelRoot()).toHaveClass('banner-slide-panel--open');
    expect(table().getByText('Festival des masques')).toBeInTheDocument();
  });

  it("abandonne l'édition sans rien appeler quand on annule", async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Modifier' }));
    setText(titleInput(), 'Brouillon');
    await u.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(panelRoot()).not.toHaveClass('banner-slide-panel--open');
    expect(mocks.updateEvent).not.toHaveBeenCalled();
    expect(table().getByText('Festival des masques')).toBeInTheDocument();
  });
});

describe('AdminEventsPage — suppression', () => {
  it('ouvre la modale de confirmation au clic sur Supprimer', async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Supprimer' }));

    expect(modal().getByText('Supprimer cet événement ?')).toBeInTheDocument();
    expect(modal().getByText('Cette action est irréversible.')).toBeInTheDocument();
    expect(modal().getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
    expect(modal().getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
  });

  it("annule la suppression sans appeler l'API", async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Supprimer' }));
    await u.click(modal().getByRole('button', { name: 'Annuler' }));

    expect(document.querySelector('.verify-modal')).toBeNull();
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    expect(table().getAllByRole('row')).toHaveLength(4);
  });

  it('ferme la modale en cliquant sur le fond noir', async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(document.querySelector('.verify-overlay') as Element);

    expect(document.querySelector('.verify-modal')).toBeNull();
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
  });

  it("supprime l'événement et retire sa ligne", async () => {
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Supprimer' }));
    await u.click(modal().getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(mocks.deleteEvent).toHaveBeenCalledTimes(1));
    expect(mocks.deleteEvent).toHaveBeenCalledWith('ev-ci-1');
    await waitFor(() => expect(table().getAllByRole('row')).toHaveLength(3));
    expect(table().queryByText('Festival des masques')).toBeNull();
    expect(document.querySelector('.verify-modal')).toBeNull();
    expect(within(tab(/^Abidjan/)).getByText('1')).toBeInTheDocument();
  });

  it("supprime l'événement affiché en carte mobile", async () => {
    const u = user();
    render(<AdminEventsPage />);
    await tableReady();

    const card = [...document.querySelectorAll('.banners-mobile-cards .gerant-card')].find((c) =>
      c.textContent?.includes('Carnaval de Grand Popo'),
    ) as HTMLElement;
    expect(card).toBeTruthy();
    await u.click(within(card).getByRole('button', { name: 'Supprimer' }));
    await u.click(modal().getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(mocks.deleteEvent).toHaveBeenCalledWith('ev-bj-1'));
    await waitFor(() =>
      expect(document.querySelectorAll('.banners-mobile-cards .gerant-card')).toHaveLength(2),
    );
  });

  it("affiche l'erreur quand la suppression échoue et garde la ligne", async () => {
    mocks.deleteEvent.mockRejectedValue(new Error('403'));
    const u = user();
    render(<AdminEventsPage />);
    const scope = await tableReady();

    await u.click(rowIn(scope, 'Festival des masques').getByRole('button', { name: 'Supprimer' }));
    await u.click(modal().getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByText('Erreur lors de la suppression.')).toBeInTheDocument();
    expect(table().getByText('Festival des masques')).toBeInTheDocument();
    expect(document.querySelector('.verify-modal')).not.toBeNull();
  });
});
