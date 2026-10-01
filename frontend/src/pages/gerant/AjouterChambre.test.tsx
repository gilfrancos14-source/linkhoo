import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import AjouterChambre from './AjouterChambre';
import type { Category } from '../../data/categories';

// jsdom n'implémente pas createObjectURL/revokeObjectURL : le composant les
// appelle dès la sélection d'une photo → stub hoisté avant les vi.mock.
const stubs = vi.hoisted(() => {
  let seq = 0;
  const created: string[] = [];
  const createObjectURL = vi.fn(() => {
    seq += 1;
    const url = `blob:preview-${seq}`;
    created.push(url);
    return url;
  });
  const revokeObjectURL = vi.fn(() => undefined);
  if (typeof URL !== 'undefined') {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
  }
  return { createObjectURL, revokeObjectURL, created, reset: () => { seq = 0; created.length = 0; } };
});

const mocks = vi.hoisted(() => ({
  createRoom: vi.fn<(room: Record<string, unknown>) => Promise<{ id: string }>>(),
  fetchCategoriesByMarket: vi.fn<(market: string) => Promise<Category[]>>(),
  villes: vi.fn<(market?: string) => Promise<string[]>>(),
  upload: vi.fn<(file: File, bucket?: string) => Promise<{ url: string; path: string }>>(),
}));

vi.mock('../../lib/api', () => ({
  apiRooms: { villes: mocks.villes },
  apiUpload: { upload: mocks.upload },
}));

vi.mock('../../data/rooms', () => ({
  createRoom: mocks.createRoom,
}));

vi.mock('../../data/categories', () => ({
  fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
}));

