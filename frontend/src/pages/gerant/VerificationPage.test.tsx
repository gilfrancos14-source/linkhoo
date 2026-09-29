import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import VerificationPage from './VerificationPage';
import type { GerantData, VerificationDocument, VerificationStatusResponse } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  userId: 'user_clerk_1' as string | null,
  getMe: vi.fn<() => Promise<GerantData>>(),
  getStatus: vi.fn<(id: string) => Promise<VerificationStatusResponse>>(),
  deleteDocument: vi.fn<(id: string, docId: string) => Promise<void>>(),
  submitVerification: vi.fn<
    (id: string) => Promise<{ transaction_id: number; payment_url: string }>
  >(),
  setPropertyAddress: vi.fn<
    (id: string, url: string, lat?: number, lng?: number) => Promise<unknown>
  >(),
  confirmVerification: vi.fn<(id: string, transactionId: number) => Promise<unknown>>(),
  upload: vi.fn<(file: File, bucket?: string) => Promise<{ url: string; path: string }>>(),
  request: vi.fn<(path: string, options?: { method?: string; body?: string }) => Promise<VerificationDocument>>(),
}));

// jsdom n'implémente ni createObjectURL ni revokeObjectURL.
const urlStubs = vi.hoisted(() => {
  let seq = 0;
  const created: string[] = [];
  const createObjectURL = vi.fn(() => {
    seq += 1;
    const value = `blob:verif-${seq}`;
    created.push(value);
    return value;
  });
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectURL });
  return {
    createObjectURL,
    revokeObjectURL,
    created,
    reset: () => {
      seq = 0;
      created.length = 0;
      createObjectURL.mockClear();
      revokeObjectURL.mockClear();
    },
  };
});

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: mocks.userId }),
}));

vi.mock('../../lib/api', () => ({
  apiGerants: {
    getMe: mocks.getMe,
    getVerificationStatus: mocks.getStatus,
    deleteDocument: mocks.deleteDocument,
    submitVerification: mocks.submitVerification,
    setPropertyAddress: mocks.setPropertyAddress,
    confirmVerification: mocks.confirmVerification,
  },
  apiUpload: { upload: mocks.upload },
  request: mocks.request,
}));

// La carte réelle charge l'API Google Maps : on la remplace par un double
// qui expose le centre reçu et un bouton déclenchant onMapClick.
vi.mock('../../components/PropertyMap', () => ({
  default: ({
    lat,
    lng,
    interactive,
    onMapClick,
  }: {
    lat: number;
    lng: number;
    interactive?: boolean;
    onMapClick?: (lat: number, lng: number) => void;
  }) => (
    <div data-testid="property-map" data-interactive={interactive ? 'true' : 'false'}>
      <span data-testid="property-map-center">
        {lat}, {lng}
      </span>
      {onMapClick && (
        <button type="button" data-testid="property-map-click" onClick={() => onMapClick(lat + 0.5, lng + 0.5)}>
          Placer le marqueur
        </button>
      )}
    </div>
  ),
}));

function makeGerant(overrides: Partial<GerantData> = {}): GerantData {
  return {
    id: 'gerant-1',
    clerk_user_id: 'clerk_1',
    email: 'awa@ilehya.ci',
    nom: 'Kouassi',
    prenom: 'Awa',
    phone: '+225 07 00 00 00',
    market: 'CI',
    is_verified: false,
    verified_at: null,
    verification_requested_at: null,
    verification_status: 'none',
    verification_rejection_reason: null,
    verification_submitted_at: null,
    verification_reviewed_at: null,
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    is_premium: false,
    premium_expires_at: null,
    created_at: '2025-11-01T09:00:00.000Z',
    ...overrides,
  };
}

function makeDoc(overrides: Partial<VerificationDocument> = {}): VerificationDocument {
  return {
    id: 'doc-1',
    gerant_id: 'gerant-1',
    document_type: 'id_card_front',
    file_url: 'https://cdn.test/recto.jpg',
    file_path: 'verification-docs/recto.jpg',
    original_filename: 'recto.jpg',
    mime_type: 'image/jpeg',
    file_size: 204800,
    status: 'pending',
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-01-10T08:00:00.000Z',
    ...overrides,
  };
}

