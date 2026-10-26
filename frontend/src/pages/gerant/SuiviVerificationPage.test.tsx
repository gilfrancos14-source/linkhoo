import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import { formatDateTimeShort } from '../../lib/formatDate';
import type {
  GerantData,
  VerificationDocument,
  VerificationStatusResponse,
} from '../../lib/api';
import SuiviVerificationPage from './SuiviVerificationPage';

const mocks = vi.hoisted(() => ({
  getMe: vi.fn<() => Promise<GerantData>>(),
  getVerificationStatus: vi.fn<(id: string) => Promise<VerificationStatusResponse>>(),
}));

vi.mock('../../lib/api', () => ({
  apiGerants: {
    getMe: mocks.getMe,
    getVerificationStatus: mocks.getVerificationStatus,
  },
}));

vi.mock('../../hooks/useGerantChrome', () => ({
  useGerantChrome: () => ({
    gerant: null,
    displayName: 'Awa Kouassi',
    initials: 'AK',
    reservationsCount: 0,
    messagesUnread: 0,
  }),
}));

const SUBMITTED_AT = '2026-10-20T10:24:00.000Z';
const REVIEWED_AT = '2026-10-21T09:05:00.000Z';

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
    verification_status: 'under_review',
    verification_rejection_reason: null,
    verification_submitted_at: SUBMITTED_AT,
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

function makeDoc(
  document_type: VerificationDocument['document_type'],
  status: VerificationDocument['status'],
): VerificationDocument {
  return {
    id: `doc-${document_type}`,
    gerant_id: 'gerant-1',
    document_type,
    file_url: null,
    file_path: `verification/${document_type}.jpg`,
    original_filename: `${document_type}.jpg`,
    mime_type: 'image/jpeg',
    file_size: 1024,
    status,
    rejection_reason: status === 'rejected' ? 'Document illisible.' : null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: SUBMITTED_AT,
  };
}

function makeStatus(
  overrides: Partial<VerificationStatusResponse> = {},
): VerificationStatusResponse {
  return {
    verification_status: 'under_review',
    verification_rejection_reason: null,
    verification_submitted_at: SUBMITTED_AT,
    verification_reviewed_at: null,
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    documents: [
      makeDoc('national_id', 'pending'),
      makeDoc('proof_of_address', 'pending'),
      makeDoc('selfie', 'pending'),
    ],
    ...overrides,
  };
}

function renderPage(path = '/ci/gerant/verification/suivi') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MarketProvider>
        <SuiviVerificationPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

/** Monte la page avec un dossier donné et attend la fin du chargement. */
async function renderWith(status: VerificationStatusResponse, gerant = makeGerant()) {
  mocks.getMe.mockResolvedValue(gerant);
  mocks.getVerificationStatus.mockResolvedValue(status);
  const view = renderPage();
  await waitFor(() =>
    expect(screen.queryByText('Chargement de votre dossier…')).not.toBeInTheDocument(),
  );
  return view;
}

