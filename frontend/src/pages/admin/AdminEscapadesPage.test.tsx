import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminEscapadesPage from './AdminEscapadesPage';
import type { AdminEscapade } from '../../lib/adminApi';

type EscapadePayload = Omit<AdminEscapade, 'id' | 'created_at'>;

const mocks = vi.hoisted(() => ({
  getEscapades: vi.fn<(market: string) => Promise<AdminEscapade[]>>(),
  createEscapade: vi.fn<(data: EscapadePayload) => Promise<AdminEscapade>>(),
  updateEscapade: vi.fn<(id: string, data: Partial<EscapadePayload>) => Promise<AdminEscapade>>(),
  deleteEscapade: vi.fn<(id: string) => Promise<void>>(),
  uploadFile: vi.fn<(file: File) => Promise<{ url: string; path: string }>>(),
  createBlob: vi.fn<() => string>(),
  revokeBlob: vi.fn<(url: string) => void>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    getEscapades: mocks.getEscapades,
    createEscapade: mocks.createEscapade,
    updateEscapade: mocks.updateEscapade,
    deleteEscapade: mocks.deleteEscapade,
    uploadFile: mocks.uploadFile,
  },
}));

function makeEscapade(overrides: Partial<AdminEscapade> = {}): AdminEscapade {
  return {
    id: 'esc-ci-assinie',
    market: 'CI',
    lieu: 'Assinie',
    description: 'Plages, lagunes et balades entre cocotiers.',
    images: ['/img/assinie.jpg'],
    created_at: '2026-01-05T10:00:00.000Z',
    ...overrides,
  };
}

const assinie = makeEscapade();
const bassam = makeEscapade({
  id: 'esc-ci-grand-bassam',
  lieu: 'Grand-Bassam',
  description: 'Front de mer et patrimoine.',
  images: ['/img/bassam.jpg', '/img/bassam-2.jpg'],
});
const ouidah = makeEscapade({
  id: 'esc-bj-ouidah',
  market: 'BJ',
  lieu: 'Ouidah',
  description: "Plages, musée d'histoire et balades.",
  images: ['/img/ouidah.jpg'],
});

function user() {
  return userEvent.setup({ delay: null, pointerEventsCheck: 0 });
}

