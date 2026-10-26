import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminRouteGuard from './AdminRouteGuard';
import type { AdminData } from '../lib/adminApi';

const mocks = vi.hoisted(() => {
  class AdminUnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AdminUnauthorizedError';
    }
  }
  return {
    getAdminToken: vi.fn<() => string | null>(),
    getMe: vi.fn<() => Promise<AdminData>>(),
    AdminUnauthorizedError,
  };
});

vi.mock('../lib/adminApi', () => ({
  getAdminToken: mocks.getAdminToken,
  apiAdmin: { getMe: mocks.getMe },
  AdminUnauthorizedError: mocks.AdminUnauthorizedError,
  ADMIN_UNAUTHORIZED_EVENT: 'admin:unauthorized',
}));

const admin: AdminData = {
  id: 'admin-1',
  email: 'admin@ilehya.ci',
  nom: 'Koffi',
  prenom: 'Aya',
};

function renderAdmin(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/:market/admin/login" element={<div>Connexion admin</div>} />
        <Route
          path="/:market/admin"
          element={
            <AdminRouteGuard>
              <div>Tableau de bord admin</div>
            </AdminRouteGuard>
          }
        />
        <Route path="/admin/login" element={<div>Connexion admin racine</div>} />
        <Route
          path="/admin"
          element={
            <AdminRouteGuard>
              <div>Tableau de bord racine</div>
            </AdminRouteGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminToken.mockReturnValue(null);
  // Par défaut : pas de session valide (401) → redirection vers le login.
  mocks.getMe.mockRejectedValue(new mocks.AdminUnauthorizedError('Session expirée'));
});

afterEach(() => {
  cleanup();
});

describe('AdminRouteGuard', () => {
  it("interroge /me puis redirige vers /ci/admin/login sans session (401)", async () => {
    renderAdmin('/ci/admin');

    expect(await screen.findByText('Connexion admin')).toBeInTheDocument();
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
  });

  it('affiche le chargement puis les children quand getMe résout', async () => {
    let resolveMe: (value: AdminData) => void = () => {};
    mocks.getMe.mockImplementation(
      () =>
        new Promise<AdminData>((resolve) => {
          resolveMe = resolve;
        }),
    );

    renderAdmin('/ci/admin');

    expect(screen.getByText('Chargement...')).toBeInTheDocument();

    await act(async () => {
      resolveMe(admin);
    });

    expect(await screen.findByText('Tableau de bord admin')).toBeInTheDocument();
  });

  it('redirige vers /ci/admin/login quand getMe rejette en 401', async () => {
    renderAdmin('/ci/admin');

    expect(await screen.findByText('Connexion admin')).toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord admin')).not.toBeInTheDocument();
  });

  it('affiche un retry (pas de déconnexion) quand getMe échoue sur un réseau coupé', async () => {
    mocks.getMe.mockRejectedValue(new Error('Délai dépassé'));

    renderAdmin('/ci/admin');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.queryByText('Connexion admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord admin')).not.toBeInTheDocument();
  });

  it('détecte le marché bj dans le chemin', async () => {
    mocks.getAdminToken.mockReturnValue(null);

    renderAdmin('/bj/admin');

    expect(await screen.findByText('Connexion admin')).toBeInTheDocument();
  });

  it("tombe sur /admin/login quand le chemin n'a pas de marché", async () => {
    mocks.getAdminToken.mockReturnValue(null);

    renderAdmin('/admin');

    expect(await screen.findByText('Connexion admin racine')).toBeInTheDocument();
  });

  it("rend les children à la racine quand l'admin est authentifié", async () => {
    mocks.getAdminToken.mockReturnValue('jwt-admin');
    mocks.getMe.mockResolvedValue(admin);

    renderAdmin('/admin');

    expect(await screen.findByText('Tableau de bord racine')).toBeInTheDocument();
  });
});
