import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminGerantDrawer from './AdminGerantDrawer';
import type { AdminGerant } from '../lib/adminApi';
import type { VerificationDocument } from '../lib/api';

const mocks = vi.hoisted(() => ({
  getVerificationDocuments: vi.fn<(gerantId: string) => Promise<VerificationDocument[]>>(),
  startGerantReview: vi.fn<(gerantId: string) => Promise<AdminGerant>>(),
  approveGerantVerification: vi.fn<(gerantId: string) => Promise<AdminGerant>>(),
  rejectGerantVerification: vi.fn<(gerantId: string, reason: string) => Promise<AdminGerant>>(),
  reviewDocument: vi.fn<
    (docId: string, status: 'approved' | 'rejected', reason?: string) => Promise<VerificationDocument>
  >(),
  setPayoutVerification: vi.fn<
    (id: string, verified: boolean) => Promise<{ verified: boolean; verified_at: string | null }>
  >(),
}));

vi.mock('../lib/adminApi', () => ({
  apiAdmin: {
    getVerificationDocuments: mocks.getVerificationDocuments,
    startGerantReview: mocks.startGerantReview,
    approveGerantVerification: mocks.approveGerantVerification,
    rejectGerantVerification: mocks.rejectGerantVerification,
    reviewDocument: mocks.reviewDocument,
    setPayoutVerification: mocks.setPayoutVerification,
  },
}));

// La vraie carte charge react-leaflet + leaflet : inutile pour ce test.
vi.mock('./PropertyMap', () => ({
  default: ({
    lat,
    lng,
    mapsUrl,
  }: {
    lat: number;
    lng: number;
    mapsUrl?: string | null;
  }) => (
    <div
      data-testid="property-map"
      data-lat={String(lat)}
      data-lng={String(lng)}
      data-maps-url={mapsUrl ?? ''}
    />
  ),
}));

const pendingGerant: AdminGerant = {
  id: 'g-1',
  email: 'awa.kone@ilehya.ci',
  nom: 'Koné',
  prenom: 'Awa',
  phone: '+225070102030',
  address: 'Cocody, Abidjan',
  date_of_birth: '1995-03-12',
  nationality: 'Ivoirienne',
  market: 'CI',
  is_verified: false,
  verified_at: null,
  verification_requested_at: '2026-01-10T09:00:00.000Z',
  verification_status: 'pending',
  verification_rejection_reason: null,
  verification_submitted_at: '2026-01-10T09:00:00.000Z',
  verification_reviewed_at: null,
  property_maps_url: 'https://maps.google.com/?q=5.324,-4.012',
  property_lat: 5.324,
  property_lng: -4.012,
  is_premium: false,
  premium_expires_at: null,
  created_at: '2025-12-01T00:00:00.000Z',
};

const noAddressGerant: AdminGerant = {
  ...pendingGerant,
  property_maps_url: null,
  property_lat: null,
  property_lng: null,
};

