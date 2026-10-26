import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import VerificationPage from './VerificationPage';
import type {
  GerantData,
  VerificationDocument,
  VerificationStatusResponse,
} from '../../lib/api';

const mocks = vi.hoisted(() => ({
  getMe: vi.fn<() => Promise<GerantData>>(),
  updateMe: vi.fn<(data: Record<string, unknown>) => Promise<GerantData>>(),
  getVerificationStatus: vi.fn<(id: string) => Promise<VerificationStatusResponse>>(),
  getDocuments: vi.fn<(id: string) => Promise<VerificationDocument[]>>(),
  addDocument: vi.fn<(id: string, data: Record<string, unknown>) => Promise<VerificationDocument>>(),
  deleteDocument: vi.fn<(id: string, docId: string) => Promise<void>>(),
  submitVerification: vi.fn<(id: string) => Promise<{ success: boolean; gerant: GerantData }>>(),
  upload: vi.fn<(file: File, bucket?: string) => Promise<{ url: string; path: string }>>(),
}));

vi.mock('../../lib/api', () => ({
  apiGerants: {
    getMe: mocks.getMe,
    updateMe: mocks.updateMe,
    getVerificationStatus: mocks.getVerificationStatus,
    getDocuments: mocks.getDocuments,
    addDocument: mocks.addDocument,
    deleteDocument: mocks.deleteDocument,
    submitVerification: mocks.submitVerification,
  },
  apiUpload: { upload: mocks.upload },
}));

function makeGerant(overrides: Partial<GerantData> = {}): GerantData {
  return {
    id: 'gerant-1',
    clerk_user_id: 'clerk_1',
    email: 'awa@ilehya.ci',
    nom: 'Kouassi',
    prenom: 'Awa',
    phone: '+225 07 00 00 00',
    address: 'Cocody, Abidjan',
    date_of_birth: '1995-03-12',
    nationality: 'Ivoirienne',
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

function makeStatus(
  overrides: Partial<VerificationStatusResponse> = {},
): VerificationStatusResponse {
  return {
    verification_status: 'none',
    verification_rejection_reason: null,
    verification_submitted_at: null,
    verification_reviewed_at: null,
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    documents: [],
    ...overrides,
  };
}

function makeDoc(overrides: Partial<VerificationDocument>): VerificationDocument {
  return {
    id: 'doc-1',
    gerant_id: 'gerant-1',
    document_type: 'national_id',
    file_url: 'https://storage.test/signed/id.webp',
    file_path: 'clerk_1/id.webp',
    original_filename: 'identite.jpg',
    mime_type: 'image/jpeg',
    file_size: 2048,
    status: 'pending',
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-01-10T09:05:00.000Z',
    ...overrides,
  };
}

const allDocs = [
  makeDoc({ id: 'doc-id', document_type: 'national_id', original_filename: 'identite.jpg' }),
  makeDoc({
    id: 'doc-address',
    document_type: 'proof_of_address',
    file_url: 'https://storage.test/signed/address.webp',
    file_path: 'clerk_1/address.webp',
    original_filename: 'facture.pdf',
    mime_type: 'application/pdf',
  }),
  makeDoc({
    id: 'doc-selfie',
    document_type: 'selfie',
    file_url: 'https://storage.test/signed/selfie.webp',
    file_path: 'clerk_1/selfie.webp',
    original_filename: 'selfie.jpg',
  }),
];

function renderPage(path = '/ci/gerant/verification') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MarketProvider>
        <VerificationPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMe.mockResolvedValue(makeGerant());
  mocks.updateMe.mockImplementation(async (data) => makeGerant(data as Partial<GerantData>));
  mocks.getVerificationStatus.mockResolvedValue(makeStatus());
  mocks.getDocuments.mockResolvedValue([]);
  mocks.upload.mockResolvedValue({ url: 'https://storage.test/signed/new.webp', path: 'clerk_1/new.webp' });
  mocks.addDocument.mockResolvedValue(makeDoc({}));
  mocks.deleteDocument.mockResolvedValue(undefined);
  mocks.submitVerification.mockResolvedValue({
    success: true,
    gerant: makeGerant({
      verification_status: 'pending',
      verification_submitted_at: '2026-01-10T10:00:00.000Z',
    }),
  });
});