function makeStatus(overrides: Partial<VerificationStatusResponse> = {}): VerificationStatusResponse {
  return {
    verification_status: 'none',
    verification_rejection_reason: null,
    verification_submitted_at: null,
    verification_reviewed_at: null,
    documents: [],
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    ...overrides,
  };
}

const addressStatus = makeStatus({
  property_maps_url: 'https://www.google.com/maps/place/Ilehya',
  property_lat: 5.36,
  property_lng: -4.008,
});

const readyStatus = makeStatus({
  documents: [makeDoc(), makeDoc({ id: 'doc-2', document_type: 'id_card_back', file_url: 'https://cdn.test/verso.jpg' })],
  property_maps_url: 'https://www.google.com/maps/place/Ilehya',
  property_lat: 5.36,
  property_lng: -4.008,
});

function renderPage(entry = '/ci/gerant/verification') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <VerificationPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

async function renderLoaded(entry = '/ci/gerant/verification') {
  const view = renderPage(entry);
  await screen.findByText(/Confirmez votre identité/);
  return view;
}

function fileInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
}

function dropZones(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('label.verif-drop'));
}

function steps(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.verif-steps .step')) as HTMLElement[];
}

function setText(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

function chooseFile(input: HTMLInputElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

function makeFile(name = 'recto.jpg', type = 'image/jpeg'): File {
  return new File(['x'], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
  urlStubs.reset();
  mocks.userId = 'user_clerk_1';
  mocks.getMe.mockResolvedValue(makeGerant());
  mocks.getStatus.mockResolvedValue(makeStatus());
  mocks.deleteDocument.mockResolvedValue(undefined);
  mocks.submitVerification.mockResolvedValue({
    transaction_id: 42,
    payment_url: 'https://pay.test/checkout/42',
  });
  mocks.setPropertyAddress.mockResolvedValue({
    property_maps_url: 'https://www.google.com/maps/place/Ilehya',
    property_lat: 5.36,
    property_lng: -4.008,
    verification_status: 'none',
  });
  mocks.confirmVerification.mockResolvedValue({ success: true });
  mocks.upload.mockResolvedValue({ url: 'https://cdn.test/uploaded.jpg', path: 'verification-docs/uploaded.jpg' });
  mocks.request.mockResolvedValue(makeDoc({ id: 'doc-new', document_type: 'id_card_front' }));
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('VerificationPage — chargement', () => {
  it('affiche l’état de chargement tant que le profil n’est pas résolu', async () => {
    mocks.getMe.mockImplementation(() => new Promise<GerantData>(() => {}));

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Vérification' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText(/Confirmez votre identité/)).not.toBeInTheDocument();
    expect(screen.queryByText('Documents requis')).not.toBeInTheDocument();
  });

  it('n’interroge pas le profil sans userId Clerk', async () => {
    mocks.userId = null;

    renderPage();

    expect(mocks.getMe).not.toHaveBeenCalled();
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('rend le formulaire même si le chargement du profil échoue', async () => {
    mocks.getMe.mockRejectedValue(new Error('réseau indisponible'));

    renderPage();

    expect(await screen.findByText(/Confirmez votre identité/)).toBeInTheDocument();
    expect(screen.getByText('Documents requis')).toBeInTheDocument();
    expect(mocks.getStatus).not.toHaveBeenCalled();
  });

  it('affiche le libellé du marché CI déduit de l’URL', async () => {
    await renderLoaded('/ci/gerant/verification');

    expect(screen.getByText(/sur le marché CI/)).toBeInTheDocument();
  });

  it('affiche le libellé du marché BJ déduit de l’URL', async () => {
    await renderLoaded('/bj/gerant/verification');

    expect(screen.getByText(/sur le marché BJ/)).toBeInTheDocument();
  });

  it('présente le panneau Documents requis avec ses frais', async () => {
    const { container } = await renderLoaded();

    expect(screen.getByRole('heading', { level: 2, name: 'Documents requis' })).toBeInTheDocument();
    expect(container.querySelector('.verif-fee')).toHaveTextContent('2 000 XOF');
    expect(screen.getByText(/Frais de vérification/)).toBeInTheDocument();
    expect(container.querySelector('.verif-intro')).toHaveTextContent('recto');
  });
});

describe('VerificationPage — états de vérification', () => {
  it('affiche le compte vérifié sans proposer le formulaire', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ verification_status: 'approved' }));

    await renderLoaded();

    expect(screen.getByRole('heading', { level: 3, name: 'Compte vérifié' })).toBeInTheDocument();
    expect(screen.getByText('Vous pouvez désormais créer et gérer vos annonces.')).toBeInTheDocument();
    expect(screen.queryByText('Documents requis')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Soumettre et payer/ })).not.toBeInTheDocument();
  });

  it('affiche l’état « Demande en cours » pour un dossier pending', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ verification_status: 'pending' }));

    await renderLoaded();

    expect(screen.getByRole('heading', { level: 3, name: 'Demande en cours' })).toBeInTheDocument();
    expect(
      screen.getByText('Votre dossier a bien été reçu. Le traitement suit son cours.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Documents requis')).not.toBeInTheDocument();
  });

  it('précise qu’un administrateur examine le dossier en under_review', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ verification_status: 'under_review' }));

    await renderLoaded();

    expect(screen.getByRole('heading', { level: 3, name: 'Demande en cours' })).toBeInTheDocument();
    expect(screen.getByText('Un administrateur examine vos documents.')).toBeInTheDocument();
  });

  it('affiche la date de soumission du dossier', async () => {
    mocks.getStatus.mockResolvedValue(
      makeStatus({
        verification_status: 'under_review',
        verification_submitted_at: '2026-02-15T10:30:00.000Z',
      }),
    );

    await renderLoaded();

    expect(screen.getByText(/Soumise le/)).toHaveTextContent('Soumise le 15/02/2026');
  });

  it('masque la date de soumission quand elle est absente', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ verification_status: 'pending' }));

    await renderLoaded();

    expect(screen.queryByText(/Soumise le/)).not.toBeInTheDocument();
  });

  it('affiche la raison de rejet du dossier', async () => {
    mocks.getStatus.mockResolvedValue(
      makeStatus({
        verification_status: 'rejected',
        verification_rejection_reason: 'Photo illisible',
      }),
    );

    await renderLoaded();

    expect(screen.getByRole('heading', { level: 3, name: 'Demande rejetée' })).toBeInTheDocument();
    expect(screen.getByText('Photo illisible')).toBeInTheDocument();
    expect(screen.getByText(/téléverser de nouveaux documents/)).toBeInTheDocument();
    // Un dossier rejeté retombe sur le formulaire.
    expect(screen.getByText('Documents requis')).toBeInTheDocument();
  });

  it('affiche une raison de rejet par défaut quand aucune raison n’est fournie', async () => {
    mocks.getStatus.mockResolvedValue(
      makeStatus({ verification_status: 'rejected', verification_rejection_reason: null }),
    );

    await renderLoaded();

    expect(
      screen.getByText("Les documents soumis n'ont pas été acceptés."),
    ).toBeInTheDocument();
  });
});