const categories: Category[] = [
  { id: 'cat-appart', title: 'Appartements', img: '/a.jpg', alt: 'A', market: 'CI' },
  { id: 'cat-hotel', title: 'Hôtels', img: '/h.jpg', alt: 'H', market: 'CI' },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderForm(entry = '/ci/gerant/ajouter') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Routes>
          <Route path="/:market/gerant/ajouter" element={<AjouterChambre />} />
          <Route path="/:market/gerant/chambres" element={<p>Liste des chambres</p>} />
        </Routes>
        <LocationProbe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function steps(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.step'));
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('champ fichier introuvable');
  return input;
}

/**
 * Sélecteur de catégorie. `<datalist>` porte aussi le rôle `combobox`
 * sous jsdom : on cible l'élément `<select>` plutôt qu'un rôle partagé.
 */
function categorySelect(): HTMLSelectElement {
  const el = document.querySelector('select');
  if (!(el instanceof HTMLSelectElement)) throw new Error('sélecteur de catégorie introuvable');
  return el;
}

function makeFile(name = 'photo.jpg', size = 1024, type = 'image/jpeg'): File {
  const file = new File(['x'], name, { type });
  if (size !== 1024) Object.defineProperty(file, 'size', { value: size });
  return file;
}

async function selectPhoto(file: File) {
  fireEvent.change(fileInput(), { target: { files: [file] } });
  await act(async () => {});
}

/** Saisie instantanée : `userEvent.type` caractère par caractère est trop lent
 *  sous jsdom chargé et déclenche les timeouts de 5 s des scénarios longs. */
function setText(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

/** Remplit intégralement l'étape 1 et passe à l'étape 2. */
async function fillStep1(overrides: Partial<{ title: string; ville: string; quartier: string; description: string; category: string }> = {}) {
  // Les catégories arrivent en async : sans elles le select est incomplet et
  // la validation bloquerait sur « Choisissez une catégorie ».
  await screen.findByRole('option', { name: 'Appartements' });
  setText(screen.getByPlaceholderText(/Appartement familial/), overrides.title ?? 'Studio Belle');
  setText(screen.getByPlaceholderText(/Cotonou/), overrides.ville ?? 'Cotonou');
  setText(screen.getByPlaceholderText(/Centre-ville/), overrides.quartier ?? 'Haie Vive');
  setText(screen.getByPlaceholderText(/Décrivez l/), overrides.description ?? 'Vue sur mer, calme absolu.');
  await userEvent.selectOptions(categorySelect(), overrides.category ?? 'cat-appart');
  await userEvent.click(screen.getByRole('button', { name: /Étape suivante/ }));
}

/** Passe de l'étape 2 à l'étape 3. */
async function fillStep2() {
  setText(screen.getByPlaceholderText('660'), '660');
  setText(screen.getByPlaceholderText(/Caution 1 mois/), 'Caution 1 mois, durée min 6 mois.');
  await userEvent.click(screen.getByRole('button', { name: /Étape suivante/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  stubs.reset();
  mocks.createRoom.mockResolvedValue({ id: 'new-room' });
  mocks.fetchCategoriesByMarket.mockResolvedValue(categories);
  mocks.villes.mockResolvedValue(['Cotonou', 'Abidjan', 'Lomé']);
  mocks.upload.mockImplementation(async (file: File) => ({
    url: `https://cdn.test/${file.name}`,
    path: `rooms/${file.name}`,
  }));
});

afterEach(() => {
  cleanup();
});

describe('en-tête, étapes et navigation', () => {
  it('présente le titre, l’intro et le bouton de retour à la liste', () => {
    renderForm();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Ajouter un appartement' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Remplissez les informations ci-dessous pour enregistrer un nouvel appartement.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retour/ })).toBeInTheDocument();
  });

  it('mène à la liste des chambres au clic sur « ← Retour »', async () => {
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: /Retour/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/ci/gerant/chambres');
    expect(screen.getByText('Liste des chambres')).toBeInTheDocument();
  });

  it('affiche les quatre étapes avec Identification active au départ', () => {
    const { container } = renderForm();

    const all = steps(container);
    expect(all).toHaveLength(4);
    expect(all[0]).toHaveClass('step--active');
    expect(all[0]).not.toHaveClass('step--done');
    expect(all[0]).toHaveTextContent('Identification');
    expect(all[1]).toHaveTextContent('Détails');
    expect(all[2]).toHaveTextContent('Photos');
    expect(all[3]).toHaveTextContent('Aperçu');
    expect(screen.queryByPlaceholderText('660')).toBeNull();
  });

  it('marque les étapes franchies comme terminées', async () => {
    const { container } = renderForm();

    await fillStep1();

    const all = steps(container);
    expect(all[0]).toHaveClass('step--done');
    expect(all[0]).not.toHaveClass('step--active');
    expect(all[1]).toHaveClass('step--active');
    expect(all[1]).not.toHaveClass('step--done');
  });
});

describe('étape 1 — identification', () => {
  it('bloque l’avancée tant que les cinq champs requis sont vides', async () => {
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: /Étape suivante/ }));

    expect(screen.getByText('Le titre est requis')).toBeInTheDocument();
    expect(screen.getByText('La ville est requise')).toBeInTheDocument();
    expect(screen.getByText('Le quartier est requis')).toBeInTheDocument();
    expect(screen.getByText('La description est requise')).toBeInTheDocument();
    expect(screen.getByText('Choisissez une catégorie')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('660')).toBeNull();
  });

  it('ne signale que les champs réellement vides', async () => {
    renderForm();

    setText(screen.getByPlaceholderText(/Appartement familial/), 'Studio');
    await userEvent.click(screen.getByRole('button', { name: /Étape suivante/ }));

    expect(screen.queryByText('Le titre est requis')).toBeNull();
    expect(screen.getByText('La ville est requise')).toBeInTheDocument();
    expect(screen.getByText('La description est requise')).toBeInTheDocument();
  });

  it('efface l’erreur d’un champ dès la première saisie', async () => {
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: /Étape suivante/ }));
    expect(screen.getByText('Le titre est requis')).toBeInTheDocument();

    setText(screen.getByPlaceholderText(/Appartement familial/), 'S');

    expect(screen.queryByText('Le titre est requis')).toBeNull();
  });

  it('passe à l’étape Détails quand tout est renseigné', async () => {
    const { container } = renderForm();

    await fillStep1();

    expect(steps(container)[1]).toHaveClass('step--active');
    expect(screen.getByPlaceholderText('660')).toBeInTheDocument();
    expect(screen.queryByText('Le titre est requis')).toBeNull();
  });

  it('propose les catégories du marché dans le sélecteur', async () => {
    renderForm();

    expect(screen.getByRole('option', { name: 'Choisir une catégorie' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Appartements' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hôtels' })).toBeInTheDocument();
    expect(categorySelect()).toHaveValue('');
    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('CI');
  });

  it('propose les suggestions de ville du marché dans la liste guidée', async () => {
    renderForm();

    await waitFor(() => expect(mocks.villes).toHaveBeenCalledWith('CI'));
    const options = document.querySelectorAll('#gerant-room-city-options option');
    expect(options).toHaveLength(3);
    expect(options[1]).toHaveAttribute('value', 'Abidjan');
    expect(options[2]).toHaveAttribute('value', 'Lomé');
    expect(screen.getByPlaceholderText(/Cotonou/)).toHaveAttribute(
      'list',
      'gerant-room-city-options',
    );
  });

  it('interroge catégories et villes du marché BJ sur une URL /bj', async () => {
    renderForm('/bj/gerant/ajouter');

    await waitFor(() => expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('BJ'));
    await waitFor(() => expect(mocks.villes).toHaveBeenCalledWith('BJ'));
  });
});

