import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import ProfilPage from './ProfilPage';
import type { GerantData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(delta: number) => void>(),
  getMe: vi.fn<() => Promise<GerantData>>(),
  updateMe: vi.fn<(form: unknown) => Promise<GerantData>>(),
}));

// Seul useNavigate est remplacé (annulation du formulaire) : useLocation
// reste réel pour MarketProvider.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('../../lib/api', () => ({
  apiGerants: { getMe: mocks.getMe, updateMe: mocks.updateMe },
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
    is_premium: true,
    premium_expires_at: '2027-01-01T00:00:00.000Z',
    created_at: '2025-11-01T09:00:00.000Z',
    ...overrides,
  };
}

function renderProfil(entry = '/ci/gerant/profil') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <ProfilPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function submitButton(): HTMLElement {
  const button = screen
    .getAllByRole('button')
    .find((b) => b.getAttribute('type') === 'submit');
  if (!button) throw new Error('bouton de soumission introuvable');
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMe.mockResolvedValue(makeGerant());
  mocks.updateMe.mockImplementation((form) =>
    Promise.resolve(makeGerant(form as Partial<GerantData>)),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProfilPage', () => {
  it("affiche l'état de chargement tant que le profil n'est pas résolu", () => {
    mocks.getMe.mockImplementation(() => new Promise<GerantData>(() => {}));

    renderProfil();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Mon profil' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByLabelText('Prénom')).not.toBeInTheDocument();
  });

  it('pré-remplit le formulaire et fige le champ email', async () => {
    renderProfil();

    expect(await screen.findByLabelText('Prénom')).toHaveValue('Awa');
    expect(screen.getByLabelText('Nom')).toHaveValue('Kouassi');
    expect(screen.getByLabelText('Téléphone')).toHaveValue('+225 07 00 00 00');
    const email = screen.getByLabelText('Email');
    expect(email).toHaveValue('awa@ilehya.ci');
    expect(email).toBeDisabled();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('affiche le nom, l’email et les initiales du gérant', async () => {
    renderProfil();

    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent(
      'Awa Kouassi',
    );
    expect(screen.getByText('awa@ilehya.ci')).toBeInTheDocument();
    // prenom[0] + nom[0] = « AK »
    expect(
      document.querySelector('.profil-avatar span'),
    ).toHaveTextContent('AK');
  });

  it('affiche une icône dans l’avatar quand le profil est vide', async () => {
    mocks.getMe.mockResolvedValue(
      makeGerant({
        prenom: '',
        nom: '',
        email: '',
        is_verified: false,
        is_premium: false,
      }),
    );

    const { container } = renderProfil();

    expect(await screen.findByLabelText('Prénom')).toHaveValue('');
    expect(container.querySelector('.profil-avatar span')).toBeNull();
    expect(container.querySelector('.profil-avatar svg')).not.toBeNull();
    expect(container.querySelector('.profil-badge')).toBeNull();
  });

  it('affiche les badges vérifié et premium quand les drapeaux sont vrais', async () => {
    const { container } = renderProfil();

    expect(await screen.findByLabelText('Prénom')).toBeInTheDocument();
    expect(container.querySelector('.profil-badge--verified')).not.toBeNull();
    expect(container.querySelector('.profil-badge--premium')).not.toBeNull();
    expect(
      container.querySelector('.profil-badge--verified'),
    ).toHaveTextContent('Vérifié');
    expect(
      container.querySelector('.profil-badge--premium'),
    ).toHaveTextContent('Premium');
  });

  it('résume les statuts du compte (vérifié / premium actifs)', async () => {
    renderProfil();

    expect(await screen.findByText('Marché')).toBeInTheDocument();
    const valeurs = Array.from(
      document.querySelectorAll('.profil-info__value'),
    ).map((el) => el.textContent);
    expect(valeurs).toContain('Côte d\'Ivoire');
    expect(valeurs).toContain('Oui');
    expect(valeurs).toContain('Actif');
    expect(valeurs).toContain(
      new Date('2025-11-01T09:00:00.000Z').toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );
  });

  it('résume les statuts d’un compte ni vérifié ni premium', async () => {
    mocks.getMe.mockResolvedValue(
      makeGerant({ is_verified: false, is_premium: false, created_at: '' }),
    );

    const { container } = renderProfil();

    expect(await screen.findByText('Marché')).toBeInTheDocument();
    const valeurs = Array.from(
      container.querySelectorAll('.profil-info__value'),
    ).map((el) => el.textContent);
    // [marché, inscrit le, vérifié, premium]
    expect(valeurs).toHaveLength(4);
    expect(valeurs[2]).toBe('Non');
    expect(valeurs[3]).toBe('Inactif');
    expect(valeurs[1]).toBe('—');
    expect(container.querySelector('.profil-badge')).toBeNull();
  });

  it('libelle le marché Bénin pour une URL /bj', async () => {
    renderProfil('/bj/gerant/profil');

    expect(await screen.findByText('Bénin')).toBeInTheDocument();
    expect(screen.queryByText("Côte d'Ivoire")).not.toBeInTheDocument();
  });

  it('enregistre les modifications du formulaire via l’API', async () => {
    const user = userEvent.setup();
    renderProfil();
    await screen.findByLabelText('Prénom');

    await user.clear(screen.getByLabelText('Prénom'));
    await user.type(screen.getByLabelText('Prénom'), 'Aïcha');
    await user.clear(screen.getByLabelText('Nom'));
    await user.type(screen.getByLabelText('Nom'), 'Diabaté');
    await user.clear(screen.getByLabelText('Téléphone'));
    await user.type(screen.getByLabelText('Téléphone'), '+225 05 05 05 05');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Profil mis à jour avec succès')).toBeInTheDocument();
    expect(mocks.updateMe).toHaveBeenCalledWith({
      prenom: 'Aïcha',
      nom: 'Diabaté',
      phone: '+225 05 05 05 05',
    });
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
  });

  it('efface le message de succès au bout de 3 secondes', async () => {
    renderProfil();
    await screen.findByLabelText('Prénom');

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Prénom'), {
      target: { value: 'Awa' },
    });
    fireEvent.click(submitButton());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.getByText('Profil mis à jour avec succès'),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(
      screen.queryByText('Profil mis à jour avec succès'),
    ).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("affiche le message d'erreur renvoyé par l'API", async () => {
    mocks.updateMe.mockRejectedValue(new Error('Numéro invalide'));
    const user = userEvent.setup();
    renderProfil();
    await screen.findByLabelText('Prénom');

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Numéro invalide')).toBeInTheDocument();
    expect(screen.queryByText('Profil mis à jour avec succès')).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it('affiche une erreur générique pour un rejet non typé', async () => {
    mocks.updateMe.mockRejectedValue('boom');
    const user = userEvent.setup();
    renderProfil();
    await screen.findByLabelText('Prénom');

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('Erreur lors de la mise à jour'),
    ).toBeInTheDocument();
  });

  it("efface l'erreur dès que l'utilisateur modifie un champ", async () => {
    mocks.updateMe.mockRejectedValue(new Error('Numéro invalide'));
    const user = userEvent.setup();
    renderProfil();
    await screen.findByLabelText('Prénom');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByText('Numéro invalide');

    await user.type(screen.getByLabelText('Téléphone'), '9');

    expect(screen.queryByText('Numéro invalide')).not.toBeInTheDocument();
    expect(screen.queryByText('Profil mis à jour avec succès')).not.toBeInTheDocument();
  });

  it('verrouille le bouton et affiche le spinner pendant la sauvegarde', async () => {
    mocks.updateMe.mockImplementation(
      () => new Promise<GerantData>(() => {}),
    );
    const user = userEvent.setup();
    renderProfil();
    await screen.findByLabelText('Prénom');

    await user.click(submitButton());

    expect(submitButton()).toBeDisabled();
    expect(submitButton().querySelector('.profil-spinner')).not.toBeNull();
    expect(screen.queryByText('Enregistrer')).not.toBeInTheDocument();
    expect(screen.queryByText('Profil mis à jour avec succès')).not.toBeInTheDocument();
  });

  it("revient en arrière avec le bouton Annuler", async () => {
    const user = userEvent.setup();
    renderProfil();
    await screen.findByLabelText('Prénom');

    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith(-1);
    expect(mocks.updateMe).not.toHaveBeenCalled();
  });

  it("survit à un échec de chargement du profil", async () => {
    mocks.getMe.mockRejectedValue(new Error('404'));

    renderProfil();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mon profil' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Prénom')).toHaveValue('');
    expect(screen.getByLabelText('Nom')).toHaveValue('');
    expect(mocks.updateMe).not.toHaveBeenCalled();
  });
});
