import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import DashboardPage from './DashboardPage';
import type { Room } from '../../data/rooms';
import type { Category } from '../../data/categories';
import type { GerantData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  userId: 'user_clerk_1' as string | null,
  fetchMyRooms: vi.fn<() => Promise<Room[]>>(),
  fetchCategoriesByMarket: vi.fn<(market: string) => Promise<Category[]>>(),
  getMe: vi.fn<() => Promise<GerantData>>(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: mocks.userId }),
}));

vi.mock('../../data/rooms', () => ({
  fetchMyRooms: mocks.fetchMyRooms,
}));

vi.mock('../../data/categories', () => ({
  fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
}));

vi.mock('../../lib/api', () => ({
  apiGerants: { getMe: mocks.getMe },
}));

function makeRoom(index: number, overrides: Partial<Room> = {}): Room {
  return {
    id: `room-${index}`,
    title: `Chambre ${index}`,
    subtitle: `Sous-titre ${index}`,
    info: '2 lits',
    price: '9 000',
    priceNum: 9000,
    priceUnit: '/ nuit',
    img: `/images/room-${index}.jpg`,
    alt: `Chambre ${index}`,
    images: [`/images/room-${index}.jpg`],
    description: 'Confortable',
    capacity: '2 personnes',
    category: 'ci-chambres-premium',
    market: 'CI',
    pays: 'Côte d’Ivoire',
    ville: index % 2 === 0 ? 'Cotonou' : 'Abidjan',
    quartier: 'Centre',
    chambres: 1,
    douches: 1,
    disponible: index % 2 === 1,
    dateDispo: '2026-10-01',
    conditions: 'Annulation gratuite',
    isPopular: false,
    ...overrides,
  };
}

const categories: Category[] = [
  {
    id: 'ci-chambres-premium',
    title: 'Chambres premium',
    img: '/images/1.jpg',
    alt: 'premium',
    market: 'CI',
  },
  {
    id: 'ci-hotels',
    title: 'Hôtels',
    img: '/images/2.jpg',
    alt: 'hôtels',
    market: 'CI',
  },
];

