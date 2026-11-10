import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboardPage, { buildRoomChartData } from './AdminDashboardPage';
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
      byMarket: { CI: 27, BJ: 15, SN: 4, TG: 0, CM: 0, BF: 0, CG: 0, GA: 0, GN: 0, ML: 0, NE: 0, CD: 0 },
      newThisMonth: 4,
    },
    rooms: {
      total: 88,
      available: 61,
      unavailable: 27,
      byMarket: {
        CI: { total: 40, available: 30, unavailable: 10 },
        BJ: { total: 20, available: 14, unavailable: 6 },
        SN: { total: 8, available: 5, unavailable: 3 },
      },
    },
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

    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText('Gérants')).not.toBeInTheDocument();
  });

  it('affiche le titre et la vue d’ensemble une fois les stats chargées', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    expect(
      await screen.findByText("Vue d'ensemble de la plateforme Linkhoo — tous les marchés"),
    ).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('affiche les KPI gérants, chambres et réservations', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    expect((await screen.findAllByText('Gérants')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30 vérifiés').length).toBeGreaterThan(0);

    expect(screen.getByRole('heading', { level: 2, name: 'Chambres par marché' })).toBeInTheDocument();
    expect(screen.getByText('88 chambres au total, tous marchés confondus')).toBeInTheDocument();
    expect(screen.getByText('61 disponibles · 27 occupées')).toBeInTheDocument();

    expect(screen.getAllByText('Réservations').length).toBeGreaterThan(0);
    expect(screen.getByText('9 en attente · 100 confirmées')).toBeInTheDocument();
  });

  it('affiche le graphique des chambres par marché et les vérifications en attente', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Chambres par marché' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Graphique des chambres disponibles et occupées pour chaque marché',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Vérifications en attente')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Demandes à traiter')).toBeInTheDocument();
  });

  it('prépare une série par marché pour le graphique, zéros inclus', () => {
    const data = buildRoomChartData(fullStats());

    expect(data.map((entry) => entry.code)).toEqual([
      'CI', 'BJ', 'SN', 'TG', 'CM', 'BF', 'CG', 'GA', 'GN', 'ML', 'NE', 'CD',
    ]);
    expect(data[0]).toEqual({ code: 'CI', disponibles: 30, occupees: 10 });
    expect(data[1]).toEqual({ code: 'BJ', disponibles: 14, occupees: 6 });

    const empty = buildRoomChartData(null);
    expect(empty).toHaveLength(12);
    expect(empty.every((entry) => entry.disponibles === 0 && entry.occupees === 0)).toBe(true);
  });

  it('formate le revenu total en FCFA avec la locale fr-FR', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    expect(await screen.findByText('Revenu total')).toBeInTheDocument();
    expect(screen.getByText(`${frNumber(1250000)} FCFA`)).toBeInTheDocument();
    expect(screen.getByText('Réservations confirmées')).toBeInTheDocument();
  });

  it('affiche les gérants premium et les créations du mois', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    expect(await screen.findByText('Gérants premium')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('4 nouveaux ce mois')).toBeInTheDocument();
  });

  it('affiche des zéros quand une branche de statistiques est absente', async () => {
    mocks.getStats.mockResolvedValue({} as AdminStats);

    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    expect((await screen.findAllByText('Gérants')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('0 vérifiés').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0 disponibles · 0 occupées').length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${frNumber(0)} FCFA`).length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText('0 nouveaux ce mois')).toBeInTheDocument();
  });

  it("affiche l'erreur avec un bouton Réessayer quand l'API échoue", async () => {
    mocks.getStats.mockRejectedValue(new Error('réseau coupé'));

    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    expect(
      await screen.findByText('Impossible de charger les statistiques.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('recharge les statistiques au clic sur Réessayer puis masque l’erreur', async () => {
    mocks.getStats.mockRejectedValueOnce(new Error('réseau coupé'));
    const user = userEvent.setup();

    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);
    expect(
      await screen.findByText('Impossible de charger les statistiques.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect((await screen.findAllByText('Gérants')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Impossible de charger les statistiques.')).not.toBeInTheDocument();
    expect(mocks.getStats).toHaveBeenCalledTimes(2);
  });

  it("affiche le chargement pendant la recharge après une erreur", async () => {
    mocks.getStats.mockRejectedValueOnce(new Error('réseau coupé'));
    const user = userEvent.setup();

    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);
    expect(
      await screen.findByText('Impossible de charger les statistiques.'),
    ).toBeInTheDocument();

    mocks.getStats.mockImplementation(() => new Promise<AdminStats>(() => {}));
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText('Impossible de charger les statistiques.')).not.toBeInTheDocument();
  });

  it('demande les statistiques exactement une fois au montage', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    await waitFor(() => expect(mocks.getStats).toHaveBeenCalledTimes(1));
    expect(mocks.getStats).toHaveBeenCalledWith();
  });
});