function makeDoc(overrides: Partial<VerificationDocument>): VerificationDocument {
  return {
    id: 'd-id',
    gerant_id: 'g-1',
    document_type: 'national_id',
    file_url: '/uploads/id.png',
    file_path: 'uploads/id.png',
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

const idDoc = makeDoc({ id: 'd-id', document_type: 'national_id' });
const proofDoc = makeDoc({
  id: 'd-proof',
  document_type: 'proof_of_address',
  file_url: '/uploads/proof.png',
  file_path: 'uploads/proof.png',
  original_filename: 'facture.jpg',
});
const selfieDoc = makeDoc({
  id: 'd-selfie',
  document_type: 'selfie',
  file_url: '/uploads/selfie.png',
  file_path: 'uploads/selfie.png',
  original_filename: 'selfie.jpg',
});
const threeDocs: VerificationDocument[] = [idDoc, proofDoc, selfieDoc];

/** Attend l'ouverture animée du drawer (requestAnimationFrame → pointer-events auto). */
async function renderDrawer(gerant: AdminGerant = pendingGerant) {
  const onClosed = vi.fn();
  const onUpdated = vi.fn();
  const utils = render(
    <AdminGerantDrawer gerant={gerant} onClose={onClosed} onUpdated={onUpdated} />,
  );
  await waitFor(() => {
    const root = utils.container.firstElementChild;
    if (!(root instanceof HTMLElement)) {
      throw new Error('racine du drawer absente');
    }
    expect(root.style.pointerEvents).toBe('auto');
  });
  return { ...utils, onClosed, onUpdated };
}

/** Carte d'un document identifié par son titre. */
function docCard(titlePattern: RegExp) {
  const heading = screen.getByRole('heading', { level: 3, name: titlePattern });
  const headerRow = heading.parentElement;
  const card = headerRow?.parentElement;
  if (!(card instanceof HTMLElement)) {
    throw new Error(`carte du document ${String(titlePattern)} introuvable`);
  }
  return within(card);
}

/** Zone d'actions en pied de drawer (bouton « Commencer la révision »). */
function footerInner() {
  const start = screen.getByRole('button', { name: 'Commencer la révision' });
  const inner = start.parentElement;
  if (!(inner instanceof HTMLElement)) {
    throw new Error('pied du drawer introuvable');
  }
  return inner;
}

/** Premier bouton du DOM = la croix de fermeture de l'en-tête. */
function closeButton() {
  const buttons = screen.getAllByRole('button');
  return buttons[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getVerificationDocuments.mockResolvedValue(threeDocs);
  mocks.startGerantReview.mockResolvedValue({
    ...pendingGerant,
    verification_status: 'under_review',
  });
  mocks.approveGerantVerification.mockResolvedValue({
    ...pendingGerant,
    is_verified: true,
    verification_status: 'approved',
  });
  mocks.rejectGerantVerification.mockResolvedValue({
    ...pendingGerant,
    verification_status: 'rejected',
  });
  mocks.reviewDocument.mockImplementation(async (docId, status) => {
    const base = threeDocs.find((doc) => doc.id === docId) ?? idDoc;
    return { ...base, status };
  });
});

afterEach(() => {
  cleanup();
});

describe('AdminGerantDrawer', () => {
  it("affiche l'en-tête du gérant avec ses badges de marché et de statut", async () => {
    await renderDrawer();

    const heading = screen.getByRole('heading', { level: 2, name: 'Awa Koné' });
    const headerInfo = heading.parentElement;
    if (!(headerInfo instanceof HTMLElement)) throw new Error('en-tête absent');

    expect(within(headerInfo).getByText('awa.kone@ilehya.ci')).toBeInTheDocument();
    expect(within(headerInfo).getByText('CI')).toBeInTheDocument();
    expect(within(headerInfo).getByText('En attente')).toBeInTheDocument();
  });

  it('affiche les informations personnelles pour la vérification manuelle', async () => {
    await renderDrawer();

    expect(screen.getByRole('heading', { name: 'Informations personnelles' })).toBeInTheDocument();
    expect(screen.getByText('12/03/1995')).toBeInTheDocument();
    expect(screen.getByText('Ivoirienne')).toBeInTheDocument();
    expect(screen.getByText('Cocody, Abidjan')).toBeInTheDocument();
    expect(screen.getByText('+225070102030')).toBeInTheDocument();
  });

  it("affiche « Chargement... » puis charge les documents du gérant", async () => {
    let resolveDocs: ((docs: VerificationDocument[]) => void) | null = null;
    mocks.getVerificationDocuments.mockImplementation(
      () =>
        new Promise<VerificationDocument[]>((resolve) => {
          resolveDocs = resolve;
        }),
    );

    await renderDrawer();

    expect(screen.getByText('Chargement...')).toBeInTheDocument();

    await act(async () => {
      resolveDocs?.(threeDocs);
    });

    expect(
      await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ }),
    ).toBeInTheDocument();
    expect(mocks.getVerificationDocuments).toHaveBeenCalledWith('g-1');
  });

  it("affiche le nom du fichier quand l'URL signée est absente", async () => {
    mocks.getVerificationDocuments.mockResolvedValue([makeDoc({ file_url: null })]);

    await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    const card = docCard(/Pièce d'identité/);
    expect(card.queryByRole('img')).toBeNull();
    expect(card.getByText('identite.jpg')).toBeInTheDocument();
  });

  it('affiche « Aucun document soumis. » quand la liste est vide', async () => {
    mocks.getVerificationDocuments.mockResolvedValue([]);

    await renderDrawer();

    expect(await screen.findByText('Aucun document soumis.')).toBeInTheDocument();
    expect(mocks.getVerificationDocuments).toHaveBeenCalledWith('g-1');
  });

  it('affiche une erreur quand le chargement des documents échoue', async () => {
    mocks.getVerificationDocuments.mockRejectedValue(new Error('boom'));

    await renderDrawer();

    expect(
      await screen.findByText('Erreur lors du chargement des documents'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).toBeNull();
  });

  it('ferme via la croix de l’en-tête (après l’animation de 300 ms)', async () => {
    const { onClosed, onUpdated } = await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    await userEvent.click(closeButton());

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('ferme via le clic sur l’overlay', async () => {
    const { container, onClosed } = await renderDrawer();

    const root = container.firstElementChild;
    if (!(root instanceof HTMLElement)) throw new Error('racine absente');
    const overlay = root.firstElementChild;
    if (!(overlay instanceof HTMLElement)) throw new Error('overlay absent');
    fireEvent.click(overlay);

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
  });

  it('« Commencer la révision » appelle l’API et notifie onUpdated', async () => {
    const { onUpdated } = await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    await userEvent.click(
      screen.getByRole('button', { name: 'Commencer la révision' }),
    );

    expect(mocks.startGerantReview).toHaveBeenCalledWith('g-1');
    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ verification_status: 'under_review' }),
      ),
    );
  });

  it('affiche les trois documents du nouveau parcours dans l’ordre', async () => {
    mocks.getVerificationDocuments.mockResolvedValue([
      makeDoc({ id: 'd-selfie', document_type: 'selfie' }),
      makeDoc({ id: 'd-id', document_type: 'national_id' }),
      makeDoc({ id: 'd-address', document_type: 'proof_of_address' }),
    ]);

    await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
      .filter((label) => ['Pièce d\'identité', 'Justificatif de domicile', 'Selfie'].includes(label ?? ''));

    expect(headings).toEqual(['Pièce d\'identité', 'Justificatif de domicile', 'Selfie']);
    expect(
      within(footerInner()).getByRole('button', { name: 'Approuver' }),
    ).toHaveAttribute('title', 'Les 3 documents doivent être approuvés');
  });

  it('désactive « Approuver » tant que les documents ne sont pas tous approuvés', async () => {
    await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    const footerApprove = within(
      footerInner(),
    ).getByRole('button', { name: 'Approuver' });

    expect(footerApprove).toBeDisabled();
    expect(footerApprove).toHaveAttribute(
      'title',
      'Les 3 documents doivent être approuvés',
    );
    expect(mocks.approveGerantVerification).not.toHaveBeenCalled();
  });

  it('approuve chaque document puis valide la demande complète', async () => {
    const { onClosed, onUpdated } = await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    // 1. Approuve la pièce d'identité.
    await userEvent.click(
      docCard(/Pièce d'identité/).getByRole('button', { name: 'Approuver' }),
    );
    await waitFor(() =>
      expect(mocks.reviewDocument).toHaveBeenCalledWith('d-id', 'approved', undefined),
    );
    expect(await screen.findAllByText('Approuvé')).toHaveLength(1);

    // 2. Approuve le justificatif de domicile.
    await userEvent.click(
      docCard(/Justificatif de domicile/).getByRole('button', { name: 'Approuver' }),
    );
    await waitFor(() =>
      expect(mocks.reviewDocument).toHaveBeenCalledWith('d-proof', 'approved', undefined),
    );
    expect(await screen.findAllByText('Approuvé')).toHaveLength(2);

    // 3. Approuve le selfie.
    await userEvent.click(
      docCard(/Selfie/).getByRole('button', { name: 'Approuver' }),
    );
    await waitFor(() =>
      expect(mocks.reviewDocument).toHaveBeenCalledWith('d-selfie', 'approved', undefined),
    );
    expect(await screen.findAllByText('Approuvé')).toHaveLength(3);

    // 4. Le bouton du pied devient actif : validation finale.
    const footerApprove = screen.getByRole('button', { name: 'Approuver' });
    expect(footerApprove).toBeEnabled();
    await userEvent.click(footerApprove);

    expect(mocks.approveGerantVerification).toHaveBeenCalledWith('g-1');
    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ is_verified: true }),
      ),
    );
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
  });

  it("rejette un document individuellement avec un motif", async () => {
    mocks.reviewDocument.mockResolvedValue(
      makeDoc({
        id: 'd-id',
        document_type: 'national_id',
        status: 'rejected',
        rejection_reason: 'Photo illisible',
      }),
    );
    await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    await userEvent.click(
      docCard(/Pièce d'identité/).getByRole('button', { name: 'Rejeter' }),
    );

    const input = screen.getByPlaceholderText('Raison du rejet...');
    const confirm = screen.getByRole('button', { name: 'Confirmer' });
    expect(confirm).toBeDisabled();

    await userEvent.type(input, 'Photo illisible');
    await userEvent.click(confirm);

    await waitFor(() =>
      expect(mocks.reviewDocument).toHaveBeenCalledWith(
        'd-id',
        'rejected',
        'Photo illisible',
      ),
    );
    expect(await docCard(/Pièce d'identité/).findByText('Rejeté')).toBeInTheDocument();
  });

  it("annule la saisie du motif de rejet d'un document", async () => {
    await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    await userEvent.click(
      docCard(/Pièce d'identité/).getByRole('button', { name: 'Rejeter' }),
    );
    expect(screen.getByPlaceholderText('Raison du rejet...')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByPlaceholderText('Raison du rejet...')).toBeNull();
    expect(mocks.reviewDocument).not.toHaveBeenCalled();
    // Les boutons d'actions du document réapparaissent.
    expect(
      docCard(/Pièce d'identité/).getByRole('button', { name: 'Rejeter' }),
    ).toBeInTheDocument();
  });

  it('rejette la demande globalement avec un motif', async () => {
    const { onClosed, onUpdated } = await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    await userEvent.click(
      within(footerInner()).getByRole('button', { name: 'Rejeter' }),
    );

    const input = screen.getByPlaceholderText(
      'Expliquez pourquoi la demande est rejetée...',
    );
    const confirm = screen.getByRole('button', { name: 'Confirmer' });
    expect(confirm).toBeDisabled();

    await userEvent.type(input, 'Documents non conformes');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);

    expect(mocks.rejectGerantVerification).toHaveBeenCalledWith(
      'g-1',
      'Documents non conformes',
    );
    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ verification_status: 'rejected' }),
      ),
    );
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
  });

  it("signale l'adresse absente sans la rendre obligatoire", async () => {
    await renderDrawer(noAddressGerant);
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    expect(screen.getByText('Absente')).toBeInTheDocument();
    expect(
      screen.getByText('Adresse non fournie par le gérant.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('property-map')).toBeNull();

    const footerApprove = within(
      footerInner(),
    ).getByRole('button', { name: 'Approuver' });
    expect(footerApprove).toBeDisabled();
    expect(footerApprove).toHaveAttribute(
      'title',
      'Les 3 documents doivent être approuvés',
    );
  });

  it("autorise la validation sans adresse quand les documents sont approuvés", async () => {
    mocks.getVerificationDocuments.mockResolvedValue(
      threeDocs.map((doc) => ({ ...doc, status: 'approved' as const })),
    );

    await renderDrawer(noAddressGerant);
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    expect(within(footerInner()).getByRole('button', { name: 'Approuver' })).toBeEnabled();
  });

  it("affiche la carte, les coordonnées et le lien Google Maps quand l'adresse est fournie", async () => {
    await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    expect(screen.getByText('Fournie')).toBeInTheDocument();
    const map = screen.getByTestId('property-map');
    expect(map).toHaveAttribute('data-lat', '5.324');
    expect(map).toHaveAttribute('data-lng', '-4.012');
    expect(map).toHaveAttribute(
      'data-maps-url',
      'https://maps.google.com/?q=5.324,-4.012',
    );
    expect(screen.getByText('5.32400, -4.01200')).toBeInTheDocument();

    const link = screen.getByRole('link', {
      name: 'Ouvrir dans Google Maps ↗',
    });
    expect(link).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=5.324,-4.012',
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it("n'affiche aucune action en pied de drawer hors statut pending / under_review", async () => {
    const gerant: AdminGerant = {
      ...pendingGerant,
      verification_status: 'none',
      is_verified: false,
    };

    await renderDrawer(gerant);
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    expect(
      screen.queryByRole('button', { name: 'Commencer la révision' }),
    ).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Approuver' })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: 'Rejeter' })).toHaveLength(0);
    // La croix de fermeture reste disponible.
    expect(closeButton()).toBeInTheDocument();
  });

  it("affiche l'erreur renvoyée par l'API lors de la validation d'un document", async () => {
    mocks.reviewDocument.mockRejectedValue(new Error('Réseau indisponible'));
    await renderDrawer();
    await screen.findByRole('heading', { level: 3, name: /Pièce d'identité/ });

    await userEvent.click(
      docCard(/Pièce d'identité/).getByRole('button', { name: 'Approuver' }),
    );

    expect(await screen.findByText('Réseau indisponible')).toBeInTheDocument();
  });

  it('valide les coordonnées de reversement et prévient le parent', async () => {
    const gerant: AdminGerant = {
      ...pendingGerant,
      verification_status: 'none',
      is_verified: false,
      payout_method: 'mobile_money',
      payout_phone: '+2250700000000',
      payout_provider: 'orange',
      payout_holder_name: 'Awa Koné',
      payout_verified_at: null,
    };
    mocks.setPayoutVerification.mockResolvedValue({
      verified: true,
      verified_at: '2026-10-28T10:00:00.000Z',
    });

    const { onUpdated } = await renderDrawer(gerant);
    await screen.findByRole('heading', { level: 3, name: 'Coordonnées de reversement' });
    expect(screen.getByText('orange')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Valider les coordonnées' }),
    );

    await waitFor(() =>
      expect(mocks.setPayoutVerification).toHaveBeenCalledWith('g-1', true),
    );
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ payout_verified_at: '2026-10-28T10:00:00.000Z' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Révoquer' }),
    ).toBeInTheDocument();
  });
});