function makeGerant(overrides: Partial<GerantData> = {}): GerantData {
  return {
    id: 'gerant-1',
    clerk_user_id: 'clerk_1',
    email: 'awa@ilehya.ci',
    nom: 'Kouassi',
    prenom: 'Awa',
    phone: '+225 07 00 00 00',
    market: 'CI',
    is_verified: false,
    verified_at: null,
    verification_requested_at: null,
    verification_status: 'none',
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

function renderDashboard(entry = '/ci/gerant') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <DashboardPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'user_clerk_1';
  mocks.fetchMyRooms.mockResolvedValue([makeRoom(1)]);
  mocks.fetchCategoriesByMarket.mockResolvedValue(categories);
  mocks.getMe.mockResolvedValue(makeGerant());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DashboardPage', () => {
  it("affiche l'état de chargement avant les données", () => {
    mocks.fetchMyRooms.mockImplementation(() => new Promise<Room[]>(() => {}));

    renderDashboard();

    expect(screen.getByRole('heading', { level: 1, name: 'Aperçu' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText('Actions rapides')).not.toBeInTheDocument();
  });

  it("affiche l'erreur et un bouton Réessayer quand le chargement échoue", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.fetchMyRooms.mockRejectedValue(new Error('réseau coupé'));

    renderDashboard();

    expect(
      await screen.findByText('Impossible de charger les données du tableau de bord.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('recharge les données au clic sur Réessayer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.fetchMyRooms.mockRejectedValueOnce(new Error('réseau coupé'));
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText('Impossible de charger les données du tableau de bord.');

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Actions rapides')).toBeInTheDocument();
    expect(mocks.fetchMyRooms).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText('Impossible de charger les données du tableau de bord.'),
    ).not.toBeInTheDocument();
  });

  it("présente la vue d'ensemble avec le marché courant et les KPI", async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom(1),
      makeRoom(2),
      makeRoom(3),
    ]);

    renderDashboard();

    expect(
      await screen.findByText(
        "Vue d'ensemble de votre activité sur le marché CI.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Chambres enregistrées')).toBeInTheDocument();
    expect(document.querySelector('.hero-kpi__value')).toHaveTextContent('3');
    expect(document.querySelector('.hero-kpi__change')).toHaveTextContent(
      '2 disponibles',
    );
    const minis = document.querySelectorAll('.hero-mini__value');
    expect(minis[0]).toHaveTextContent('2');
    expect(minis[1]).toHaveTextContent('2');
    expect(screen.getByText('Disponibles')).toBeInTheDocument();
    expect(screen.getByText('Catégories')).toBeInTheDocument();
  });

  it('charge les catégories du marché BJ pour une URL /bj', async () => {
    renderDashboard('/bj/gerant');

    expect(await screen.findByText('Actions rapides')).toBeInTheDocument();
    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('BJ');
    expect(
      screen.getByText("Vue d'ensemble de votre activité sur le marché BJ."),
    ).toBeInTheDocument();
  });

  it('invite à devenir gérant vérifié quand aucun profil ne répond', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getMe.mockRejectedValue(new Error('404'));

    renderDashboard();

    expect(await screen.findByText('Devenez gérant vérifié')).toBeInTheDocument();
    const lien = screen.getByRole('link', { name: 'Demander la vérification' });
    expect(lien).toHaveAttribute('href', '/ci/gerant/verification');
    expect(screen.queryByText('Compte vérifié')).not.toBeInTheDocument();
  });

  it('annonce une demande de vérification en attente sans lien', async () => {
    mocks.getMe.mockResolvedValue(makeGerant({ verification_status: 'pending' }));

    renderDashboard();

    expect(await screen.findByText('Demande en cours')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Demander la vérification' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Resoumettre' }),
    ).not.toBeInTheDocument();
  });

  it('annonce une demande en cours d’examen (under_review)', async () => {
    mocks.getMe.mockResolvedValue(
      makeGerant({ verification_status: 'under_review' }),
    );

    renderDashboard();

    expect(await screen.findByText('Demande en cours')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Votre demande de vérification est en cours de traitement. L'admin la traitera bientôt.",
      ),
    ).toBeInTheDocument();
  });

  it('affiche le motif de rejet et propose de resoumettre', async () => {
    mocks.getMe.mockResolvedValue(
      makeGerant({
        verification_status: 'rejected',
        verification_rejection_reason: 'Photo illisible',
      }),
    );

    renderDashboard();

    expect(await screen.findByText('Demande rejetée')).toBeInTheDocument();
    expect(screen.getByText('Photo illisible')).toBeInTheDocument();
    const lien = screen.getByRole('link', { name: 'Resoumettre' });
    expect(lien).toHaveAttribute('href', '/ci/gerant/verification');
  });

  it('tombe sur un texte par défaut quand le rejet est sans motif', async () => {
    mocks.getMe.mockResolvedValue(
      makeGerant({ verification_status: 'rejected' }),
    );

    renderDashboard();

    expect(
      await screen.findByText(
        'Votre demande a été rejetée. Vous pouvez soumettre de nouveaux documents.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Resoumettre' })).toBeInTheDocument();
  });

  it('affiche le compte vérifié avec sa date et masque l’appel à l’action', async () => {
    const verifiedAt = '2026-01-05T12:00:00.000Z';
    mocks.getMe.mockResolvedValue(
      makeGerant({
        is_verified: true,
        verified_at: verifiedAt,
        verification_status: 'approved',
      }),
    );

    renderDashboard();

    expect(await screen.findByText('Compte vérifié')).toBeInTheDocument();
    expect(
      screen.getByText(
        `Votre compte est vérifié depuis le ${new Date(verifiedAt).toLocaleDateString('fr-FR')}.`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Devenez gérant vérifié')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Demander la vérification' }),
    ).not.toBeInTheDocument();
  });

  it('propose les actions rapides de base avec leurs destinations', async () => {
    renderDashboard();

    expect(await screen.findByText('Actions rapides')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ajouter chambre' }),
    ).toHaveAttribute('href', '/ci/gerant/chambres/ajouter');
    expect(
      screen.getByRole('link', { name: 'Gérer les chambres' }),
    ).toHaveAttribute('href', '/ci/gerant/chambres');
    expect(screen.getByRole('link', { name: 'Voir le site' })).toHaveAttribute(
      'href',
      '/ci',
    );
    expect(
      screen.queryByRole('link', { name: 'Réservations' }),
    ).not.toBeInTheDocument();
  });

  it('ouvre les réservations pour un gérant vérifié et premium actif', async () => {
    mocks.getMe.mockResolvedValue(
      makeGerant({
        is_verified: true,
        verification_status: 'approved',
        is_premium: true,
        premium_expires_at: '2027-06-01T00:00:00.000Z',
      }),
    );

    renderDashboard();

    const lien = await screen.findByRole('link', { name: 'Réservations' });
    expect(lien).toHaveAttribute('href', '/ci/gerant/reservations');
  });

  it('masque les réservations quand le premium est expiré', async () => {
    mocks.getMe.mockResolvedValue(
      makeGerant({
        is_verified: true,
        verification_status: 'approved',
        is_premium: true,
        premium_expires_at: '2025-06-01T00:00:00.000Z',
      }),
    );

    renderDashboard();

    expect(await screen.findByText('Actions rapides')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Réservations' }),
    ).not.toBeInTheDocument();
  });

  it("affiche l'état vide des chambres récentes", async () => {
    mocks.fetchMyRooms.mockResolvedValue([]);

    renderDashboard();

    expect(
      await screen.findByText('Aucune chambre enregistrée.'),
    ).toBeInTheDocument();
    expect(document.querySelector('.admin-pagination')).toBeNull();
    expect(document.querySelector('.hero-kpi__value')).toHaveTextContent('0');
  });

  it('affiche les badges de disponibilité de chaque chambre', async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      makeRoom(1, { disponible: true }),
      makeRoom(2, { disponible: false }),
    ]);

    renderDashboard();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Occupée')).toBeInTheDocument();
    expect(screen.getByText('Abidjan')).toBeInTheDocument();
    expect(screen.getByText('Cotonou')).toBeInTheDocument();
  });

  it("aligne chaque cellule sur son en-tête dans « Chambres récentes »", async () => {
    mocks.fetchMyRooms.mockResolvedValue([makeRoom(1, { disponible: false })]);

    renderDashboard();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    const headers = Array.from(
      document.querySelectorAll('.admin-table thead th'),
      (th) => th.textContent,
    );
    expect(headers).toEqual(['Image', 'Titre', 'Ville', 'Catégorie', 'Prix', 'Statut']);

    const cells = document.querySelectorAll('.admin-table tbody tr td');
    expect(cells).toHaveLength(headers.length);
    expect(cells[1]).toHaveTextContent('Chambre 1');
    expect(cells[2]).toHaveTextContent('Abidjan');
    expect(cells[3]).toHaveTextContent('Chambres premium');
    expect(cells[4]).toHaveTextContent('9 000 FCFA');
    expect(cells[5]).toHaveTextContent('Occupée');
  });

  it('pagine les huit chambres récentes sur deux pages', async () => {
    mocks.fetchMyRooms.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => makeRoom(i + 1)),
    );
    const user = userEvent.setup();
    renderDashboard();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Chambre 1')).toBeInTheDocument();
    expect(screen.getByText('Chambre 5')).toBeInTheDocument();
    expect(screen.queryByText('Chambre 6')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '← Préc' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Suiv →' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(screen.getByText('Chambre 6')).toBeInTheDocument();
    expect(screen.getByText('Chambre 8')).toBeInTheDocument();
    expect(screen.queryByText('Chambre 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suiv →' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '← Préc' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '← Préc' }));

    expect(screen.getByText('Chambre 1')).toBeInTheDocument();
    expect(screen.queryByText('Chambre 6')).not.toBeInTheDocument();
  });

  it('ne pagine pas quand cinq chambres ou moins sont récentes', async () => {
    mocks.fetchMyRooms.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeRoom(i + 1)),
    );

    renderDashboard();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(document.querySelector('.admin-pagination')).toBeNull();
  });

  it('compte toutes les chambres dans le KPI même au-delà des huit récentes', async () => {
    mocks.fetchMyRooms.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeRoom(i + 1)),
    );

    renderDashboard();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(document.querySelector('.hero-kpi__value')).toHaveTextContent('10');
    // Seules les 8 chambres les plus récentes sont paginées (5 sur la page 1).
    expect(screen.getByText('Chambre 5')).toBeInTheDocument();
    expect(screen.queryByText('Chambre 6')).not.toBeInTheDocument();
    expect(screen.queryByText('Chambre 9')).not.toBeInTheDocument();
    expect(screen.queryByText('Chambre 10')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suiv →' })).toBeEnabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '2' }));

    expect(screen.getByText('Chambre 8')).toBeInTheDocument();
    expect(screen.queryByText('Chambre 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Chambre 9')).not.toBeInTheDocument();
    expect(screen.queryByText('Chambre 10')).not.toBeInTheDocument();
  });

  it("n'appelle pas l'API gérant sans userId Clerk", async () => {
    mocks.userId = null;

    renderDashboard();

    expect(await screen.findByText('Actions rapides')).toBeInTheDocument();
    expect(mocks.getMe).not.toHaveBeenCalled();
    expect(await screen.findByText('Devenez gérant vérifié')).toBeInTheDocument();
  });
});
