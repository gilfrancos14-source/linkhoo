import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminDestinationsPage from './AdminDestinationsPage';
import type { AdminDestination, AdminTourismPartition } from '../../lib/adminApi';

type DestinationPayload = Omit<AdminDestination, 'id' | 'created_at'>;

const mocks = vi.hoisted(() => ({
  getDestinations: vi.fn<(market: string) => Promise<AdminTourismPartition>>(),
  createDestination: vi.fn<(data: DestinationPayload) => Promise<AdminDestination>>(),
  updateDestination: vi.fn<(id: string, data: Partial<DestinationPayload>) => Promise<AdminDestination>>(),
  deleteDestination: vi.fn<(id: string) => Promise<void>>(),
  uploadFile: vi.fn<(file: File) => Promise<{ url: string; path: string }>>(),
  getEvents: vi.fn<(market: string) => Promise<unknown[]>>(),
  villes: vi.fn<() => Promise<string[]>>(),
  createBlob: vi.fn<() => string>(),
  revokeBlob: vi.fn<(url: string) => void>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    getDestinations: mocks.getDestinations,
    createDestination: mocks.createDestination,
    updateDestination: mocks.updateDestination,
    deleteDestination: mocks.deleteDestination,
    uploadFile: mocks.uploadFile,
    getEvents: mocks.getEvents,
  },
}));

vi.mock('../../lib/api', () => ({
  apiRooms: { villes: mocks.villes },
}));

function makeDestination(overrides: Partial<AdminDestination> = {}): AdminDestination {
  return {
    id: 'dst-ci-1',
    market: 'CI',
    city: 'Abidjan',
    title: 'Abidjan la cocotière',
    description: 'La capitale économique',
    img: '/img/abidjan.jpg',
    alt: 'Abidjan',
    featured: false,
    created_at: '2026-01-05T10:00:00.000Z',
    ...overrides,
  };
}

const abidjan = makeDestination();
const bassam = makeDestination({
  id: 'dst-ci-2',
  city: 'Grand-Bassam',
  title: 'Grand-Bassam, ville historique',
  description: 'Première capitale',
  img: '/img/bassam.jpg',
});
const ouidah = makeDestination({
  id: 'dst-bj-1',
  market: 'BJ',
  city: 'Ouidah',
  title: 'Ouidah, cité vaudou',
  description: 'La route des esclaves',
  img: '/img/ouidah.jpg',
});
const tori = makeDestination({
  id: 'dst-bj-2',
  market: 'BJ',
  city: 'Tori Bossito',
  title: 'Tori Bossito',
  description: 'Boucles du Zou',
  img: '/img/tori.jpg',
  featured: true,
});

/** Partitions servies par le faux serveur (réinitialisées avant chaque test). */
let ciPartition: AdminTourismPartition;
let bjPartition: AdminTourismPartition;

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
  // Une destination peut porter le même texte en ville et en titre.
  const [cell] = scope.queryAllByText(title);
  if (!cell) throw new Error(`aucune ligne pour ${title}`);
  const row = cell.closest('tr');
  if (!row) throw new Error(`aucune ligne pour ${title}`);
  return within(row as HTMLElement);
}

