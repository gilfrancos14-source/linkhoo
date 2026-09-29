import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminDashboardPage from './AdminDashboardPage';
import type { AdminStats } from '../../lib/adminApi';

const mocks = vi.hoisted(() => ({
  getStats: vi.fn<() => Promise<AdminStats>>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: { getStats: mocks.getStats },
}));

/**
 * `toLocaleString('fr-FR')` sépare les milliers par une espace fine insécable (U+202F) que le
 * normaliseur par défaut de Testing Library (`/\s+/g`) remplace par une espace ASCII dans le
 * texte de l'DOM : l'attendu doit être aligné sur cette forme normalisée.
 */
const frNumber = (n: number) => n.toLocaleString('fr-FR').replace(/\s+/g, ' ');

function fullStats(): AdminStats {
  return {
    gerants: {
      total: 42,
      verified: 30,
      pendingVerifications: 7,
      premium: 5,
      byMarket: { CI: 27, BJ: 15 },
      newThisMonth: 4,
    },
    rooms: { total: 88, available: 61, unavailable: 27 },
    reservations: {
      total: 120,
      pending: 9,
      confirmed: 100,
      cancelled: 11,
      totalRevenue: 1250000,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStats.mockResolvedValue(fullStats());
});

afterEach(() => {
  cleanup();
});

describe('AdminDashboardPage', () => {
  it("affiche l'état de chargement tant que les statistiques ne sont pas résolues", () => {
    mocks.getStats.mockImplementation(() => new Promise<AdminStats>(() => {}));

    render(<AdminDashboardPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText('Gérants')).not.toBeInTheDocument();
  });

  it('affiche le titre et la vue d’ensemble une fois les stats chargées', async () => {
    render(<AdminDashboardPage />);

    expect(
      await screen.findByText("Vue d'ensemble de la plateforme Linkhoo — tous les marchés"),
    ).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('affiche les KPI gérants, chambres et réservations', async () => {
    render(<AdminDashboardPage />);

    expect(await screen.findByText('Gérants')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('30 vérifiés')).toBeInTheDocument();

    expect(screen.getByText('Chambres')).toBeInTheDocument();
    expect(screen.getByText('61 disponibles · 27 occupées')).toBeInTheDocument();

    expect(screen.getByText('Réservations')).toBeInTheDocument();
    expect(screen.getByText('9 en attente · 100 confirmées')).toBeInTheDocument();
  });

  it('affiche la répartition des gérants par marché et les vérifications en attente', async () => {
    render(<AdminDashboardPage />);

    expect(await screen.findByText('CI')).toBeInTheDocument();
    expect(screen.getByText('BJ')).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();

    expect(screen.getByText('Vérifications en attente')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Demandes à traiter')).toBeInTheDocument();
  });

  it('formate le revenu total en FCFA avec la locale fr-FR', async () => {
    render(<AdminDashboardPage />);

    expect(await screen.findByText('Revenu total')).toBeInTheDocument();
    expect(screen.getByText(`${frNumber(1250000)} FCFA`)).toBeInTheDocument();
    expect(screen.getByText('Réservations confirmées')).toBeInTheDocument();
  });

  it('affiche les gérants premium et les créations du mois', async () => {
    render(<AdminDashboardPage />);

    expect(await screen.findByText('Gérants premium')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('4 nouveaux ce mois')).toBeInTheDocument();
  });

  it('affiche des zéros quand une branche de statistiques est absente', async () => {
    mocks.getStats.mockResolvedValue({} as AdminStats);

    render(<AdminDashboardPage />);

    expect(await screen.findByText('Gérants')).toBeInTheDocument();
    expect(screen.getByText('0 vérifiés')).toBeInTheDocument();
    expect(screen.getByText('0 disponibles · 0 occupées')).toBeInTheDocument();
    expect(screen.getByText(`${frNumber(0)} FCFA`)).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText('0 nouveaux ce mois')).toBeInTheDocument();
  });

  it("affiche l'erreur avec un bouton Réessayer quand l'API échoue", async () => {
    mocks.getStats.mockRejectedValue(new Error('réseau coupé'));

    render(<AdminDashboardPage />);

    expect(
      await screen.findByText('Impossible de charger les statistiques.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('recharge les statistiques au clic sur Réessayer puis masque l’erreur', async () => {
    mocks.getStats.mockRejectedValueOnce(new Error('réseau coupé'));
    const user = userEvent.setup();

    render(<AdminDashboardPage />);
    expect(
      await screen.findByText('Impossible de charger les statistiques.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Gérants')).toBeInTheDocument();
    expect(screen.queryByText('Impossible de charger les statistiques.')).not.toBeInTheDocument();
    expect(mocks.getStats).toHaveBeenCalledTimes(2);
  });

  it("affiche le chargement pendant la recharge après une erreur", async () => {
    mocks.getStats.mockRejectedValueOnce(new Error('réseau coupé'));
    const user = userEvent.setup();

    render(<AdminDashboardPage />);
    expect(
      await screen.findByText('Impossible de charger les statistiques.'),
    ).toBeInTheDocument();

    mocks.getStats.mockImplementation(() => new Promise<AdminStats>(() => {}));
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText('Impossible de charger les statistiques.')).not.toBeInTheDocument();
  });

  it('demande les statistiques exactement une fois au montage', async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => expect(mocks.getStats).toHaveBeenCalledTimes(1));
    expect(mocks.getStats).toHaveBeenCalledWith();
  });
});
