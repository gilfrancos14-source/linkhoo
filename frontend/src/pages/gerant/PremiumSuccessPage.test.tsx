import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import PremiumSuccessPage from './PremiumSuccessPage';

const mocks = vi.hoisted(() => ({
  userId: 'user_clerk_1' as string | null,
  isLoaded: true,
  confirm: vi.fn<(transactionId: number) => Promise<unknown>>(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: mocks.userId, isLoaded: mocks.isLoaded }),
}));

vi.mock('../../lib/api', () => ({
  apiPremium: { confirm: mocks.confirm },
}));

function renderSuccess(entry = '/ci/premium/success?id=123') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <PremiumSuccessPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

/** La page lit window.location.search (pas le routeur) : on pilote l'URL. */
function setSearch(search: string) {
  window.history.replaceState(null, '', `/ci/premium/success${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'user_clerk_1';
  mocks.isLoaded = true;
  mocks.confirm.mockResolvedValue({
    success: true,
    already_active: false,
    premium_expires_at: '2027-01-01T00:00:00.000Z',
  });
  setSearch('?id=123');
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('PremiumSuccessPage', () => {
  it('affiche « Confirmation en cours... » tant que l’API ne répond pas', () => {
    mocks.confirm.mockImplementation(() => new Promise(() => {}));

    renderSuccess();

    expect(
      screen.getByRole('heading', { name: 'Confirmation en cours...' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Vérification de votre paiement avec FedaPay...'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Retour au tableau de bord' }),
    ).not.toBeInTheDocument();
  });

  it('confirme la transaction et affiche le succès', async () => {
    renderSuccess();

    expect(await screen.findByText('Paiement confirmé')).toBeInTheDocument();
    expect(
      screen.getByText('Votre abonnement premium est maintenant actif !'),
    ).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledWith(123);
  });

  it('propose le retour au tableau de bord du marché CI après confirmation', async () => {
    renderSuccess();

    const link = await screen.findByRole('link', {
      name: 'Retour au tableau de bord',
    });
    expect(link).toHaveAttribute('href', '/ci/gerant');
    expect(screen.queryByRole('button', { name: /Revérifier/ })).toBeNull();
  });

  it('construit le lien de retour depuis le segment /bj', async () => {
    setSearch('?id=123');

    render(
      <MemoryRouter initialEntries={['/bj/premium/success?id=123']}>
        <MarketProvider>
          <PremiumSuccessPage />
        </MarketProvider>
      </MemoryRouter>,
    );

    const link = await screen.findByRole('link', {
      name: 'Retour au tableau de bord',
    });
    expect(link).toHaveAttribute('href', '/bj/gerant');
    expect(mocks.confirm).toHaveBeenCalledWith(123);
  });

  it('signale des paramètres invalides quand l’identifiant est vide', async () => {
    setSearch('?id=');

    renderSuccess();

    expect(
      await screen.findByText('Paramètres de paiement invalides.'),
    ).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Erreur' })).toBeInTheDocument();
  });

  it('signale des paramètres invalides quand l’identifiant n’est pas numérique', async () => {
    setSearch('?id=abc');

    renderSuccess();

    expect(
      await screen.findByText('Paramètres de paiement invalides.'),
    ).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('tranche l’identifiant avec parseInt (tolérance aux suffixes)', async () => {
    setSearch('?id=42abc');

    renderSuccess();

    expect(await screen.findByText('Paiement confirmé')).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledWith(42);
  });

  it('demande une connexion quand aucun userId Clerk n’est exposé', async () => {
    mocks.userId = null;

    renderSuccess();

    expect(
      await screen.findByText(
        'Vous devez être connecté pour confirmer votre paiement. Connectez-vous puis revenez sur cette page.',
      ),
    ).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /Revérifier/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Erreur' })).toBeInTheDocument();
  });

  it('reste en chargement tant que Clerk n’a pas chargé', () => {
    mocks.isLoaded = false;

    renderSuccess();

    expect(
      screen.getByRole('heading', { name: 'Confirmation en cours...' }),
    ).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Paramètres de paiement invalides.'),
    ).not.toBeInTheDocument();
  });

  it('traduit un paiement non confirmé en message d’aide', async () => {
    mocks.confirm.mockRejectedValue(new Error('Transaction non confirmée'));

    renderSuccess();

    expect(
      await screen.findByText(
        "Le paiement n'a pas encore été confirmé. Si vous venez de payer, réessayez dans quelques secondes.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Erreur' })).toBeInTheDocument();
  });

  it('affiche le message d’erreur brut du service', async () => {
    mocks.confirm.mockRejectedValue(new Error('FedaPay indisponible'));

    renderSuccess();

    expect(await screen.findByText('FedaPay indisponible')).toBeInTheDocument();
    expect(
      screen.queryByText(/pas encore été confirmé/),
    ).not.toBeInTheDocument();
  });

  it('affiche un message générique pour un rejet non typé', async () => {
    mocks.confirm.mockRejectedValue('boom');

    renderSuccess();

    expect(
      await screen.findByText(
        'Erreur lors de la confirmation du paiement.',
      ),
    ).toBeInTheDocument();
  });

  it('relance la vérification avec le bouton « Revérifier le paiement »', async () => {
    mocks.confirm.mockRejectedValueOnce(new Error('FedaPay indisponible'));
    mocks.confirm.mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    renderSuccess();
    await screen.findByText('FedaPay indisponible');

    await user.click(
      screen.getByRole('button', { name: 'Revérifier le paiement' }),
    );

    expect(await screen.findByText('Paiement confirmé')).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(mocks.confirm).toHaveBeenNthCalledWith(1, 123);
    expect(mocks.confirm).toHaveBeenNthCalledWith(2, 123);
    expect(
      screen.queryByRole('button', { name: 'Revérifier le paiement' }),
    ).not.toBeInTheDocument();
  });

  it('verrouille le bouton et affiche « Vérification... » pendant la relance', async () => {
    mocks.confirm.mockRejectedValueOnce(new Error('FedaPay indisponible'));
    renderSuccess();
    await screen.findByText('FedaPay indisponible');
    mocks.confirm.mockImplementation(() => new Promise(() => {}));

    fireEvent.click(screen.getByRole('button', { name: 'Revérifier le paiement' }));

    const locked = await screen.findByRole('button', {
      name: 'Vérification...',
    });
    expect(locked).toBeDisabled();
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
  });

  it('colore le bandeau selon le statut de confirmation', async () => {
    const { container } = renderSuccess();

    await screen.findByText('Paiement confirmé');
    let bandeau = container.querySelector<HTMLElement>('.verify-cta');
    expect(bandeau).not.toBeNull();
    // jsdom normalise les couleurs hexadécimales en rgb() dans el.style.
    expect(bandeau!.style.borderColor).toBe('rgb(16, 185, 129)');

    cleanup();
    mocks.confirm.mockRejectedValue(new Error('boom'));
    const second = renderSuccess();
    await screen.findByText('boom');
    bandeau = second.container.querySelector<HTMLElement>('.verify-cta');
    expect(bandeau!.style.borderColor).toBe('rgb(239, 68, 68)');
  });

  it('affiche le spinner de chargement dans l’icône du bandeau', async () => {
    mocks.confirm.mockImplementation(() => new Promise(() => {}));
    const { container } = renderSuccess();

    const icon = container.querySelector<HTMLElement>('.verify-cta__icon');
    expect(icon).not.toBeNull();
    expect(icon!.querySelector('svg')).toBeNull();
    // Le style d'animation porte sur l'enfant (le spinner), pas sur l'icône.
    const spinner = icon!.querySelector<HTMLElement>('div');
    expect(spinner).not.toBeNull();
    expect(spinner!.style.animation).toContain('spin');
    await act(async () => {
      await Promise.resolve();
    });
  });
});