function panelRoot() {
  const el = document.querySelector('.banner-slide-panel');
  if (!el) throw new Error('panneau absent');
  return el as HTMLElement;
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

function formMarketSelect() {
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
  return screen.getByPlaceholderText('Ouidah, Abidjan...') as HTMLInputElement;
}

function titleInput() {
  return screen.getByPlaceholderText('Nom de la destination') as HTMLInputElement;
}

function descInput() {
  return screen.getByPlaceholderText('Description de la destination') as HTMLInputElement;
}

function altInput() {
  return screen.getByPlaceholderText("Description de l'image") as HTMLInputElement;
}

function featuredCheckbox() {
  return screen.getByRole('checkbox', { name: /Mettre en avant/ }) as HTMLInputElement;
}

function modal() {
  const el = document.querySelector('.verify-modal');
  if (!el) throw new Error('modale de confirmation absente');
  return within(el as HTMLElement);
}

function cityOptions() {
  const list = document.getElementById('admin-destination-city-options');
  if (!list) throw new Error('datalist des villes absent');
  return Array.from(list.querySelectorAll('option')).map((option) => option.getAttribute('value'));
}

function pickFile(name = 'destination.jpg', type = 'image/jpeg') {
  return new File(['contenu'], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  ciPartition = { big: [abidjan], small: [bassam] };
  bjPartition = { big: [ouidah, tori], small: [] };
  mocks.getDestinations.mockImplementation(async (market) =>
    market === 'CI' ? ciPartition : bjPartition,
  );
  mocks.createDestination.mockImplementation(async (data) =>
    makeDestination({ id: 'dst-new', created_at: '2026-02-01T00:00:00.000Z', ...data }),
  );
  mocks.updateDestination.mockImplementation(async (id, data) => makeDestination({ id, ...data }));
  mocks.deleteDestination.mockResolvedValue(undefined);
  mocks.uploadFile.mockResolvedValue({ url: '/uploads/destination.jpg', path: 'uploads/destination.jpg' });
  mocks.getEvents.mockResolvedValue([]);
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

describe('AdminDestinationsPage — chargement', () => {
  it("affiche l'état de chargement tant que les deux marchés ne sont pas résolus", () => {
    mocks.getDestinations.mockImplementation(() => new Promise<AdminTourismPartition>(() => {}));

    render(<AdminDestinationsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Destinations touristiques' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("interroge les deux marchés et affiche les lignes dans l'ordre serveur", async () => {
    render(<AdminDestinationsPage />);

    const scope = await tableReady();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    expect(mocks.getDestinations).toHaveBeenCalledTimes(2);
    expect(mocks.getDestinations).toHaveBeenNthCalledWith(1, 'CI');
    expect(mocks.getDestinations).toHaveBeenNthCalledWith(2, 'BJ');

    const titles = scope.getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
    expect(titles[0]).toContain('Abidjan la cocotière');
    expect(titles[1]).toContain('Grand-Bassam, ville historique');
    expect(titles[2]).toContain('Ouidah, cité vaudou');
    expect(titles[3]).toContain('Tori Bossito');
  });

  it("badge chaque ligne selon la partition servie par le backend", async () => {
    render(<AdminDestinationsPage />);
    const scope = await tableReady();

    expect(rowIn(scope, 'Abidjan la cocotière').getByText('Grande carte')).toBeInTheDocument();
    expect(rowIn(scope, 'Grand-Bassam, ville historique').getByText('Petite carte')).toBeInTheDocument();
    expect(rowIn(scope, 'Ouidah, cité vaudou').getByText('Grande carte')).toBeInTheDocument();
    expect(rowIn(scope, 'Tori Bossito').getByText('Mise en avant')).toBeInTheDocument();
    expect(rowIn(scope, 'Tori Bossito').getByText('Grande carte')).toBeInTheDocument();
  });

  it('affiche le message du réseau quand les deux marchés échouent', async () => {
    mocks.getDestinations.mockRejectedValue(new Error('réseau coupé'));

    render(<AdminDestinationsPage />);

    expect(await screen.findByText('Impossible de charger les destinations.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun marché ne renvoie de destination", async () => {
    ciPartition = { big: [], small: [] };
    bjPartition = { big: [], small: [] };

    render(<AdminDestinationsPage />);

    expect(await screen.findByText('Aucune destination trouvée.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('AdminDestinationsPage — filtres et suggestions', () => {
  it('ne garde que les destinations du marché sélectionné', async () => {
    render(<AdminDestinationsPage />);
    await tableReady();

    fireEvent.change(filterSelect(), { target: { value: 'BJ' } });

    const scope = table();
    expect(scope.getByText('Ouidah, cité vaudou')).toBeInTheDocument();
    expect(scope.queryByText('Abidjan la cocotière')).not.toBeInTheDocument();
    expect(scope.queryByText('Grand-Bassam, ville historique')).not.toBeInTheDocument();
  });

  it('propose les villes des destinations, des biens et des événements sans doublon', async () => {
    mocks.villes.mockResolvedValue(['Cotonou', 'abidjan']);
    mocks.getEvents.mockImplementation(async (market) =>
      market === 'CI'
        ? [{ city: 'Abidjan' }, { city: 'Bouaké' }]
        : [{ city: 'Ouidah' }, { city: 'OUIDAH' }],
    );

    render(<AdminDestinationsPage />);
    await tableReady();
    await waitFor(() => expect(cityOptions().length).toBeGreaterThan(0));

    const options = cityOptions();
    expect(options).toContain('Abidjan');
    expect(options).toContain('Cotonou');
    expect(options).toContain('Bouaké');
    expect(options).toContain('Ouidah');
    expect(options).toContain('Tori Bossito');
    expect(options).toContain('Grand-Bassam');
    expect(options.filter((value) => value?.toLowerCase() === 'ouidah')).toHaveLength(1);
    expect(options.filter((value) => value?.toLowerCase() === 'abidjan')).toHaveLength(1);
  });
});

describe('AdminDestinationsPage — création', () => {
  it("valide les champs obligatoires avant de toucher à l'image", async () => {
    render(<AdminDestinationsPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      screen.getByText('Ville, titre et description sont obligatoires.'),
    ).toBeInTheDocument();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.createDestination).not.toHaveBeenCalled();
  });

  it("exige une image quand aucune nouvelle image n'est fournie", async () => {
    render(<AdminDestinationsPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    setText(cityInput(), 'Grand-Popo');
    setText(titleInput(), 'Grand-Popo balnéaire');
    setText(descInput(), 'Plages du littoral');
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(screen.getByText('Veuillez sélectionner une image.')).toBeInTheDocument();
    expect(mocks.createDestination).not.toHaveBeenCalled();
  });

  it('crée une destination avec la ville normalisée et recharge la table', async () => {
    render(<AdminDestinationsPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(formMarketSelect().value).toBe('CI');
    expect(featuredCheckbox().checked).toBe(false);

    setText(cityInput(), 'Grand-Popo');
    setText(titleInput(), 'Grand-Popo balnéaire');
    setText(descInput(), 'Plages du littoral');
    setText(altInput(), 'Plage de Grand-Popo');
    fireEvent.change(fileInput(), { target: { files: [pickFile('popo.jpg')] } });
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createDestination).toHaveBeenCalledTimes(1));
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1);
    expect(mocks.createDestination).toHaveBeenCalledWith({
      market: 'CI',
      city: 'Grand-Popo',
      title: 'Grand-Popo balnéaire',
      description: 'Plages du littoral',
      alt: 'Plage de Grand-Popo',
      featured: false,
      img: '/uploads/destination.jpg',
    });
    // Rechargement silencieux des deux marchés après la création.
    await waitFor(() => expect(mocks.getDestinations).toHaveBeenCalledTimes(4));
    expect(document.querySelector('.banner-slide-panel--open')).toBeNull();
  });

  it('conserve la coche « Mettre en avant » dans le payload', async () => {
    render(<AdminDestinationsPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    setText(cityInput(), 'Grand-Popo');
    setText(titleInput(), 'Grand-Popo balnéaire');
    setText(descInput(), 'Plages du littoral');
    fireEvent.click(featuredCheckbox());
    expect(featuredCheckbox().checked).toBe(true);
    fireEvent.change(fileInput(), { target: { files: [pickFile('popo.jpg')] } });
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createDestination).toHaveBeenCalledTimes(1));
    expect(mocks.createDestination.mock.calls[0][0].featured).toBe(true);
  });

  it('change de marché via le sélecteur du formulaire', async () => {
    render(<AdminDestinationsPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    fireEvent.change(formMarketSelect(), { target: { value: 'BJ' } });
    setText(cityInput(), 'Natitingou');
    setText(titleInput(), 'Tata Somba');
    setText(descInput(), 'Cases fortifiées');
    fireEvent.change(fileInput(), { target: { files: [pickFile('somba.jpg')] } });
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createDestination).toHaveBeenCalledTimes(1));
    expect(mocks.createDestination.mock.calls[0][0].market).toBe('BJ');
  });

  it('accepte une image glissée-déposée sur la zone', async () => {
    render(<AdminDestinationsPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    setText(cityInput(), 'Natitingou');
    setText(titleInput(), 'Tata Somba');
    setText(descInput(), 'Cases fortifiées');
    fireEvent.drop(uploadZone(), { dataTransfer: { files: [pickFile('somba.jpg')] } });

    expect(uploadZone().querySelector('img')).not.toBeNull();
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.uploadFile).toHaveBeenCalledTimes(1));
    expect(mocks.createDestination.mock.calls[0][0].img).toBe('/uploads/destination.jpg');
  });

  it('referme le panneau sans rien envoyer quand on annule', async () => {
    render(<AdminDestinationsPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(panelRoot().classList.contains('banner-slide-panel--open')).toBe(true);

    await user().click(closeBtn());

    expect(panelRoot().classList.contains('banner-slide-panel--open')).toBe(false);
    expect(mocks.createDestination).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });
});

describe('AdminDestinationsPage — modification', () => {
  it('préremplit le formulaire avec la destination à modifier', async () => {
    render(<AdminDestinationsPage />);
    const scope = await tableReady();

    await user().click(rowIn(scope, 'Ouidah, cité vaudou').getByRole('button', { name: 'Modifier' }));

    expect(cityInput().value).toBe('Ouidah');
    expect(titleInput().value).toBe('Ouidah, cité vaudou');
    expect(descInput().value).toBe('La route des esclaves');
    expect(formMarketSelect().value).toBe('BJ');
    expect(featuredCheckbox().checked).toBe(false);
    expect(screen.getByRole('heading', { level: 2, name: 'Modifier la destination' })).toBeInTheDocument();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it('met à jour sans réuploader le fichier existant', async () => {
    render(<AdminDestinationsPage />);
    const scope = await tableReady();

    await user().click(rowIn(scope, 'Ouidah, cité vaudou').getByRole('button', { name: 'Modifier' }));
    setText(titleInput(), 'Ouidah, cité du vaudou');
    fireEvent.click(featuredCheckbox());
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.updateDestination).toHaveBeenCalledTimes(1));
    const [id, payload] = mocks.updateDestination.mock.calls[0];
    expect(id).toBe('dst-bj-1');
    expect(payload.title).toBe('Ouidah, cité du vaudou');
    expect(payload.featured).toBe(true);
    expect(payload.img).toBe('/img/ouidah.jpg');
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.createDestination).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.getDestinations).toHaveBeenCalledTimes(4));
  });

  it("affiche l'erreur quand la sauvegarde échoue", async () => {
    mocks.updateDestination.mockRejectedValue(new Error('titre déjà pris'));

    render(<AdminDestinationsPage />);
    const scope = await tableReady();

    await user().click(rowIn(scope, 'Ouidah, cité vaudou').getByRole('button', { name: 'Modifier' }));
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('titre déjà pris')).toBeInTheDocument();
    expect(mocks.getDestinations).toHaveBeenCalledTimes(2);
  });
});

describe('AdminDestinationsPage — suppression', () => {
  it('supprime après confirmation et recharge les deux marchés', async () => {
    render(<AdminDestinationsPage />);
    const scope = await tableReady();

    await user().click(rowIn(scope, 'Grand-Bassam, ville historique').getByRole('button', { name: 'Supprimer' }));

    expect(modal().getByText('Supprimer cette destination ?')).toBeInTheDocument();
    await user().click(modal().getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(mocks.deleteDestination).toHaveBeenCalledWith('dst-ci-2'));
    await waitFor(() => expect(mocks.getDestinations).toHaveBeenCalledTimes(4));
    expect(document.querySelector('.verify-modal')).toBeNull();
  });

  it('annule la suppression quand on ferme la modale', async () => {
    render(<AdminDestinationsPage />);
    const scope = await tableReady();

    await user().click(rowIn(scope, 'Grand-Bassam, ville historique').getByRole('button', { name: 'Supprimer' }));
    await user().click(modal().getByRole('button', { name: 'Annuler' }));

    expect(document.querySelector('.verify-modal')).toBeNull();
    expect(mocks.deleteDestination).not.toHaveBeenCalled();
  });

  it("affiche une erreur quand la suppression échoue", async () => {
    mocks.deleteDestination.mockRejectedValue(new Error('en service'));

    render(<AdminDestinationsPage />);
    const scope = await tableReady();

    await user().click(rowIn(scope, 'Grand-Bassam, ville historique').getByRole('button', { name: 'Supprimer' }));
    await user().click(modal().getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByText('Erreur lors de la suppression.')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