afterEach(() => {
  cleanup();
});

describe('VerificationPage', () => {
  it('reproduit le cadre de la maquette (sidebar, topbar, titre)', async () => {
    const { container } = renderPage();

    expect(container.querySelector('.verif-maq')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Vérification' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Vérifiez votre identité pour publier vos annonces et gagner la confiance des voyageurs.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rechercher une chambre, une catégorie...')).toBeInTheDocument();
    expect(await screen.findByText('Awa Kouassi')).toBeInTheDocument();
    expect(screen.getByText('Gérant')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute('href', '/ci/gerant');
  });

  it('affiche deux étapes et marque Documents comme étape courante', async () => {
    const { container } = renderPage();
    await screen.findByText('Awa Kouassi');
    const stepper = container.querySelector('ol');
    expect(stepper).not.toBeNull();

    const items = within(stepper as HTMLElement).getAllByRole('listitem');
    const labels = items.map((item) => item.textContent ?? '');
    expect(labels.some((label) => label.includes('Informations personnelles'))).toBe(true);
    expect(labels.some((label) => label.includes('Documents'))).toBe(true);
    expect(stepper?.querySelector('[aria-current="step"]')).toHaveTextContent('Documents');
  });

  it('commence par les informations personnelles quand elles sont incomplètes', async () => {
    mocks.getMe.mockResolvedValue(makeGerant({ date_of_birth: null, nationality: null }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Awa Kouassi');

    expect(
      screen.getByRole('heading', { name: 'Informations personnelles' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Téléverser Pièce d'identité")).toBeNull();

    fireEvent.change(screen.getByLabelText('Date de naissance'), {
      target: { value: '1995-03-12' },
    });
    await user.type(screen.getByLabelText('Nationalité'), 'Ivoirienne');
    await user.click(screen.getByRole('button', { name: /Continuer vers les documents/ }));

    await waitFor(() =>
      expect(mocks.updateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          date_of_birth: '1995-03-12',
          nationality: 'Ivoirienne',
        }),
      ),
    );
    expect(
      await screen.findByLabelText("Téléverser Pièce d'identité"),
    ).toBeInTheDocument();
  });

  it('présente les trois documents requis et leurs consignes', async () => {
    const { container } = renderPage();
    await screen.findByText('Awa Kouassi');

    expect(screen.getByRole('heading', { name: "Pièce d'identité" })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Justificatif de domicile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Photo de vous' })).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(3);
    const cards = container.querySelectorAll('article');
    expect(cards).toHaveLength(3);
    cards.forEach((card) => expect(within(card).getByText('À ajouter')).toBeInTheDocument());
    expect(screen.getAllByText(/Formats acceptés : JPG, PNG, PDF/)).toHaveLength(2);
    expect(container.querySelectorAll('input[type="file"]')[2]).toHaveAttribute(
      'accept',
      '.jpg,.jpeg,.png',
    );
  });

  it('téléverse un document et l’enregistre côté API', async () => {
    renderPage();
    await screen.findByText('Awa Kouassi');

    const file = new File(['contenu'], 'identite.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText("Téléverser Pièce d'identité"), {
      target: { files: [file] },
    });

    await waitFor(() => expect(mocks.addDocument).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledWith(file, 'verification-docs');
    expect(mocks.addDocument).toHaveBeenCalledWith(
      'gerant-1',
      expect.objectContaining({
        document_type: 'national_id',
        file_path: 'clerk_1/new.webp',
        original_filename: 'identite.jpg',
        replace: false,
      }),
    );
    expect(
      await screen.findByText('« Pièce d\'identité » a bien été ajouté.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Ajouté').length).toBeGreaterThanOrEqual(1);
  });

  it('précharge les documents existants et permet la soumission', async () => {
    mocks.getDocuments.mockResolvedValue(allDocs);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Awa Kouassi');

    const submit = screen.getByRole('button', { name: /Soumettez pour vérification/ });
    expect(submit).toBeEnabled();

    await user.click(submit);

    expect(mocks.submitVerification).toHaveBeenCalledWith('gerant-1');
    expect(
      await screen.findByText(
        'Votre demande a été soumise. Un administrateur va examiner vos documents.',
      ),
    ).toBeInTheDocument();
  });

  it('bloque la soumission tant que les trois documents ne sont pas fournis', async () => {
    mocks.getDocuments.mockResolvedValue([allDocs[0]]);
    renderPage();
    await screen.findByText('Awa Kouassi');

    expect(screen.getByRole('button', { name: /Ajoutez les 3 documents/ })).toBeDisabled();
    expect(mocks.submitVerification).not.toHaveBeenCalled();
  });

  it('affiche une erreur si le téléversement échoue', async () => {
    mocks.addDocument.mockRejectedValue(new Error('Envoi impossible'));
    renderPage();
    await screen.findByText('Awa Kouassi');

    const file = new File(['contenu'], 'identite.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText("Téléverser Pièce d'identité"), {
      target: { files: [file] },
    });

    expect(await screen.findByText('Envoi impossible')).toBeInTheDocument();
    expect(screen.getByLabelText("Téléverser Pièce d'identité")).not.toBeDisabled();
  });

  it('désactive le formulaire pendant une demande en cours', async () => {
    mocks.getMe.mockResolvedValue(makeGerant({ verification_status: 'pending' }));
    mocks.getVerificationStatus.mockResolvedValue(makeStatus({ verification_status: 'pending' }));
    mocks.getDocuments.mockResolvedValue(allDocs);
    renderPage();
    await screen.findByText('Awa Kouassi');

    expect(screen.getByLabelText("Téléverser Pièce d'identité")).toBeDisabled();
    expect(screen.getByRole('button', { name: /Demande en cours/ })).toBeDisabled();
  });

  it('affiche la colonne de suivi : avantages, statut et aide', async () => {
    renderPage();
    await screen.findByText('Awa Kouassi');

    expect(screen.getByRole('heading', { name: 'Pourquoi cette vérification ?' })).toBeInTheDocument();
    expect(screen.getByText('Confiance des voyageurs')).toBeInTheDocument();
    expect(screen.getByText('Moins de risques de fraude')).toBeInTheDocument();
    expect(screen.getByText('Accès aux fonctionnalités Premium')).toBeInTheDocument();
    expect(screen.getByText('Meilleure visibilité de vos annonces')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Statut de vérification' })).toBeInTheDocument();
    expect(screen.getByText('Validation finale')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: "Besoin d'aide ?" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Contacter le support/ })).toHaveAttribute('href', '/contact');
  });

  it('conserve les liens de la sidebar et de la carte Premium', async () => {
    renderPage();
    await screen.findByText('Awa Kouassi');

    expect(screen.getByRole('link', { name: 'Toutes les chambres' })).toHaveAttribute(
      'href',
      '/ci/gerant/chambres',
    );
    expect(screen.getByRole('link', { name: 'Mes documents' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    expect(screen.getByRole('link', { name: 'Boîte de réception' })).toHaveAttribute(
      'href',
      '/ci/gerant/messages/boite-reception',
    );
    expect(screen.getByRole('link', { name: 'Suivi de vérification' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification/suivi',
    );
    expect(screen.getByRole('link', { name: 'Voir les avantages' })).toHaveAttribute(
      'href',
      '/ci/gerant/premium',
    );
  });

  it('adapte les liens au marché de l’URL', async () => {
    renderPage('/bj/gerant/verification');
    await screen.findByText('Awa Kouassi');

    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute('href', '/bj/gerant');
    expect(screen.getByRole('link', { name: 'Toutes les chambres' })).toHaveAttribute(
      'href',
      '/bj/gerant/chambres',
    );
  });
});
