import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AdminLogin from './AdminLogin';

const mocks = vi.hoisted(() => ({
  login: vi.fn<(email: string, password: string) => Promise<{ token: string }>>(),
  setAdminToken: vi.fn<(token: string | null) => void>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: { login: mocks.login },
  setAdminToken: mocks.setAdminToken,
}));

function DashboardStub() {
  return <div>Tableau de bord admin</div>;
}

function PathProbe() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderLogin(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/:market/admin/login" element={<AdminLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/:market/admin"
          element={
            <>
              <DashboardStub />
              <PathProbe />
            </>
          }
        />
        <Route
          path="/admin"
          element={
            <>
              <DashboardStub />
              <PathProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitCredentials(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Mot de passe'), password);
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.login.mockResolvedValue({ token: 'jwt-admin' });
});

afterEach(() => {
  cleanup();
});

describe('AdminLogin', () => {
  it('présente le formulaire de connexion admin', () => {
    renderLogin('/ci/admin/login');

    expect(screen.getByRole('heading', { level: 2, name: 'Bienvenue' })).toBeInTheDocument();
    expect(
      screen.getByText('Connectez-vous pour accéder au tableau de bord'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Mot de passe')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('admin@linkhoo.com')).toBeInTheDocument();
  });

  it('annonce le marché Côte d’Ivoire et les promesses du back-office sur /ci', () => {
    renderLogin('/ci/admin/login');

    expect(screen.getByText("Gérez votre espace Côte d'Ivoire")).toBeInTheDocument();
    expect(
      screen.getByText('Gestion des chambres et catégories'),
    ).toBeInTheDocument();
    expect(screen.getByText('Suivi des réservations en temps réel')).toBeInTheDocument();
    expect(screen.getByText('Statistiques et performance')).toBeInTheDocument();
    expect(screen.getByAltText('Linkhoo')).toBeInTheDocument();
  });

  it('annonce le marché Bénin sur /bj/admin/login', () => {
    renderLogin('/bj/admin/login');

    expect(screen.getByText('Gérez votre espace Bénin')).toBeInTheDocument();
    expect(screen.queryByText("Gérez votre espace Côte d'Ivoire")).not.toBeInTheDocument();
  });

  it('retombe sur Côte d’Ivoire à la racine /admin/login (pas de segment marché)', () => {
    renderLogin('/admin/login');

    expect(screen.getByText("Gérez votre espace Côte d'Ivoire")).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('affiche et masque le mot de passe', async () => {
    const user = userEvent.setup();
    renderLogin('/ci/admin/login');

    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Masquer le mot de passe' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password');
  });

  it('connecte l’admin, stocke le token et rejoint /ci/admin', async () => {
    const user = userEvent.setup();
    renderLogin('/ci/admin/login');

    await submitCredentials(user, 'admin@linkhoo.ci', 'secret-123');

    expect(await screen.findByText('Tableau de bord admin')).toBeInTheDocument();
    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(mocks.login).toHaveBeenCalledWith('admin@linkhoo.ci', 'secret-123');
    expect(mocks.setAdminToken).toHaveBeenCalledWith('jwt-admin');
    expect(screen.getByTestId('path')).toHaveTextContent('/ci/admin');
    expect(mocks.setAdminToken).not.toHaveBeenCalledWith(null);
  });

  it('rejoint /admin après connexion depuis la racine', async () => {
    const user = userEvent.setup();
    renderLogin('/admin/login');

    await submitCredentials(user, 'admin@linkhoo.ci', 'secret-123');

    expect(await screen.findByText('Tableau de bord admin')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/admin');
    expect(screen.getByTestId('path')).not.toHaveTextContent('/ci/admin');
  });

  it("rejoint /bj/admin après connexion depuis le marché béninois", async () => {
    const user = userEvent.setup();
    renderLogin('/bj/admin/login');

    await submitCredentials(user, 'admin@linkhoo.ci', 'secret-123');

    expect(await screen.findByText('Tableau de bord admin')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/bj/admin');
  });

  it("affiche l'erreur de connexion sans quitter la page", async () => {
    mocks.login.mockRejectedValue(new Error('Identifiants invalides'));
    const user = userEvent.setup();
    renderLogin('/ci/admin/login');

    await submitCredentials(user, 'admin@linkhoo.ci', 'mauvais-mdp');

    expect(await screen.findByText('Identifiants invalides')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
    expect(screen.queryByText('Tableau de bord admin')).not.toBeInTheDocument();
    expect(mocks.setAdminToken).not.toHaveBeenCalled();
  });

  it("affiche un message d'erreur générique pour un rejet sans message", async () => {
    mocks.login.mockRejectedValue('panne brute');
    const user = userEvent.setup();
    renderLogin('/ci/admin/login');

    await submitCredentials(user, 'admin@linkhoo.ci', 'secret-123');

    expect(await screen.findByText('Erreur de connexion')).toBeInTheDocument();
  });

  it("affiche l'état « Connexion... » et désactive le bouton pendant la requête", async () => {
    let resolveLogin: (value: { token: string }) => void = () => {};
    mocks.login.mockImplementation(
      () =>
        new Promise<{ token: string }>((resolve) => {
          resolveLogin = resolve;
        }),
    );

    const user = userEvent.setup();
    renderLogin('/ci/admin/login');

    await user.type(screen.getByLabelText('Email'), 'admin@linkhoo.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret-123');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    const busy = await screen.findByRole('button', { name: /Connexion/ });
    expect(busy).toBeDisabled();
    expect(screen.queryByText('Tableau de bord admin')).not.toBeInTheDocument();

    resolveLogin({ token: 'jwt-admin' });
    expect(await screen.findByText('Tableau de bord admin')).toBeInTheDocument();
  });

  it("efface l'erreur affichée dès la nouvelle soumission", async () => {
    mocks.login.mockRejectedValueOnce(new Error('Identifiants invalides'));
    const user = userEvent.setup();
    renderLogin('/ci/admin/login');

    await submitCredentials(user, 'admin@linkhoo.ci', 'secret-123');
    expect(await screen.findByText('Identifiants invalides')).toBeInTheDocument();

    mocks.login.mockResolvedValue({ token: 'jwt-admin' });
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(screen.queryByText('Identifiants invalides')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Tableau de bord admin')).toBeInTheDocument();
    expect(mocks.login).toHaveBeenCalledTimes(2);
  });
});