describe('étape 2 — détails', () => {
  beforeEach(async () => {
    renderForm();
    await fillStep1();
  });

  it('exige un prix strictement supérieur à zéro', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Étape suivante/ }));

    expect(screen.getByText('Le prix doit être supérieur à 0')).toBeInTheDocument();
    expect(screen.queryByText('Photos *')).toBeNull();
    expect(steps(document.querySelector('.add-room') as HTMLElement)[1]).toHaveClass(
      'step--active',
    );
  });

  it('exige les conditions de réservation', async () => {
    setText(screen.getByPlaceholderText('660'), '660');
    await userEvent.click(screen.getByRole('button', { name: /Étape suivante/ }));

    expect(screen.getByText('Les conditions sont requises')).toBeInTheDocument();
    expect(screen.queryByText('Le prix doit être supérieur à 0')).toBeNull();
  });

  it('passe à l’étape Photos avec un prix et des conditions valides', async () => {
    await fillStep2();

    expect(screen.getByText('Photos *')).toBeInTheDocument();
    expect(screen.queryByText('Ajoutez au moins une photo')).toBeNull();
  });

  it('revient à l’étape Identification en conservant les valeurs saisies', async () => {
    await fillStep2();
    expect(screen.getByText('Photos *')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Étape précédente/ }));
    await userEvent.click(screen.getByRole('button', { name: /Étape précédente/ }));

    expect(screen.getByPlaceholderText(/Appartement familial/)).toHaveValue('Studio Belle');
    expect(categorySelect()).toHaveValue('cat-appart');
  });

  it('bascule l’unité de prix entre par mois et par nuit', async () => {
    // Le groupe est enveloppé dans un <label> englobant : le nom accessible
    // calculé du premier radio devient « Unité de prix Par moisPar nuit »,
    // on cible donc les entrées par leur attribut name.
    const [parMois, parNuit] = document.querySelectorAll<HTMLInputElement>(
      'input[name="priceUnit"]',
    );
    expect(parMois).toBeChecked();

    await userEvent.click(parNuit!);

    expect(parNuit).toBeChecked();
    expect(parMois).not.toBeChecked();
  });

  it('mémorise le nombre de chambres, de douches et le marquage populaire', async () => {
    const chambres = screen.getByLabelText('Nombre de chambres');
    const douches = screen.getByLabelText('Nombre de douches');
    expect(chambres).toHaveValue(1);
    expect(douches).toHaveValue(1);

    setText(chambres, '3');
    setText(douches, '2');
    await userEvent.click(screen.getByRole('checkbox'));

    expect(chambres).toHaveValue(3);
    expect(douches).toHaveValue(2);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it("ne demande aucune capacité", async () => {
    expect(screen.queryByLabelText(/Capacité/)).not.toBeInTheDocument();
  });
});

