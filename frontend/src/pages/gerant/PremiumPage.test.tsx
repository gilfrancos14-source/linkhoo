import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import PremiumPage from './PremiumPage';
import type { GerantData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  userId: 'user_clerk_1' as string | null,
  getMe: vi.fn<() => Promise<GerantData>>(),
  initiate: vi.fn<
    (market: string) => Promise<{ transaction_id: number; payment_url: string }>
  >(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: mocks.userId }),
}));

vi.mock('../../lib/api', () => ({
  apiGerants: { getMe: mocks.getMe },
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

// jsdom déclare `window.location` (et son `href`) comme propriétés
// non redéfinissables : `vi.spyOn(window.location, 'href', 'set')` lève
// « Cannot redefine property: href ». On asserte donc l'intention
// d'appel (`apiPremium.initiate`) et l'état UI de redirection à la place.
beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'user_clerk_1';
  mocks.getMe.mockResolvedValue(makeGerant());
  mocks.initiate.mockResolvedValue({
    transaction_id: 42,
    payment_url: 'https://fedapay.test/checkout/42',
  });
});

afterEach(() => {
  cleanup();
});

describe('PremiumPage', () => {
  it("affiche l'état de chargement tant que le profil gérant n'est pas résolu", () => {
    mocks.getMe.mockImplementation(() => new Promise<GerantData>(() => {}));

    renderPremium();

    expect(screen.getByRole('heading', { level: 1, name: 'Premium' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText('Devenez Premium')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it("n'interroge pas le profil gérant sans userId Clerk", () => {
    mocks.userId = null;

    renderPremium();

    expect(mocks.getMe).not.toHaveBeenCalled();
    // Comportement actuel : loading n'est jamais levé sans userId.
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText('Devenez Premium')).not.toBeInTheDocument();
  });

  it('présente le CTA Premium avec son tarif mensuel', async () => {
    renderPremium();

    expect(await screen.findByText('Devenez Premium')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Débloquez la visibilité premium pour vos annonces sur le marché CI.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '5 000 XOF / mois' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('liste les cinq avantages de l’abonnement', async () => {
    renderPremium();

    expect(
      await screen.findByRole('heading', { name: 'Avantages Premium' }),
    ).toBeInTheDocument();
    // « Badge <strong>Premium</strong> » est découpé : on lit le texte
    // concaténé de chaque <li> plutôt que getByText sur un nœud texte.
    const avantages = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(avantages).toHaveLength(5);
    expect(avantages).toContain('Une annonce sur 3 en tête des recherches et des catégories');
    expect(avantages).toContain('Badge Premium sur vos cartes de résultats');
    expect(avantages).toContain('Badge Premium sur la fiche publique de vos biens');
    expect(avantages).toContain('Gestion des réservations de vos biens');
    expect(avantages).toContain('Badge PRO et statut Premium dans votre espace gérant');
  });

  it('initie le paiement pour le marché CI puis reste bloqué sur la redirection', async () => {
    const user = userEvent.setup();
    renderPremium('/ci/premium');
    await screen.findByText('Devenez Premium');

    await user.click(screen.getByRole('button', { name: '5 000 XOF / mois' }));

    expect(mocks.initiate).toHaveBeenCalledTimes(1);
    expect(mocks.initiate).toHaveBeenCalledWith('CI');
    // Succès : processing reste vrai (la redirection est en cours) et
    // aucune erreur n'est affichée.
    expect(
      await screen.findByRole('button', { name: 'Redirection...' }),
    ).toBeDisabled();
    expect(screen.queryByText('Solde insuffisant')).not.toBeInTheDocument();
  });

  it('transmet le marché BJ déduit de l’URL', async () => {
    const user = userEvent.setup();
    renderPremium('/bj/premium');

    expect(
      await screen.findByText(
        'Débloquez la visibilité premium pour vos annonces sur le marché BJ.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '5 000 XOF / mois' }));

    expect(mocks.initiate).toHaveBeenCalledWith('BJ');
  });

  it('verrouille le bouton et affiche « Redirection... » pendant l’initiation', async () => {
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
    await screen.findByText('Devenez Premium');

    await user.click(screen.getByRole('button', { name: '5 000 XOF / mois' }));

    expect(await screen.findByRole('button', { name: 'Redirection...' })).toBeDisabled();
  });

  it('affiche le message d’erreur renvoyé par le service de paiement', async () => {
    mocks.initiate.mockRejectedValue(new Error('Solde insuffisant'));
    const user = userEvent.setup();
    renderPremium();
    await screen.findByText('Devenez Premium');

    await user.click(screen.getByRole('button', { name: '5 000 XOF / mois' }));

    expect(await screen.findByText('Solde insuffisant')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: '5 000 XOF / mois' }),
    ).toBeEnabled();
  });

  it('affiche une erreur générique pour un rejet non typé', async () => {
    mocks.initiate.mockRejectedValue('boom');
    const user = userEvent.setup();
    renderPremium();
    await screen.findByText('Devenez Premium');

    await user.click(screen.getByRole('button', { name: '5 000 XOF / mois' }));

    expect(
      await screen.findByText("Erreur lors de l'initiation du paiement"),
    ).toBeInTheDocument();
  });

  it('ne démarre aucun paiement quand le profil gérant est introuvable', async () => {
    mocks.getMe.mockRejectedValue(new Error('404'));
    const user = userEvent.setup();
    renderPremium();
    await screen.findByText('Devenez Premium');

    await user.click(screen.getByRole('button', { name: '5 000 XOF / mois' }));

    expect(mocks.initiate).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Erreur lors de l'initiation du paiement"),
    ).not.toBeInTheDocument();
  });

  it('affiche « Compte Premium actif » avec la date d’expiration', async () => {
    const expiresAt = '2027-03-15T00:00:00.000Z';
    mocks.getMe.mockResolvedValue(
      makeGerant({ is_premium: true, premium_expires_at: expiresAt }),
    );

    renderPremium();

    expect(await screen.findByText('Compte Premium actif')).toBeInTheDocument();
    const expected = new Date(expiresAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    expect(
      screen.getByText(`Votre abonnement expire le ${expected}.`),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Avantages Premium')).not.toBeInTheDocument();
  });

  it('propose à nouveau l’abonnement une fois la date dépassée', async () => {
    mocks.getMe.mockResolvedValue(
      makeGerant({
        is_premium: true,
        premium_expires_at: '2025-01-01T00:00:00.000Z',
      }),
    );

    renderPremium();

    expect(await screen.findByText('Devenez Premium')).toBeInTheDocument();
    expect(screen.queryByText('Compte Premium actif')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '5 000 XOF / mois' }),
    ).toBeInTheDocument();
  });

  it('affiche le compte actif quand premium_expires_at est absent même si le drapeau est vrai', async () => {
    // Sémantique unifiée (isPremiumActive / isQualifiedGerant) : un compte sans
    // date d'expiration n'est pas considéré périmé — pas de lockout par défaut.
    mocks.getMe.mockResolvedValue(
      makeGerant({ is_premium: true, premium_expires_at: null }),
    );

    renderPremium();

    expect(await screen.findByText('Compte Premium actif')).toBeInTheDocument();
    expect(screen.getByText('Votre abonnement est actif.')).toBeInTheDocument();
    expect(screen.queryByText('Devenez Premium')).not.toBeInTheDocument();
  });
});