beforeEach(() => {
  mocks.getMe.mockReset();
  mocks.getVerificationStatus.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('SuiviVerificationPage', () => {
  it('affiche un état de chargement pendant la récupération du dossier', () => {
    mocks.getMe.mockReturnValue(new Promise<GerantData>(() => {}));

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de votre dossier…');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Suivi de votre vérification' }),
    ).toBeInTheDocument();
  });

  it('affiche le dossier en cours d’examen avec les données de l’API', async () => {
    await renderWith(makeStatus());

    expect(
      screen.getByRole('heading', { name: "Votre dossier est en cours d'examen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Détails de votre vérification' })).toBeInTheDocument();

    // Les dates viennent du dossier, plus de « 20 oct. 2026 » codé en dur.
    expect(screen.getAllByText(formatDateTimeShort(SUBMITTED_AT)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('À venir').length).toBeGreaterThan(0);

    // Identité et complétude réelles.
    expect(screen.getAllByText('Awa Kouassi').length).toBeGreaterThan(0);
    expect(screen.getByText('awa@ilehya.ci')).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    // L'étape « examen » est bien celle en cours.
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(screen.getByText("En cours d'examen", { selector: 'p' })).toBeInTheDocument();
  });

  it('affiche un dossier validé sans action corrective', async () => {
    await renderWith(
      makeStatus({
        verification_status: 'approved',
        verification_reviewed_at: REVIEWED_AT,
        documents: [
          makeDoc('national_id', 'approved'),
          makeDoc('proof_of_address', 'approved'),
          makeDoc('selfie', 'approved'),
        ],
      }),
      makeGerant({ is_verified: true, verified_at: REVIEWED_AT }),
    );

    expect(screen.getByRole('heading', { name: 'Votre compte est vérifié' })).toBeInTheDocument();
    expect(screen.getAllByText('Validé').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Corriger mon dossier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Compléter mon dossier' })).not.toBeInTheDocument();

    // Plus aucune étape « en cours » quand tout est terminé.
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
    expect(screen.getAllByText(formatDateTimeShort(REVIEWED_AT)).length).toBeGreaterThan(0);
  });

  it('affiche le motif de refus et le lien pour corriger le dossier', async () => {
    await renderWith(
      makeStatus({
        verification_status: 'rejected',
        verification_rejection_reason: 'La photo de vous est floue.',
        verification_reviewed_at: REVIEWED_AT,
        documents: [
          makeDoc('national_id', 'approved'),
          makeDoc('proof_of_address', 'approved'),
          makeDoc('selfie', 'rejected'),
        ],
      }),
    );

    expect(screen.getByRole('heading', { name: 'Votre dossier a été refusé' })).toBeInTheDocument();
    expect(screen.getByText('La photo de vous est floue.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Corriger mon dossier' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    expect(screen.getAllByText('Refusé').length).toBeGreaterThan(0);
  });

  it('invite à compléter le dossier quand rien n’a été soumis', async () => {
    await renderWith(
      makeStatus({
        verification_status: 'none',
        verification_submitted_at: null,
        documents: [],
      }),
      makeGerant({ verification_status: 'none', verification_submitted_at: null }),
    );

    expect(
      screen.getByRole('heading', { name: "Votre dossier n'est pas encore soumis" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compléter mon dossier' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    expect(screen.getByText('0 / 3')).toBeInTheDocument();
    expect(screen.getAllByText('À ajouter')).toHaveLength(3);
    expect(screen.queryByText('Koffi Mensah')).not.toBeInTheDocument();
  });

  it('signale une erreur de chargement et permet de réessayer', async () => {
    const user = userEvent.setup();
    mocks.getMe
      .mockRejectedValueOnce(new Error('Session expirée'))
      .mockResolvedValueOnce(makeGerant());
    mocks.getVerificationStatus.mockResolvedValue(makeStatus());

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Session expirée');

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByRole('heading', { name: "Votre dossier est en cours d'examen" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('conserve les liens de navigation et de la sidebar', async () => {
    await renderWith(makeStatus());

    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    expect(screen.getByRole('link', { name: 'Suivi de vérification' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification/suivi',
    );
    expect(screen.getByRole('link', { name: 'Mes documents' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    expect(screen.getByRole('link', { name: /Contacter le support/ })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('adapte les liens au marché de l’URL', async () => {
    mocks.getMe.mockResolvedValue(makeGerant());
    mocks.getVerificationStatus.mockResolvedValue(makeStatus());

    renderPage('/bj/gerant/verification/suivi');

    await waitFor(() =>
      expect(screen.queryByText('Chargement de votre dossier…')).not.toBeInTheDocument(),
    );

    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute(
      'href',
      '/bj/gerant/verification',
    );
    expect(screen.getByRole('link', { name: 'Toutes les chambres' })).toHaveAttribute(
      'href',
      '/bj/gerant/chambres',
    );
  });
});
