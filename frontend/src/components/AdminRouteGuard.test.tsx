import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminRouteGuard from './AdminRouteGuard';
import type { AdminData } from '../lib/adminApi';

const mocks = vi.hoisted(() => ({
  getAdminToken: vi.fn<() => string | null>(),
  getMe: vi.fn<() => Promise<AdminData>>(),
}));

vi.mock('../lib/adminApi', () => ({
  getAdminToken: mocks.getAdminToken,
  apiAdmin: { getMe: mocks.getMe },
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
});

afterEach(() => {
  cleanup();
});

describe('AdminRouteGuard', () => {
  it("n'appelle pas getMe sans token et redirige vers /ci/admin/login", async () => {
    mocks.getAdminToken.mockReturnValue(null);

    renderAdmin('/ci/admin');

    expect(await screen.findByText('Connexion admin')).toBeInTheDocument();
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it('affiche le chargement puis les children quand getMe résout', async () => {
    mocks.getAdminToken.mockReturnValue('jwt-admin');
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

  it('redirige vers /ci/admin/login quand getMe rejette', async () => {
    mocks.getAdminToken.mockReturnValue('jwt-admin');
    mocks.getMe.mockRejectedValue(new Error('Token invalide'));

    renderAdmin('/ci/admin');

    expect(await screen.findByText('Connexion admin')).toBeInTheDocument();
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