function setText(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

function table() {
  return within(screen.getByRole('table'));
}

async function tableReady() {
  return within(await screen.findByRole('table'));
}

function filterSelect() {
  const el = document.querySelector('.gerants-filter-card__select');
  if (!el) throw new Error('sélecteur de marché absent');
  return el as HTMLSelectElement;
}

function formMarketSelect() {
  const el = document.querySelector('.banner-field select');
  if (!el) throw new Error('sélecteur de marché du formulaire absent');
  return el as HTMLSelectElement;
}

function fileInput() {
  const el = document.querySelector('.banner-slide-panel input[type="file"]');
  if (!el) throw new Error('champ fichier absent');
  return el as HTMLInputElement;
}

function lieuInput() {
  return screen.getByPlaceholderText('Ouidah, Ganvié, Assinie...') as HTMLInputElement;
}

function descInput() {
  return screen.getByPlaceholderText(/Description de l'escapade/) as HTMLInputElement;
}

function modal() {
  const el = document.querySelector('.verify-modal');
  if (!el) throw new Error('modale de confirmation absente');
  return within(el as HTMLElement);
}

function pickFile(name = 'photo.jpg', type = 'image/jpeg') {
  return new File(['contenu'], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Seuls CI et BJ ont des escapades dans ces fixtures : les autres marchés
  // (interrogés par la page) renvoient un tableau vide.
  mocks.getEscapades.mockImplementation(async (market) =>
    market === 'CI' ? [assinie, bassam] : market === 'BJ' ? [ouidah] : [],
  );
  mocks.createEscapade.mockImplementation(async (data) =>
    makeEscapade({ id: 'esc-new', created_at: '2026-02-01T00:00:00.000Z', ...data }),
  );
  mocks.updateEscapade.mockImplementation(async (id, data) => makeEscapade({ id, ...data }));
  mocks.deleteEscapade.mockResolvedValue(undefined);
  mocks.uploadFile.mockImplementation(async (file) => ({
    url: `/uploads/${file.name}`,
    path: `uploads/${file.name}`,
  }));

  // jsdom n'implémente pas les URL d'objet blob.
  let counter = 0;
  mocks.createBlob.mockImplementation(() => `blob:preview-${++counter}`);
  URL.createObjectURL = mocks.createBlob as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = mocks.revokeBlob as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  cleanup();
});

describe('AdminEscapadesPage — chargement', () => {
  it("affiche l'état de chargement tant que les escapades ne sont pas résolues", () => {
    mocks.getEscapades.mockImplementation(() => new Promise<AdminEscapade[]>(() => {}));
    render(<AdminEscapadesPage />);
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('concatène les escapades de tous les marchés interrogés', async () => {
    render(<AdminEscapadesPage />);

    // Le lieu apparaît dans la table desktop ET les cartes mobiles : on attend
    // la table (élément unique) plutôt qu'un findByText ambigu.
    const scope = await tableReady();
    expect(scope.getByText('Grand-Bassam')).toBeInTheDocument();
    expect(scope.getByText('Ouidah')).toBeInTheDocument();
    expect(mocks.getEscapades).toHaveBeenCalledTimes(12);
  });

  it('affiche la couverture (images[0]) et le nombre d’images', async () => {
    render(<AdminEscapadesPage />);

    const scope = await tableReady();
    expect(scope.getByAltText('Assinie')).toHaveAttribute('src', '/img/assinie.jpg');
    // Assinie et Ouidah ont 1 image, Grand-Bassam en a 2 (scoppé à la table :
    // les cartes mobiles répètent les mêmes libellés).
    expect(scope.getAllByText('1 image')).toHaveLength(2);
    expect(scope.getByText('2 images')).toBeInTheDocument();
  });

  it("affiche l'erreur quand le chargement échoue", async () => {
    mocks.getEscapades.mockRejectedValue(new Error('boom'));
    render(<AdminEscapadesPage />);

    expect(await screen.findByText('Impossible de charger les escapades.')).toBeInTheDocument();
  });

  it("affiche le message vide quand aucun marché n'a de carte", async () => {
    mocks.getEscapades.mockResolvedValue([]);
    render(<AdminEscapadesPage />);

    expect(await screen.findByText('Aucune escapade trouvée.')).toBeInTheDocument();
  });
});

describe('AdminEscapadesPage — filtre par marché', () => {
  it('ne garde que les escapades du marché sélectionné', async () => {
    render(<AdminEscapadesPage />);

    await tableReady();

    fireEvent.change(filterSelect(), { target: { value: 'BJ' } });

    await waitFor(() => expect(table().queryByText('Assinie')).toBeNull());
    expect(table().getByText('Ouidah')).toBeInTheDocument();
  });
});

describe('AdminEscapadesPage — création', () => {
  it('ouvre le panneau et vide le formulaire', async () => {
    render(<AdminEscapadesPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(screen.getByText("Ajouter une escapade")).toBeInTheDocument();
    expect(lieuInput().value).toBe('');
    expect(descInput().value).toBe('');
  });

  it('refuse la sauvegarde sans lieu ni description', async () => {
    render(<AdminEscapadesPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Lieu et description sont obligatoires.')).toBeInTheDocument();
    expect(mocks.createEscapade).not.toHaveBeenCalled();
  });

  it('refuse la sauvegarde sans image', async () => {
    render(<AdminEscapadesPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    setText(lieuInput(), 'Koussé');
    setText(descInput(), 'Chutes et nature.');
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Ajoutez au moins une image (1 à 5).')).toBeInTheDocument();
    expect(mocks.createEscapade).not.toHaveBeenCalled();
  });

  it('crée une escapade avec image uploadée, market, lieu et description', async () => {
    render(<AdminEscapadesPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    setText(lieuInput(), 'Koussé');
    setText(descInput(), 'Chutes et nature.');
    formMarketSelect().value = 'CI';
    fireEvent.change(formMarketSelect(), { target: { value: 'CI' } });

    fireEvent.change(fileInput(), { target: { files: [pickFile('kousse.jpg')] } });
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createEscapade).toHaveBeenCalledTimes(1));
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1);
    expect(mocks.createEscapade).toHaveBeenCalledWith({
      market: 'CI',
      lieu: 'Koussé',
      description: 'Chutes et nature.',
      images: ['/uploads/kousse.jpg'],
    });
  });

  it('upload plusieurs images dans lordre (couverture en premier)', async () => {
    render(<AdminEscapadesPage />);
    await tableReady();

    await user().click(screen.getByRole('button', { name: 'Ajouter' }));
    setText(lieuInput(), 'Koussé');
    setText(descInput(), 'Chutes et nature.');

    fireEvent.change(fileInput(), {
      target: { files: [pickFile('cover.jpg'), pickFile('second.jpg')] },
    });
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.createEscapade).toHaveBeenCalledTimes(1));
    expect(mocks.createEscapade).toHaveBeenCalledWith(
      expect.objectContaining({ images: ['/uploads/cover.jpg', '/uploads/second.jpg'] }),
    );
  });
});

describe('AdminEscapadesPage — modification', () => {
  it('préremplit le formulaire depuis l’escapade existante', async () => {
    render(<AdminEscapadesPage />);
    await tableReady();

    const scope = table();
    const row = scope.getByText('Assinie').closest('tr');
    await user().click(within(row as HTMLElement).getByRole('button', { name: 'Modifier' }));

    expect(screen.getByText("Modifier l'escapade")).toBeInTheDocument();
    expect(lieuInput().value).toBe('Assinie');
    expect(descInput().value).toBe('Plages, lagunes et balades entre cocotiers.');
    // L’image existante est affichée (pas de fichier en attente).
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it('met à jour sans re-uploader l’image déjà en base', async () => {
    render(<AdminEscapadesPage />);
    await tableReady();

    const scope = table();
    const row = scope.getByText('Assinie').closest('tr');
    await user().click(within(row as HTMLElement).getByRole('button', { name: 'Modifier' }));

    setText(descInput(), 'Nouvelle description.');
    await user().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.updateEscapade).toHaveBeenCalledTimes(1));
    expect(mocks.updateEscapade).toHaveBeenCalledWith('esc-ci-assinie', {
      market: 'CI',
      lieu: 'Assinie',
      description: 'Nouvelle description.',
      images: ['/img/assinie.jpg'],
    });
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });
});

describe('AdminEscapadesPage — suppression', () => {
  it('confirme puis supprime', async () => {
    render(<AdminEscapadesPage />);
    await tableReady();

    const scope = table();
    const row = scope.getByText('Assinie').closest('tr');
    await user().click(within(row as HTMLElement).getByRole('button', { name: 'Supprimer' }));

    expect(modal().getByText('Supprimer cette escapade ?')).toBeInTheDocument();

    await user().click(modal().getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(mocks.deleteEscapade).toHaveBeenCalledWith('esc-ci-assinie'));
  });

  it('annule la suppression', async () => {
    render(<AdminEscapadesPage />);
    await tableReady();

    const scope = table();
    const row = scope.getByText('Assinie').closest('tr');
    await user().click(within(row as HTMLElement).getByRole('button', { name: 'Supprimer' }));

    await user().click(modal().getByRole('button', { name: 'Annuler' }));

    expect(document.querySelector('.verify-modal')).toBeNull();
    expect(mocks.deleteEscapade).not.toHaveBeenCalled();
  });
});