describe('VerificationPage — documents et étapes', () => {
  it('présente les deux faces de la carte avec leurs consignes', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { level: 3, name: /Recto/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Verso/ })).toBeInTheDocument();
    expect(screen.getByText(/Photo du recto de votre carte nationale/)).toBeInTheDocument();
    expect(screen.getAllByText(/4 coins visibles/)).toHaveLength(2);
    expect(screen.getByText(/Adresse Google Maps/)).toBeInTheDocument();
  });

  it('numérote les trois éléments du dossier', async () => {
    const { container } = await renderLoaded();

    const nums = Array.from(container.querySelectorAll('.verif-doc__num')).map(
      (n) => n.textContent,
    );
    expect(nums).toEqual(['01', '02', '03']);
  });

  it('garde l’étape 1 active tant que le dossier n’est pas complet', async () => {
    const { container } = await renderLoaded();

    const [first, second] = steps(container);
    expect(first).toHaveClass('step--active');
    expect(second).not.toHaveClass('step--active');
    expect(second).toHaveTextContent('Paiement');
  });

  it('passe l’étape 1 pour terminée quand documents et adresse sont présents', async () => {
    mocks.getStatus.mockResolvedValue(readyStatus);

    const { container } = await renderLoaded();

    const [first, second] = steps(container);
    expect(first).toHaveClass('step--done');
    expect(second).toHaveClass('step--active');
  });

  it('affiche le document déjà déposé avec son statut', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ documents: [makeDoc()] }));

    await renderLoaded();

    expect(screen.getByAltText(/Recto/)).toHaveAttribute('src', 'https://cdn.test/recto.jpg');
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remplacer' })).toBeInTheDocument();
    expect(dropZones()).toHaveLength(1);
  });

  it('masque le bouton Remplacer pour un document approuvé', async () => {
    mocks.getStatus.mockResolvedValue(
      makeStatus({ documents: [makeDoc({ status: 'approved' })] }),
    );

    await renderLoaded();

    expect(screen.getByText('Approuvé')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remplacer' })).not.toBeInTheDocument();
  });

  it('affiche la raison de rejet d’un document', async () => {
    mocks.getStatus.mockResolvedValue(
      makeStatus({
        documents: [makeDoc({ status: 'rejected', rejection_reason: 'Corners cut off' })],
      }),
    );

    await renderLoaded();

    expect(screen.getByText('Rejeté')).toBeInTheDocument();
    expect(screen.getByText('Raison : Corners cut off')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remplacer' })).toBeInTheDocument();
  });

  it('affiche le nom de fichier pour un document non image', async () => {
    mocks.getStatus.mockResolvedValue(
      makeStatus({
        documents: [makeDoc({ mime_type: 'application/pdf', original_filename: 'carte.pdf' })],
      }),
    );

    await renderLoaded();

    expect(screen.getByText('carte.pdf')).toBeInTheDocument();
    expect(screen.queryByAltText(/Recto/)).not.toBeInTheDocument();
  });
});

