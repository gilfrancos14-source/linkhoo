import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import MesInformationsMaq from './MesInformationsMaq';
import type { GerantData, VerificationStatusResponse } from '../../lib/api';

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

function makeGerant(overrides: Partial<GerantData> = {}): GerantData {
  return {
    id: 'gerant-1',
    clerk_user_id: 'clerk_1',
    email: 'awa@ilehya.ci',
    nom: 'Kouassi',
    prenom: 'Awa',
    phone: '+225 07 00 00 00',
    address: '12 rue des Jardins, Abidjan',
    date_of_birth: '1995-03-12',
    nationality: 'Ivoirienne',
    market: 'CI',
    is_verified: true,
    verified_at: '2026-01-05T10:00:00.000Z',
    verification_requested_at: null,
    verification_status: 'approved',
    verification_rejection_reason: null,
    verification_submitted_at: null,
    verification_reviewed_at: null,
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    is_premium: true,
    premium_expires_at: '2027-01-01T00:00:00.000Z',
    created_at: '2025-11-01T09:00:00.000Z',
    ...overrides,
  };
}

function makeVerification(
  overrides: Partial<VerificationStatusResponse> = {},
): VerificationStatusResponse {
  return {
    verification_status: 'approved',
    verification_rejection_reason: null,
    verification_submitted_at: '2026-01-01T10:00:00.000Z',
    verification_reviewed_at: '2026-01-05T10:00:00.000Z',
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    documents: [
      {
        id: 'doc-1',
        gerant_id: 'gerant-1',
        document_type: 'national_id',
        file_url: null,
        file_path: 'verification/user/national_id.jpg',
        original_filename: 'identite.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        status: 'approved',
        rejection_reason: null,
        reviewed_by: 'admin-1',
        reviewed_at: '2026-01-05T10:00:00.000Z',
        created_at: '2026-01-01T10:00:00.000Z',
      },
      {
        id: 'doc-2',
        gerant_id: 'gerant-1',
        document_type: 'proof_of_address',
        file_url: null,
        file_path: 'verification/user/proof.jpg',
        original_filename: 'domicile.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        status: 'approved',
        rejection_reason: null,
        reviewed_by: 'admin-1',
        reviewed_at: '2026-01-05T10:00:00.000Z',
        created_at: '2026-01-01T10:00:00.000Z',
      },
      {
        id: 'doc-3',
        gerant_id: 'gerant-1',
        document_type: 'selfie',
        file_url: null,
        file_path: 'verification/user/selfie.jpg',
        original_filename: 'selfie.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        status: 'approved',
        rejection_reason: null,
        reviewed_by: 'admin-1',
        reviewed_at: '2026-01-05T10:00:00.000Z',
        created_at: '2026-01-01T10:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function renderPage(path = '/ci/gerant/profil') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MarketProvider>
        <MesInformationsMaq />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMe.mockResolvedValue(makeGerant());
  mocks.getVerificationStatus.mockResolvedValue(makeVerification());
});

afterEach(() => {
  cleanup();
});

describe('MesInformationsMaq', () => {
  it('affiche les informations du gérant', async () => {
    const { container } = renderPage();

    expect(container.querySelector('.verif-maq')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Mes informations' })).toBeInTheDocument();
    expect((await screen.findAllByText('Awa Kouassi')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('awa@ilehya.ci').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+225 07 00 00 00').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Informations personnelles' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Informations professionnelles' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Préférences & notifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'État de votre compte' })).toBeInTheDocument();
  });

  it('affiche les informations personnelles et de vérification issues de l’API', async () => {
    renderPage();

    expect(await screen.findByText('12 mars 1995')).toBeInTheDocument();
    expect(screen.getByText('Ivoirienne')).toBeInTheDocument();
    expect(screen.getByText('12 rue des Jardins, Abidjan')).toBeInTheDocument();
    expect(mocks.getVerificationStatus).toHaveBeenCalledWith('gerant-1');
    expect(screen.getAllByText('Validé')).toHaveLength(4);
  });

  it('reflète les documents manquants dans l’état du compte', async () => {
    const verification = makeVerification();
    mocks.getVerificationStatus.mockResolvedValue({
      ...verification,
      documents: verification.documents.filter((doc) => doc.document_type !== 'selfie'),
    });

    renderPage();

    expect(await screen.findByText('À fournir')).toBeInTheDocument();
    expect(screen.getByText('Photo de vous')).toBeInTheDocument();
  });

  it('conserve les liens de navigation', async () => {
    renderPage();
    await screen.findByText('Awa Kouassi', { selector: 'h2' });

    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute('href', '/ci/gerant');
    expect(screen.getByRole('link', { name: 'Modifier le profil' })).toHaveAttribute(
      'href',
      '/ci/gerant/profil/modifier',
    );
    expect(screen.getByRole('link', { name: /Voir le suivi de vérification/ })).toHaveAttribute(
      'href',
      '/ci/gerant/verification/suivi',
    );
    expect(screen.getByRole('link', { name: /Contacter le support/ })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('bascule les préférences de notification', async () => {
    const user = userEvent.setup();
    renderPage();

    const marketing = screen.getByRole('switch', { name: 'Recevoir les notifications marketing' });
    expect(marketing).toHaveAttribute('aria-checked', 'false');

    await user.click(marketing);

    expect(marketing).toHaveAttribute('aria-checked', 'true');
  });

  it('adapte les liens au marché de l’URL', async () => {
    renderPage('/bj/gerant/profil');
    await screen.findByText('Awa Kouassi', { selector: 'h2' });

    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute('href', '/bj/gerant');
    expect(screen.getByRole('link', { name: 'Modifier le profil' })).toHaveAttribute(
      'href',
      '/bj/gerant/profil/modifier',
    );
  });
});