describe('étape 3 — photos', () => {
  beforeEach(async () => {
    renderForm();
    await fillStep1();
    await fillStep2();
  });

  it('refuse d’aller à l’aperçu sans aucune photo', async () => {
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));

    expect(screen.getByText('Ajoutez au moins une photo')).toBeInTheDocument();
    expect(screen.queryByText('Aperçu — voici comment le client verra votre annonce')).toBeNull();
  });

  it('ajoute une photo et la marque comme principale', async () => {
    await selectPhoto(makeFile('chambre.jpg'));

    expect(screen.getByAltText('Photo 1')).toBeInTheDocument();
    expect(screen.getByText('Principale')).toBeInTheDocument();
    expect(stubs.createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ajoutez au moins une photo')).toBeNull();
  });

  it('accepte au maximum trois photos', async () => {
    await selectPhoto(makeFile('a.jpg'));
    await selectPhoto(makeFile('b.jpg'));
    await selectPhoto(makeFile('c.jpg'));

    expect(screen.getByAltText('Photo 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter' })).toBeNull();

    await selectPhoto(makeFile('d.jpg'));

    expect(screen.queryByAltText('Photo 4')).toBeNull();
    expect(screen.getAllByTitle('Supprimer')).toHaveLength(3);
    expect(screen.getByText(/Maximum 3 photos/)).toBeInTheDocument();
  });

  it('reactive le bouton Ajouter apres une suppression', async () => {
    await selectPhoto(makeFile('a.jpg'));
    await selectPhoto(makeFile('b.jpg'));
    await selectPhoto(makeFile('c.jpg'));
    await selectPhoto(makeFile('d.jpg'));

    expect(screen.queryByRole('button', { name: 'Ajouter' })).toBeNull();

    await userEvent.click(screen.getAllByTitle('Supprimer')[2]);

    expect(screen.queryByText(/Maximum 3 photos/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it('refuse un fichier plus lourd que 2 Mo', async () => {
    await selectPhoto(makeFile('geant.jpg', 3 * 1024 * 1024));

    expect(screen.getByText(/dépasse 2 Mo/)).toBeInTheDocument();
    expect(screen.queryByAltText('Photo 1')).toBeNull();
    expect(stubs.createObjectURL).not.toHaveBeenCalled();
  });

  it('accueille plusieurs photos et transfère le badge de principale', async () => {
    await selectPhoto(makeFile('a.jpg'));
    await selectPhoto(makeFile('b.jpg'));

    expect(screen.getByAltText('Photo 1')).toBeInTheDocument();
    expect(screen.getByAltText('Photo 2')).toBeInTheDocument();
    expect(screen.getByText('Principale')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Définir comme principale'));

    expect(screen.getAllByText('Principale')).toHaveLength(1);
    expect(screen.getByAltText('Photo 2').closest('.photo-card')).toHaveClass('photo-card--main');
  });

  it('supprime une photo et réattribue la principale', async () => {
    await selectPhoto(makeFile('a.jpg'));
    await selectPhoto(makeFile('b.jpg'));

    await userEvent.click(screen.getAllByTitle('Supprimer')[1]);

    expect(screen.queryByAltText('Photo 2')).toBeNull();
    expect(screen.getByAltText('Photo 1')).toBeInTheDocument();
    expect(screen.getByText('Principale')).toBeInTheDocument();
  });

  it('vérifie le récapitulatif du bandeau d’étapes avant l’aperçu', async () => {
    const { container } = renderForm();
    await fillStep1();
    await fillStep2();

    const all = steps(container);
    expect(all[0]).toHaveClass('step--done');
    expect(all[1]).toHaveClass('step--done');
    expect(all[2]).toHaveClass('step--active');
    expect(all[3]).not.toHaveClass('step--active');
  });
});

describe('étape 4 — aperçu et enregistrement', () => {
  async function reachPreview() {
    await fillStep1();
    await fillStep2();
    await selectPhoto(makeFile('chambre.jpg'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));
  }

  it('affiche le récapitulatif de l’annonce vu par le client', async () => {
    renderForm();
    await reachPreview();

    expect(
      screen.getByText('Aperçu — voici comment le client verra votre annonce'),
    ).toBeInTheDocument();
    expect(screen.getByText('Cotonou, Haie Vive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Studio Belle' })).toBeInTheDocument();
    expect(screen.getByText('1 ch. · 1 d.')).toBeInTheDocument();
    expect(screen.getByText('660')).toBeInTheDocument();
    expect(screen.getByText('FCFA / mois')).toBeInTheDocument();
    expect(screen.getByText('Vue sur mer, calme absolu.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Conditions de réservation' }),
    ).toBeInTheDocument();
  });

  it('découpe les conditions en liste à puces', async () => {
    renderForm();
    await reachPreview();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Caution 1 mois');
    expect(items[1]).toHaveTextContent('durée min 6 mois.');
  });

  it('navigue dans la galerie de photos avec les flèches et les miniatures', async () => {
    renderForm();
    await fillStep1();
    await fillStep2();
    await selectPhoto(makeFile('a.jpg'));
    await selectPhoto(makeFile('b.jpg'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await userEvent.click(document.querySelector('.preview-arrow--next')!);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    await userEvent.click(document.querySelector('.preview-arrow--next')!);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await userEvent.click(document.querySelector('.preview-arrow--prev')!);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('enregistre la chambre en téléversant chaque photo', async () => {
    renderForm();
    await fillStep1();
    await fillStep2();
    await selectPhoto(makeFile('a.jpg'));
    await selectPhoto(makeFile('b.jpg'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l'appartement/ }));

    await waitFor(() => expect(mocks.createRoom).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.upload).toHaveBeenNthCalledWith(1, expect.any(File));
    expect(mocks.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Studio Belle',
        ville: 'Cotonou',
        quartier: 'Haie Vive',
        description: 'Vue sur mer, calme absolu.',
        subtitle: 'Vue sur mer, calme absolu.',
        category: 'cat-appart',
        priceNum: 660,
        price: '660',
        priceUnit: '/ mois',
        chambres: 1,
        douches: 1,
        market: 'CI',
        pays: "Côte d'Ivoire",
        disponible: true,
        isPopular: false,
        images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
        img: 'https://cdn.test/a.jpg',
      }),
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Appartement enregistré !' })).toBeInTheDocument();
  });

  it('prend la photo choisie comme principale pour l’image de couverture', async () => {
    renderForm();
    await fillStep1();
    await fillStep2();
    await selectPhoto(makeFile('a.jpg'));
    await selectPhoto(makeFile('b.jpg'));
    await userEvent.click(screen.getByTitle('Définir comme principale'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l'appartement/ }));

    await waitFor(() => expect(mocks.createRoom).toHaveBeenCalledTimes(1));
    expect(mocks.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ img: 'https://cdn.test/b.jpg' }),
    );
  });

  it('transmet le marquage populaire et l’unité de prix saisis', async () => {
    renderForm();
    await fillStep1();
    const [, parNuit] = document.querySelectorAll<HTMLInputElement>('input[name="priceUnit"]');
    await userEvent.click(parNuit!);
    await userEvent.click(screen.getByRole('checkbox'));
    await fillStep2();
    await selectPhoto(makeFile('a.jpg'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l'appartement/ }));

    await waitFor(() => expect(mocks.createRoom).toHaveBeenCalledTimes(1));
    expect(mocks.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ isPopular: true, priceUnit: '/ nuit' }),
    );
  });

  it('publie sur le marché BJ avec le pays correspondant', async () => {
    renderForm('/bj/gerant/ajouter');
    await fillStep1();
    await fillStep2();
    await selectPhoto(makeFile('a.jpg'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l'appartement/ }));

    await waitFor(() => expect(mocks.createRoom).toHaveBeenCalledTimes(1));
    expect(mocks.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ market: 'BJ', pays: 'Bénin' }),
    );
  });

  it('affiche l’état « Enregistrement... » et verrouille les boutons', async () => {
    let resolveSave: (() => void) | null = null;
    mocks.createRoom.mockImplementation(
      () => new Promise((resolve) => { resolveSave = () => resolve({ id: 'x' }); }),
    );
    renderForm();
    await fillStep1();
    await fillStep2();
    await selectPhoto(makeFile('a.jpg'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l'appartement/ }));

    const save = screen.getByRole('button', { name: /Enregistrement/ });
    expect(save).toBeDisabled();
    expect(screen.getByRole('button', { name: /Étape précédente/ })).toBeDisabled();

    await act(async () => { resolveSave?.(); });
    expect(await screen.findByRole('heading', { level: 2, name: 'Appartement enregistré !' })).toBeInTheDocument();
  });

  it('remonte le message d’erreur du service', async () => {
    mocks.createRoom.mockRejectedValue(new Error('Titre déjà utilisé'));
    renderForm();
    await fillStep1();
    await fillStep2();
    await selectPhoto(makeFile('a.jpg'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l'appartement/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Titre déjà utilisé');
    expect(screen.getByRole('button', { name: /Enregistrer l'appartement/ })).toBeEnabled();
  });

  it("affiche un message générique quand l'erreur n'est pas une Error", async () => {
    mocks.createRoom.mockRejectedValue('boom');
    renderForm();
    await fillStep1();
    await fillStep2();
    await selectPhoto(makeFile('a.jpg'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l'appartement/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('L\'enregistrement a échoué. Veuillez réessayer.');
  });

  it('reste bloqué sur l’étape Photos tant qu’aucune photo n’est ajoutée', async () => {
    renderForm();
    await fillStep1();
    await fillStep2();
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));

    expect(screen.getByText('Ajoutez au moins une photo')).toBeInTheDocument();
    expect(screen.queryByText('Aucune photo')).toBeNull();
    expect(steps(document.querySelector('.add-room') as HTMLElement)[2]).toHaveClass(
      'step--active',
    );
  });
});

describe('écran de succès', () => {
  async function saveOne() {
    await fillStep1();
    await fillStep2();
    await selectPhoto(makeFile('a.jpg'));
    await userEvent.click(screen.getByRole('button', { name: /aperçu/i }));
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer l'appartement/ }));
    await screen.findByRole('heading', { level: 2, name: 'Appartement enregistré !' });
  }

  it('confirme l’ajout avec le titre de l’annonce', async () => {
    renderForm();
    await saveOne();

    expect(screen.getByText('Studio Belle a été ajouté avec succès.')).toBeInTheDocument();
    expect(mocks.createRoom).toHaveBeenCalledTimes(1);
  });

  it('« Ajouter un autre » réinitialise entièrement le formulaire', async () => {
    const { container } = renderForm();
    await saveOne();

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un autre' }));

    expect(screen.getByPlaceholderText(/Appartement familial/)).toHaveValue('');
    expect(categorySelect()).toHaveValue('');
    expect(screen.queryByAltText('Photo 1')).toBeNull();
    expect(steps(container)[0]).toHaveClass('step--active');
    expect(mocks.createRoom).toHaveBeenCalledTimes(1);
  });

  it('« Retour à la liste » ramène au catalogue des chambres', async () => {
    renderForm();
    await saveOne();

    await userEvent.click(screen.getByRole('button', { name: 'Retour à la liste' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/ci/gerant/chambres');
    expect(screen.getByText('Liste des chambres')).toBeInTheDocument();
  });
});