describe('VerificationPage — sélection des fichiers', () => {
  it('affiche l’aperçu local et les actions d’envoi après sélection', async () => {
    await renderLoaded();

    chooseFile(fileInputs()[0], makeFile('recto-choisi.jpg'));

    expect(screen.getByAltText('Aperçu')).toBeInTheDocument();
    expect(urlStubs.createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    expect(dropZones()).toHaveLength(1);
  });

  it('retire le fichier sélectionné et révoque son aperçu', async () => {
    await renderLoaded();

    chooseFile(fileInputs()[0], makeFile());
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(urlStubs.revokeObjectURL).toHaveBeenCalledWith('blob:verif-1');
    expect(screen.queryByAltText('Aperçu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer' })).not.toBeInTheDocument();
    expect(dropZones()).toHaveLength(2);
  });

  it('accepte un fichier déposé par glisser-déposer', async () => {
    await renderLoaded();

    fireEvent.drop(dropZones()[0], { dataTransfer: { files: [makeFile('drop.png', 'image/png')] } });

    expect(screen.getByAltText('Aperçu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
  });

  it('refuse un fichier déposé qui n’est pas une image', async () => {
    await renderLoaded();

    fireEvent.drop(dropZones()[0], { dataTransfer: { files: [makeFile('notes.txt', 'text/plain')] } });

    expect(screen.queryByAltText('Aperçu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer' })).not.toBeInTheDocument();
    expect(dropZones()).toHaveLength(2);
  });

  it('surligne la zone de dépôt au survol', async () => {
    await renderLoaded();

    fireEvent.dragOver(dropZones()[0]);
    expect(dropZones()[0]).toHaveClass('verif-drop--dragover');

    fireEvent.dragLeave(dropZones()[0]);
    expect(dropZones()[0]).not.toHaveClass('verif-drop--dragover');
  });
});

describe('VerificationPage — envoi et suppression', () => {
  it('enregistre le document auprès du service puis le persiste', async () => {
    await renderLoaded();

    chooseFile(fileInputs()[0], makeFile('mon-recto.jpg'));
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(File), 'verification-docs');
    expect(mocks.request).toHaveBeenCalledWith(
      '/gerants/gerant-1/documents',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(mocks.request.mock.calls[0][1]?.body ?? '{}');
    expect(body).toEqual(
      expect.objectContaining({
        document_type: 'id_card_front',
        file_url: 'https://cdn.test/uploaded.jpg',
        file_path: 'verification-docs/uploaded.jpg',
        original_filename: 'mon-recto.jpg',
        mime_type: 'image/jpeg',
      }),
    );
    expect(await screen.findByText('En attente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer' })).not.toBeInTheDocument();
  });

  it('verrouille le bouton pendant l’envoi', async () => {
    mocks.upload.mockImplementation(() => new Promise(() => {}));
    await renderLoaded();

    chooseFile(fileInputs()[0], makeFile());
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByRole('button', { name: /Envoi/ })).toBeDisabled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it('affiche l’erreur remontée par le service d’upload', async () => {
    mocks.upload.mockRejectedValue(new Error('Quota dépassé'));
    await renderLoaded();

    chooseFile(fileInputs()[0], makeFile());
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('Quota dépassé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeEnabled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it('affiche l’erreur remontée à la persistance du document', async () => {
    mocks.request.mockRejectedValue(new Error('Type de document inconnu'));
    await renderLoaded();

    chooseFile(fileInputs()[0], makeFile());
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('Type de document inconnu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeEnabled();
  });

  it('remplace le document déjà déposé', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ documents: [makeDoc()] }));
    await renderLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'Remplacer' }));

    await waitFor(() => expect(mocks.deleteDocument).toHaveBeenCalledWith('gerant-1', 'doc-1'));
    expect(await screen.findAllByText(/Déposez l/)).toHaveLength(2);
    expect(screen.queryByText('En attente')).not.toBeInTheDocument();
  });

  it('affiche l’erreur si la suppression du document échoue', async () => {
    mocks.getStatus.mockResolvedValue(makeStatus({ documents: [makeDoc()] }));
    mocks.deleteDocument.mockRejectedValue(new Error('Suppression impossible'));
    await renderLoaded();

    await userEvent.click(screen.getByRole('button', { name: 'Remplacer' }));

    expect(await screen.findByText('Suppression impossible')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });
});

