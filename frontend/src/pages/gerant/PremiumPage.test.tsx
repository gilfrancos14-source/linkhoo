import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import PremiumPage from './PremiumPage';
import type { GerantData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  userId: 'user_clerk_1' as string | null,
  gerant: null as GerantData | null,
  displayName: 'Koffi Mensah',
  initials: 'KM',
  reservationsCount: 3,
  messagesUnread: 2,
  initiate: vi.fn<
    (market: string) => Promise<{
      transaction_id?: number;
      payment_url?: string;
      reference?: string;
      checkout_url?: string;
    }>
  >(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: mocks.userId }),
}));

vi.mock('../../hooks/useGerantChrome', () => ({
  useGerantChrome: () => ({
    gerant: mocks.gerant,
    displayName: mocks.displayName,
    initials: mocks.initials,
    reservationsCount: mocks.reservationsCount,
    messagesUnread: mocks.messagesUnread,
  }),
}));

vi.mock('../../lib/api', () => ({
  apiPremium: { initiate: mocks.initiate },
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
    is_premium: false,
    premium_expires_at: null,
    created_at: '2025-11-01T09:00:00.000Z',
    ...overrides,
  };
}

function renderPremium(entry = '/ci/premium') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <PremiumPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'user_clerk_1';
  mocks.gerant = makeGerant();
  mocks.displayName = 'Koffi Mensah';
  mocks.reservationsCount = 3;
  mocks.messagesUnread = 2;
  mocks.initiate.mockResolvedValue({
    transaction_id: 42,
    payment_url: 'https://fedapay.test/checkout/42',
  });
});

afterEach(() => {
  cleanup();
});

describe('PremiumPage', () => {
  it('reprend l’en-tête et le texte de la maquette', () => {
    renderPremium();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Abonnez-vous au Premium' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Boostez la visibilité de vos chambres et attirez plus de voyageurs',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Votre hébergement mérite d’être vu !')).toBeInTheDocument();
    expect(screen.getByText('OFFRE PREMIUM')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Rechercher une chambre, une catégorie…'),
    ).toBeInTheDocument();
  });

  it('affiche les trois offres avec leurs tarifs', () => {
    renderPremium();

    expect(screen.getByRole('heading', { name: 'Mensuel' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trimestriel' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Annuel' })).toBeInTheDocument();
    expect(screen.getByText('15 000')).toBeInTheDocument();
    expect(screen.getByText('40 000')).toBeInTheDocument();
    expect(screen.getByText('150 000')).toBeInTheDocument();
    expect(screen.getByText('Le plus populaire')).toBeInTheDocument();
  });

  it('affiche les avantages et la mention « 1 mois offert »', () => {
    renderPremium();

    expect(screen.getAllByText('Visibilité prioritaire sur la plateforme')).toHaveLength(3);
    expect(screen.getByText('1 mois offert')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(13);
  });

  it('affiche le plan courant et les compteurs de la sidebar', () => {
    renderPremium();

    expect(screen.getByText(/Actuellement : Plan Gratuit/)).toBeInTheDocument();
    // 3 demandes en attente + 2 messages non lus.
    expect(screen.getByText('3')).toBeInTheDocument();
    // Badge sidebar + pastille de notifications.
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(screen.getByText('Koffi Mensah')).toBeInTheDocument();
  });

  it('affiche le plan Premium quand l’abonnement est actif', () => {
    mocks.gerant = makeGerant({
      is_premium: true,
      premium_expires_at: '2027-03-15T00:00:00.000Z',
    });

    renderPremium();

    expect(screen.getByText(/Actuellement : Plan Premium/)).toBeInTheDocument();
  });

  it('initie le paiement pour le marché CI', async () => {
    const user = userEvent.setup();
    renderPremium('/ci/premium');

    await user.click(screen.getAllByRole('button', { name: 'Choisir cette formule' })[0]);

    expect(mocks.initiate).toHaveBeenCalledTimes(1);
    expect(mocks.initiate).toHaveBeenCalledWith('CI');
  });

  it('transmet le marché BJ déduit de l’URL', async () => {
    const user = userEvent.setup();
    renderPremium('/bj/premium');

    await user.click(screen.getAllByRole('button', { name: 'Choisir cette formule' })[0]);

    expect(mocks.initiate).toHaveBeenCalledWith('BJ');
  });

  it('utilise checkout_url quand Hub2 le fournit (sans payment_url)', async () => {
    mocks.initiate.mockResolvedValue({
      reference: 'PAY-2026-ABC123',
      checkout_url: 'https://pay.hub2.io/link_1',
    });
    const user = userEvent.setup();
    renderPremium();

    await user.click(screen.getAllByRole('button', { name: 'Choisir cette formule' })[0]);

    expect(screen.queryByText('URL de paiement indisponible')).not.toBeInTheDocument();
  });

  it('signale une réponse sans URL de paiement', async () => {
    mocks.initiate.mockResolvedValue({ reference: 'PAY-2026-ABC123' });
    const user = userEvent.setup();
    renderPremium();

    await user.click(screen.getAllByRole('button', { name: 'Choisir cette formule' })[0]);

    expect(await screen.findByText('URL de paiement indisponible')).toBeInTheDocument();
  });

  it('verrouille les boutons pendant l’initiation', async () => {
    mocks.initiate.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ transaction_id: 1, payment_url: 'https://p.test/1' }),
            50,
          );
        }),
    );
    const user = userEvent.setup();
    renderPremium();

    await user.click(screen.getAllByRole('button', { name: 'Choisir cette formule' })[0]);

    for (const button of screen.getAllByRole('button', { name: 'Choisir cette formule' })) {
      expect(button).toBeDisabled();
    }
  });

  it('affiche le message d’erreur renvoyé par le service de paiement', async () => {
    mocks.initiate.mockRejectedValue(new Error('Solde insuffisant'));
    const user = userEvent.setup();
    renderPremium();

    await user.click(screen.getAllByRole('button', { name: 'Choisir cette formule' })[0]);

    expect(await screen.findByText('Solde insuffisant')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Choisir cette formule' })[0]).toBeEnabled();
  });

  it('affiche une erreur générique pour un rejet non typé', async () => {
    mocks.initiate.mockRejectedValue('boom');
    const user = userEvent.setup();
    renderPremium();

    await user.click(screen.getAllByRole('button', { name: 'Choisir cette formule' })[0]);

    expect(
      await screen.findByText("Erreur lors de l'initiation du paiement"),
    ).toBeInTheDocument();
  });

  it('ne démarre aucun paiement quand le profil gérant est introuvable', async () => {
    mocks.gerant = null;
    const user = userEvent.setup();
    renderPremium();

    await user.click(screen.getAllByRole('button', { name: 'Choisir cette formule' })[0]);

    expect(mocks.initiate).not.toHaveBeenCalled();
  });

  it('relie la page au profil et au support du marché courant', () => {
    renderPremium('/ci/premium');

    expect(screen.getByRole('link', { name: 'Retour à mon profil' })).toHaveAttribute(
      'href',
      '/ci/gerant/profil',
    );
    expect(screen.getByRole('link', { name: 'Contacter le support' })).toHaveAttribute(
      'href',
      '/ci/contact',
    );
  });
});
