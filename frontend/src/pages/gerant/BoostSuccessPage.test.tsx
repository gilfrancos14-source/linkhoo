import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import BoostSuccessPage from './BoostSuccessPage';

const mocks = vi.hoisted(() => ({
  userId: 'user_clerk_1' as string | null,
  isLoaded: true,
  confirm: vi.fn<(transactionId: number) => Promise<unknown>>(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: mocks.userId, isLoaded: mocks.isLoaded }),
}));

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    apiBoosts: { confirm: mocks.confirm },
    ApiError: actual.ApiError,
  };
});

/** Refus structuré du serveur (POST /boosts/confirm → body.status). */
function confirmError(status: number, detail?: string) {
  return import('../../lib/api').then(({ ApiError }) => new ApiError('Paiement', status, detail));
}

function renderSuccess(entry = '/ci/gerant/boosts/success?id=123') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <BoostSuccessPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

/** La page lit window.location.search (pas le routeur) : on pilote l'URL. */
function setSearch(search: string) {
  window.history.replaceState(null, '', `/ci/gerant/boosts/success${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'user_clerk_1';
  mocks.isLoaded = true;
  mocks.confirm.mockResolvedValue({ success: true, already_active: false });
  setSearch('?id=123');
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('BoostSuccessPage', () => {
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
    expect(
      screen.queryByRole('button', { name: 'Revérifier le paiement' }),
    ).not.toBeInTheDocument();
  });

  it('confirme la campagne et affiche le succès', async () => {
    renderSuccess();

    expect(await screen.findByText('Paiement confirmé')).toBeInTheDocument();
    expect(screen.getByText('Votre campagne est maintenant active !')).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledWith(123);
  });

  it('propose le lien vers la liste des campagnes après confirmation', async () => {
    renderSuccess();

    const link = await screen.findByRole('link', { name: 'Voir mes campagnes' });
    expect(link).toHaveAttribute('href', '/ci/gerant/boosts');
    expect(
      screen.getByRole('link', { name: 'Retour au tableau de bord' }),
    ).toHaveAttribute('href', '/ci/gerant');
    expect(
      screen.queryByRole('button', { name: 'Revérifier le paiement' }),
    ).not.toBeInTheDocument();
  });

  it('construit les liens depuis le segment /bj', async () => {
    setSearch('?id=123');

    render(
      <MemoryRouter initialEntries={['/bj/gerant/boosts/success?id=123']}>
        <MarketProvider>
          <BoostSuccessPage />
        </MarketProvider>
      </MemoryRouter>,
    );

    const link = await screen.findByRole('link', { name: 'Voir mes campagnes' });
    expect(link).toHaveAttribute('href', '/bj/gerant/boosts');
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

  it('demande une connexion quand aucun userId Clerk n’est exposé', async () => {
    mocks.userId = null;

    renderSuccess();

    expect(
      await screen.findByText(
        'Vous devez être connecté pour confirmer votre paiement. Connectez-vous puis revenez sur cette page.',
      ),
    ).toBeInTheDocument();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Erreur' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Revérifier le paiement' }),
    ).not.toBeInTheDocument();
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

  it('affiche l’erreur brute d’un échec non lié à l’attente de paiement', async () => {
    mocks.confirm.mockRejectedValue(new Error('FedaPay indisponible'));

    renderSuccess();

    expect(await screen.findByText('FedaPay indisponible')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Erreur' })).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Revérifier le paiement' })).toBeInTheDocument();
  });

  it('relance la vérification manuellement après une erreur', async () => {
    mocks.confirm.mockRejectedValueOnce(new Error('FedaPay indisponible'));
    mocks.confirm.mockResolvedValueOnce({ success: true });
    renderSuccess();
    await screen.findByText('FedaPay indisponible');

    fireEvent.click(screen.getByRole('button', { name: 'Revérifier le paiement' }));

    expect(await screen.findByText('Paiement confirmé')).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole('button', { name: 'Revérifier le paiement' }),
    ).not.toBeInTheDocument();
  });

  it('réessaie automatiquement quand le paiement est encore en attente', async () => {
    vi.useFakeTimers();
    mocks.confirm.mockRejectedValueOnce(await confirmError(400, 'pending'));
    mocks.confirm.mockResolvedValueOnce({ success: true });

    renderSuccess();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('heading', { name: 'Confirmation en cours...' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/nouvelle tentative/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Paiement confirmé')).toBeInTheDocument();
    expect(screen.queryByText(/nouvelle tentative/)).not.toBeInTheDocument();
  });

  it('abandonne après 3 relances automatiques infructueuses', async () => {
    vi.useFakeTimers();
    mocks.confirm.mockRejectedValue(await confirmError(400, 'pending'));

    renderSuccess();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.confirm).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100);
      });
    }

    // 1 tentative initiale + 3 relances, puis message d'aide en erreur.
    expect(mocks.confirm).toHaveBeenCalledTimes(4);
    expect(screen.getByRole('heading', { name: 'Erreur' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Le paiement n'a pas encore été confirmé. Si vous venez de payer, réessayez dans quelques secondes.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revérifier le paiement' })).toBeInTheDocument();
  });

  it('ne réessaie pas sur un paiement refusé (M5)', async () => {
    vi.useFakeTimers();
    mocks.confirm.mockRejectedValue(await confirmError(400, 'declined'));

    renderSuccess();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText(/Paiement refusé/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Erreur' })).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/nouvelle tentative/)).not.toBeInTheDocument();
    expect(screen.queryByText(/réessayez dans quelques secondes/)).not.toBeInTheDocument();
  });

  it('ne réessaie pas sur un paiement annulé (M5)', async () => {
    mocks.confirm.mockRejectedValue(await confirmError(400, 'canceled'));

    renderSuccess();

    expect(await screen.findByText('Paiement annulé. Vous pouvez relancer un paiement depuis votre espace.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Erreur' })).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });

  it('oriente vers le support quand la campagne est introuvable (409, M4)', async () => {
    mocks.confirm.mockRejectedValue(await confirmError(409, 'paid_without_campaign'));

    renderSuccess();

    expect(await screen.findByText(/Contactez le support/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Erreur' })).toBeInTheDocument();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });
});