describe('VerificationPage — adresse Google Maps', () => {
  it('désactive l’enregistrement tant que l’adresse est vide', async () => {
    await renderLoaded();

    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('enregistre l’adresse saisie et met à jour la position affichée', async () => {
    await renderLoaded();
    mocks.getStatus.mockResolvedValueOnce(addressStatus);
    const input = screen.getByPlaceholderText(/google\.com\/maps/);
    setText(input, '  https://www.google.com/maps/place/Ilehya  ');

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(mocks.setPropertyAddress).toHaveBeenCalledWith(
        'gerant-1',
        'https://www.google.com/maps/place/Ilehya',
      ),
    );
    expect(await screen.findByText('Position enregistrée')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ouvrir dans Google Maps/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/place/Ilehya',
    );
    expect(screen.getByText('5.36000, -4.00800')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mettre à jour' })).toBeInTheDocument();
  });

  it('déclenche l’enregistrement avec la touche Entrée', async () => {
    await renderLoaded();
    const input = screen.getByPlaceholderText(/google\.com\/maps/);
    setText(input, 'https://www.google.com/maps/place/Entrer');

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(mocks.setPropertyAddress).toHaveBeenCalledWith(
        'gerant-1',
        'https://www.google.com/maps/place/Entrer',
      ),
    );
  });

  it('affiche l’erreur quand le lien est refusé', async () => {
    mocks.setPropertyAddress.mockRejectedValue(new Error('Lien expiré'));
    await renderLoaded();
    setText(screen.getByPlaceholderText(/google\.com\/maps/), 'https://maps/place/x');

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Lien expiré')).toBeInTheDocument();
    expect(screen.queryByText(/Cliquez sur la carte/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  it('propose de placer le marqueur quand le lien n’est pas reconnu', async () => {
    mocks.setPropertyAddress.mockRejectedValue(new Error('Lien Google Maps non reconnu'));
    await renderLoaded();
    setText(screen.getByPlaceholderText(/google\.com\/maps/), 'https://maps/mauvais-lien');

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText(/Lien non reconnu\. Cliquez sur la carte/)).toBeInTheDocument();
    expect(screen.getByTestId('property-map-center')).toHaveTextContent('5.36, -4.008');
    expect(screen.getByText('Aucun marqueur placé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer cette position' })).toBeDisabled();
  });

  it('centre la carte manuelle sur le marché BJ', async () => {
    mocks.setPropertyAddress.mockRejectedValue(new Error('Lien non reconnu'));
    await renderLoaded('/bj/gerant/verification');
    setText(screen.getByPlaceholderText(/google\.com\/maps/), 'https://maps/mauvais-lien');

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByTestId('property-map-center')).toHaveTextContent('6.3703, 2.3912');
  });

  it('enregistre la position placée manuellement', async () => {
    mocks.setPropertyAddress.mockRejectedValueOnce(new Error('Lien non reconnu'));
    mocks.setPropertyAddress.mockResolvedValueOnce({
      property_maps_url: 'https://www.google.com/maps/place/Ilehya',
      property_lat: 5.86,
      property_lng: -3.508,
      verification_status: 'none',
    });
    await renderLoaded();
    // La prochaine recharge de statut renvoie l'adresse déjà enregistrée.
    mocks.getStatus.mockResolvedValueOnce(addressStatus);
    setText(screen.getByPlaceholderText(/google\.com\/maps/), 'https://www.google.com/maps/place/Ilehya');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByText('Lien non reconnu');

    await userEvent.click(screen.getByTestId('property-map-click'));

    expect(screen.getByText('Marqueur : 5.86000, -3.50800')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer cette position' }));

    await waitFor(() =>
      expect(mocks.setPropertyAddress).toHaveBeenLastCalledWith(
        'gerant-1',
        'https://www.google.com/maps/place/Ilehya',
        5.86,
        -3.508,
      ),
    );
    expect(await screen.findByText('Position enregistrée')).toBeInTheDocument();
    expect(screen.queryByText(/Cliquez sur la carte/)).not.toBeInTheDocument();
  });

  it('affiche l’erreur quand la position manuelle est refusée', async () => {
    mocks.setPropertyAddress.mockRejectedValueOnce(new Error('Lien non reconnu'));
    mocks.setPropertyAddress.mockRejectedValueOnce(new Error('Sauvegarde impossible'));
    await renderLoaded();
    setText(screen.getByPlaceholderText(/google\.com\/maps/), 'https://maps/mauvais-lien');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByText('Lien non reconnu');

    await userEvent.click(screen.getByTestId('property-map-click'));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer cette position' }));

    expect(await screen.findByText('Sauvegarde impossible')).toBeInTheDocument();
    expect(screen.getByText(/Marqueur :/)).toBeInTheDocument();
  });

  it('affiche la carte en lecture seule quand l’adresse est déjà enregistrée', async () => {
    mocks.getStatus.mockResolvedValue(addressStatus);

    await renderLoaded();

    expect(screen.getByTestId('property-map')).toBeInTheDocument();
    expect(screen.getByTestId('property-map')).toHaveAttribute('data-interactive', 'false');
    expect(screen.getByText('5.36000, -4.00800')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mettre à jour' })).toBeInTheDocument();
  });
});

describe('VerificationPage — soumission et paiement', () => {
  it('indique que les deux faces de la carte manquent', async () => {
    await renderLoaded();

    expect(screen.getByText('Les 2 faces de la carte sont requises.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Soumettre et payer/ })).toBeDisabled();
  });

  it('indique que l’adresse manque quand les documents sont présents', async () => {
    mocks.getStatus.mockResolvedValue(
      makeStatus({
        documents: [makeDoc(), makeDoc({ id: 'doc-2', document_type: 'id_card_back' })],
      }),
    );

    await renderLoaded();

    expect(screen.getByText("L'adresse Google Maps est requise.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Soumettre et payer/ })).toBeDisabled();
  });

  it('autorise la soumission quand le dossier est complet', async () => {
    mocks.getStatus.mockResolvedValue(readyStatus);

    await renderLoaded();

    expect(screen.getByText('Documents et adresse prêts. Passons au paiement.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Soumettre et payer/ })).toBeEnabled();
  });

  it('soumet le dossier et verrouille le bouton sur la redirection', async () => {
    mocks.getStatus.mockResolvedValue(readyStatus);
    await renderLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Soumettre et payer/ }));

    await waitFor(() => expect(mocks.submitVerification).toHaveBeenCalledWith('gerant-1'));
    expect(await screen.findByRole('button', { name: 'Redirection...' })).toBeDisabled();
    expect(screen.queryByText(/Erreur/)).not.toBeInTheDocument();
  });

  it('affiche l’erreur de soumission et réactive le bouton', async () => {
    mocks.getStatus.mockResolvedValue(readyStatus);
    mocks.submitVerification.mockRejectedValue(new Error('Paiement indisponible'));
    await renderLoaded();

    await userEvent.click(screen.getByRole('button', { name: /Soumettre et payer/ }));

    expect(await screen.findByText('Paiement indisponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Soumettre et payer/ })).toBeEnabled();
  });

  it('ne confirme aucun paiement sans identifiant dans l’URL', async () => {
    await renderLoaded();

    expect(mocks.confirmVerification).not.toHaveBeenCalled();
    expect(screen.queryByText(/Paiement confirmé/)).not.toBeInTheDocument();
  });

  it('confirme automatiquement le paiement quand ?id= est présent', async () => {
    window.history.replaceState({}, '', '?id=42');

    await renderLoaded();

    await waitFor(() => expect(mocks.confirmVerification).toHaveBeenCalledWith('gerant-1', 42));
    expect(
      await screen.findByText('Paiement confirmé. Votre dossier passe en examen.'),
    ).toBeInTheDocument();
    expect(mocks.getMe).toHaveBeenCalledTimes(2);
  });

  it('ne confirme qu’une seule fois quand getMe renvoie un objet neuf à chaque appel', async () => {
    // En production getMe crée un nouvel objet : l’effet [gerant] se relance
    // à chaque rechargement et reconfirme indéfiniment tant que ?id= reste.
    window.history.replaceState({}, '', '?id=42');
    mocks.getMe.mockImplementation(async () => ({ ...makeGerant() }));

    await renderLoaded();

    await waitFor(() => expect(mocks.getMe).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mocks.confirmVerification).toHaveBeenCalledTimes(1);
    expect(mocks.getMe).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText('Paiement confirmé. Votre dossier passe en examen.'),
    ).toBeInTheDocument();
  });

  it('affiche l’état de confirmation pendant l’appel', async () => {
    mocks.confirmVerification.mockImplementation(() => new Promise(() => {}));
    window.history.replaceState({}, '', '?id=7');

    await renderLoaded();

    expect(await screen.findByText('Confirmation du paiement...')).toBeInTheDocument();
    expect(mocks.confirmVerification).toHaveBeenCalledWith('gerant-1', 7);
  });

  it('affiche l’erreur quand la confirmation du paiement échoue', async () => {
    mocks.confirmVerification.mockRejectedValue(new Error('Transaction introuvable'));
    window.history.replaceState({}, '', '?id=99');

    await renderLoaded();

    expect(await screen.findByText('Transaction introuvable')).toBeInTheDocument();
    expect(screen.queryByText(/Paiement confirmé/)).not.toBeInTheDocument();
  });
});
