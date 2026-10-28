import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import { ApiError, type ReservationData } from '../lib/api';
import ReservationPaymentPage from './ReservationPaymentPage';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn<(reference: string) => Promise<unknown>>(),
}));

vi.mock('../lib/reservations', () => ({
  confirmReservationPayment: mocks.confirm,
}));

function reservation(overrides: Partial<ReservationData> = {}): ReservationData {
  return {
    id: 'res-1',
    client_name: 'Aya Koffi',
    client_email: 'aya@mail.ci',
    client_phone: '+225 01 02 03 04',
    room_id: 'room-1',
    room_title: 'Suite vue mer',
    date_debut: '2030-06-01',
    date_fin: '2030-06-05',
    duree_nombre: 4,
    duree_unite: 'nuit',
    montant: 120000,
    statut: 'en_attente',
    created_at: '2030-05-01T10:00:00Z',
    responded_at: null,
    payment_status: 'paid',
    paid_at: '2030-05-03T12:00:00Z',
    ...overrides,
  };
}

function confirmation(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    already_paid: false,
    payment_status: 'paid',
    paid_at: '2030-05-03T12:00:00Z',
    reservation: reservation(),
    ...overrides,
  };
}

function renderPage(entry = '/ci/reservation/paiement?reference=pay-1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <ReservationPaymentPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

/** La page lit window.location.search (pas le routeur) : on pilote l'URL. */
function setSearch(search: string) {
  window.history.replaceState(null, '', `/ci/reservation/paiement${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirm.mockResolvedValue(confirmation());
  setSearch('?reference=pay-1');
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('ReservationPaymentPage', () => {
  it('affiche « Confirmation en cours... » tant que l’API ne répond pas', () => {
    mocks.confirm.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Confirmation en cours...' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Vérification de votre paiement...')).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledWith('pay-1');
  });

  it('confirme le paiement et affiche le récapitulatif de la réservation', async () => {
    renderPage();

    expect(await screen.findByText('Paiement confirmé')).toBeInTheDocument();
    expect(
      screen.getByText('Votre réservation est payée. Le gérant va la confirmer.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Suite vue mer')).toBeInTheDocument();
    expect(screen.getByText('120 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText('Montant réglé')).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });

  it('ne détaille rien quand la confirmation ne renvoie pas la réservation', async () => {
    mocks.confirm.mockResolvedValue(confirmation({ reservation: null }));

    renderPage();

    expect(await screen.findByText('Paiement confirmé')).toBeInTheDocument();
    expect(screen.queryByText('Montant réglé')).not.toBeInTheDocument();
  });

  it('traite PAYMENT_NOT_SUCCEEDED comme un paiement en attente', async () => {
    mocks.confirm.mockRejectedValue(
      new ApiError('Le paiement n’a pas encore été confirmé par Hub2.', 409, {
        code: 'PAYMENT_NOT_SUCCEEDED',
      }),
    );

    renderPage();

    expect(
      await screen.findByText('Paiement en attente de confirmation'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Le paiement n'a pas encore été confirmé. Si vous venez de payer, réessayez dans quelques secondes.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Revérifier le paiement' }),
    ).toBeInTheDocument();
  });

  it('signale une référence manquante sans appeler l’API', async () => {
    setSearch('');

    renderPage();

    expect(
      await screen.findByText('Référence de paiement manquante.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paiement non confirmé' })).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Revérifier le paiement' }),
    ).toBeInTheDocument();
  });

  it('affiche le message d’erreur brut du service', async () => {
    mocks.confirm.mockRejectedValue(new Error('Hub2 indisponible'));

    renderPage();

    expect(await screen.findByText('Hub2 indisponible')).toBeInTheDocument();
    expect(
      screen.queryByText(/pas encore été confirmé/),
    ).not.toBeInTheDocument();
  });

  it('affiche un message générique pour un rejet non typé', async () => {
    mocks.confirm.mockRejectedValue('boom');

    renderPage();

    expect(
      await screen.findByText('Erreur lors de la confirmation du paiement.'),
    ).toBeInTheDocument();
  });

  it('relance la vérification avec le bouton « Revérifier le paiement »', async () => {
    mocks.confirm
      .mockRejectedValueOnce(new Error('Hub2 indisponible'))
      .mockResolvedValueOnce(confirmation());
    renderPage();
    await screen.findByText('Hub2 indisponible');

    fireEvent.click(screen.getByRole('button', { name: 'Revérifier le paiement' }));

    expect(await screen.findByText('Paiement confirmé')).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(mocks.confirm).toHaveBeenNthCalledWith(1, 'pay-1');
    expect(mocks.confirm).toHaveBeenNthCalledWith(2, 'pay-1');
    expect(
      screen.queryByRole('button', { name: 'Revérifier le paiement' }),
    ).not.toBeInTheDocument();
  });

  it('verrouille le bouton et affiche « Vérification... » pendant la relance', async () => {
    mocks.confirm.mockRejectedValueOnce(new Error('Hub2 indisponible'));
    renderPage();
    await screen.findByText('Hub2 indisponible');
    mocks.confirm.mockImplementation(() => new Promise(() => {}));

    fireEvent.click(screen.getByRole('button', { name: 'Revérifier le paiement' }));

    expect(
      await screen.findByRole('button', { name: 'Vérification...' }),
    ).toBeDisabled();
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
  });

  it('propose le retour au compte et à l’accueil du marché', async () => {
    renderPage();

    await screen.findByText('Paiement confirmé');
    expect(
      screen.getByRole('link', { name: 'Voir mes réservations' }),
    ).toHaveAttribute('href', '/ci/compte');
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute(
      'href',
      '/ci',
    );
  });
});
