import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import DashboardPage from './DashboardPage';
import type { Room } from '../../data/rooms';
import type { Category } from '../../data/categories';
import type { GerantData } from '../../lib/api';
import type { Reservation } from '../../lib/reservations';


const mocks = vi.hoisted(() => ({
  fetchMyRooms: vi.fn<() => Promise<Room[]>>(),
  fetchCategoriesByMarket: vi.fn<(market: string) => Promise<Category[]>>(),
  getReservations: vi.fn<() => Promise<Reservation[]>>(),
  getMe: vi.fn<() => Promise<GerantData>>(),
  gerantUnread: vi.fn<() => Promise<{ count: number }>>(),
  getBalance: vi.fn<() => Promise<unknown>>(),
  getNotifications: vi.fn<() => Promise<unknown[]>>(),
  markAsRead: vi.fn<(id: string) => Promise<void>>(),
  markAllAsRead: vi.fn<() => Promise<void>>(),
  addClientNotification: vi.fn<(data: Record<string, unknown>) => Promise<void>>(),
}));

vi.mock('../../data/rooms', () => ({
  fetchMyRooms: mocks.fetchMyRooms,
}));

vi.mock('../../data/categories', () => ({
  fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
}));

vi.mock('../../lib/api', () => ({
  apiReservations: { gerantPending: vi.fn(async () => ({ count: 0 })) },
  apiGerants: { getMe: mocks.getMe },
  apiMessages: { gerantUnread: mocks.gerantUnread },
  apiPayouts: { getBalance: mocks.getBalance },
}));

vi.mock('../../lib/reservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/reservations')>();
  return {
    ...actual,
    getReservations: mocks.getReservations,
  };
});

vi.mock('../../lib/notifications', () => ({
  getNotifications: mocks.getNotifications,
  markAsRead: mocks.markAsRead,
  markAllAsRead: mocks.markAllAsRead,
  addClientNotification: mocks.addClientNotification,
}));

const gerant: GerantData = {
  id: 'gerant-1',
  clerk_user_id: 'clerk_1',
  email: 'koffi@ilehya.ci',
  nom: 'Mensah',
  prenom: 'Koffi',
  phone: null,
  market: 'CI',
  is_verified: true,
  verified_at: '2026-01-05T12:00:00.000Z',
  verification_requested_at: null,
  verification_status: 'approved',
  verification_rejection_reason: null,
  verification_submitted_at: null,
  verification_reviewed_at: null,
  property_maps_url: null,
  property_lat: null,
  property_lng: null,
  is_premium: true,
  premium_expires_at: '2027-06-01T00:00:00.000Z',
  created_at: '2025-11-01T09:00:00.000Z',
};

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    title: 'Appartement lumineux avec vue sur la lagune',
    subtitle: 'Vue sur la lagune',
    info: '',
    price: '75000',
    priceNum: 75000,
    priceUnit: '/ nuit',
    img: '',
    alt: '',
    images: [],
    description: '',
    category: 'ci-appartements',
    market: 'CI',
    pays: "Côte d'Ivoire",
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 2,
    douches: 1,
    disponible: true,
    dateDispo: '',
    conditions: '',
    isPopular: true,
    ...overrides,
  };
}

const rooms: Room[] = [
  makeRoom(),
  makeRoom({
    id: 'room-2',
    title: 'Villa avec piscine',
    category: 'ci-chambres-premium',
    disponible: false,
  }),
];

const categories: Category[] = [
  {
    id: 'ci-appartements',
    title: 'Appartements',
    img: '/a.jpg',
    alt: 'Appartements',
    market: 'CI',
  },
  {
    id: 'ci-chambres-premium',
    title: 'Chambres premium',
    img: '/p.jpg',
    alt: 'Chambres premium',
    market: 'CI',
  },
];

const reservation: Reservation = {
  id: 'res-1',
  clientName: 'Aïcha Diallo',
  clientEmail: 'aicha@ilehya.ci',
  clientPhone: '+225 01 01 01 01',
  roomId: 'room-1',
  roomTitle: 'Appartement lumineux avec vue sur la lagune',
  dateDebut: '2026-10-05',
  dateFin: '2026-10-08',
  dureeNombre: 3,
  dureeUnite: 'nuit',
  montant: 225000,
  statut: 'en_attente',
  createdAt: '2026-09-20T10:00:00.000Z',
};

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/ci/gerant']}>
      <MarketProvider>
        <DashboardPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMyRooms.mockResolvedValue(rooms);
  mocks.fetchCategoriesByMarket.mockResolvedValue(categories);
  mocks.getReservations.mockResolvedValue([reservation]);
  mocks.getMe.mockResolvedValue(gerant);
  mocks.gerantUnread.mockResolvedValue({ count: 0 });
  mocks.getBalance.mockResolvedValue(undefined);
  mocks.getNotifications.mockResolvedValue([]);
  mocks.markAsRead.mockResolvedValue(undefined);
  mocks.markAllAsRead.mockResolvedValue(undefined);
  mocks.addClientNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('DashboardPage', () => {
  it('affiche immédiatement la page quand les données métier tardent (pas d’écran bloquant)', async () => {
    // Requêtes métier qui ne se terminent jamais : le squelette du tableau de
    // bord doit rester visible et les indicateurs de section prendre le relais.
    mocks.fetchMyRooms.mockReturnValue(new Promise<Room[]>(() => {}));
    mocks.getReservations.mockReturnValue(new Promise<Reservation[]>(() => {}));

    renderDashboard();

    expect(
      await screen.findByRole('heading', { level: 1, name: /Bonjour Koffi/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Chargement de votre activité...')).toBeInTheDocument();
    expect(screen.queryByText('Chargement de votre tableau de bord...')).not.toBeInTheDocument();
  });

  it('affiche le tableau de bord quand le gérant n’a aucune chambre', async () => {
    mocks.fetchMyRooms.mockResolvedValue([]);
    mocks.fetchCategoriesByMarket.mockResolvedValue([]);
    mocks.getReservations.mockResolvedValue([]);

    renderDashboard();

    expect(
      await screen.findByRole('heading', { level: 1, name: /Bonjour Koffi/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Aucune annonce')).toBeInTheDocument();
  });

  it('affiche le tableau de bord avec les données de l’API', async () => {
    renderDashboard();

    expect(document.querySelector('.gerant-maq1')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: /Bonjour Koffi/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Chambres enregistrées')).toBeInTheDocument();
    expect(screen.getByText('Catégories de vos chambres')).toBeInTheDocument();
    expect(screen.getByText('Chambres récentes')).toBeInTheDocument();
    expect(screen.getByText('Actions rapides')).toBeInTheDocument();
    expect(screen.getByText('Appartement lumineux avec vue sur la lagune')).toBeInTheDocument();
    expect(screen.getAllByText('Aïcha Diallo').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: /toutes les chambres/i }),
    ).toHaveAttribute('href', '/ci/gerant/chambres');
    for (const link of screen.getAllByRole('link', {
      name: /ajouter une chambre/i,
    })) {
      expect(link).toHaveAttribute('href', '/ci/gerant/chambres/ajouter');
    }
    expect(screen.getByRole('link', { name: 'Demandes' })).toHaveAttribute(
      'href',
      '/ci/gerant/reservations/demandes',
    );
  });

  it('chaque lien du tableau de bord pointe vers la bonne page gérant', async () => {
    renderDashboard();

    await screen.findByText('Chambres enregistrées');

    // Le contenu du dashboard (hors sidebar) ne doit contenir que les 8
    // destinations gérant : une faute de frappe ou un lien mort casse ce test.
    const main = screen.getByRole('main');
    const hrefs = within(main)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(new Set(hrefs)).toEqual(
      new Set([
        '/ci/gerant/reversements',
        '/ci/gerant/chambres',
        '/ci/gerant/chambres/ajouter',
        '/ci/gerant/reservations/calendrier',
        '/ci/gerant/reservations/demandes',
        '/ci/gerant/messages/boite-reception',
        '/ci/gerant/verification',
        '/ci/gerant/premium',
      ]),
    );
    for (const href of hrefs) {
      expect(href).toMatch(/^\/ci\/gerant(\/|$)/);
    }

    // Libellés uniques : le libellé affiché correspond bien à sa page.
    const uniqueLinks: Array<[RegExp, string]> = [
      [/Solde disponible/, '/ci/gerant/reversements'],
      [/Découvrir le Premium/i, '/ci/gerant/premium'],
      [/Voir mes réservations/i, '/ci/gerant/reservations/calendrier'],
      [/Voir mes messages/i, '/ci/gerant/messages/boite-reception'],
      [/Compte vérifié|Vérifier mon compte/i, '/ci/gerant/verification'],
      [/Ajouter une chambre/i, '/ci/gerant/chambres/ajouter'],
    ];
    for (const [name, href] of uniqueLinks) {
      expect(within(main).getByRole('link', { name })).toHaveAttribute('href', href);
    }

    // « Voir tout / Voir toutes » est répété : on vérifie chaque section.
    const sectionOf = (heading: RegExp) =>
      screen.getByRole('heading', { name: heading }).closest('section') as HTMLElement;

    expect(
      within(sectionOf(/Catégories de vos chambres/)).getByRole('link', { name: /Voir tout/i }),
    ).toHaveAttribute('href', '/ci/gerant/chambres');
    expect(
      within(sectionOf(/Chambres récentes/)).getByRole('link', { name: /Voir toutes/i }),
    ).toHaveAttribute('href', '/ci/gerant/chambres');
    expect(
      within(sectionOf(/Dernières demandes de réservation/)).getByRole('link', {
        name: /Voir tout/i,
      }),
    ).toHaveAttribute('href', '/ci/gerant/reservations/demandes');
  });

  it('continue d\'afficher les chambres quand les réservations sont réservées aux gérants vérifiés', async () => {
    mocks.getReservations.mockRejectedValue(
      Object.assign(new Error('Réservations gérées par l\'administrateur'), { status: 403 }),
    );

    renderDashboard();

    expect(await screen.findByText('Appartement lumineux avec vue sur la lagune')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Les réservations sont visibles uniquement pour les gérants vérifiés.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Impossible de charger vos chambres.')).not.toBeInTheDocument();
  });

  it('affiche le solde disponible renvoyé par l’API', async () => {
    mocks.getBalance.mockResolvedValue({
      currency: 'XOF',
      earned: 950_000,
      available: 912_500,
      pending: 34_000,
      paid: 3_500,
      last_payout_at: null,
      commission_percent: 10,
      commission_tier: 'verified',
    });

    renderDashboard();

    const card = await screen.findByRole('link', { name: /Solde disponible/ });
    expect(within(card).getByText(/912 500/)).toBeInTheDocument();
    expect(within(card).getByText('XOF')).toBeInTheDocument();
    expect(within(card).getByText(/En cours : 34 000/)).toBeInTheDocument();
    expect(within(card).getByText(/Déjà versé :\s*3 500/)).toBeInTheDocument();
  });

  it('signale un solde indisponible quand l’API échoue, sans afficher 0', async () => {
    mocks.getBalance.mockRejectedValue(new Error('réseau indisponible'));

    renderDashboard();

    const card = await screen.findByRole('link', { name: /Solde disponible/ });
    expect(await within(card).findByText('—')).toBeInTheDocument();
    expect(
      within(card).getByText('Solde momentanément indisponible — voir Reversements.'),
    ).toBeInTheDocument();
    expect(within(card).queryByText('XOF')).not.toBeInTheDocument();
    expect(within(card).queryByText(/^0/)).not.toBeInTheDocument();
  });

  it('ouvre le panneau des notifications depuis la cloche', async () => {
    mocks.getNotifications.mockResolvedValue([
      {
        id: 'notif-1',
        type: 'reservation',
        roomTitle: 'Studio Ayida',
        roomId: 'room-2',
        clientName: 'Aïcha Diallo',
        clientEmail: 'aicha@ilehya.ci',
        clientPhone: '+225 01 01 01 01',
        message: 'Nouvelle demande de réservation du 01/03/2026 au 05/03/2026.',
        date: new Date().toISOString(),
        read: false,
        reservationId: 'res-1',
      },
    ]);

    renderDashboard();

    const bell = await screen.findByRole('button', { name: 'Notifications' });
    await waitFor(() => expect(within(bell).getByText('1')).toBeInTheDocument());

    fireEvent.click(bell);

    expect(await screen.findByText(/Nouvelle demande de réservation/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Nouvelle demande de réservation/ }));
    expect(mocks.markAsRead).toHaveBeenCalledWith('notif-1');
  });

  it('marque toutes les notifications comme lues depuis le panneau', async () => {
    mocks.getNotifications.mockResolvedValue([
      {
        id: 'notif-1',
        type: 'reservation_cancelled',
        roomTitle: 'Villa avec piscine',
        roomId: 'room-2',
        clientName: 'Aïcha Diallo',
        clientEmail: 'aicha@ilehya.ci',
        clientPhone: '+225 01 01 01 01',
        message: 'Réservation annulée',
        date: new Date().toISOString(),
        read: false,
      },
    ]);

    renderDashboard();

    const bell = await screen.findByRole('button', { name: 'Notifications' });
    await waitFor(() => expect(within(bell).getByText('1')).toBeInTheDocument());
    fireEvent.click(bell);
    fireEvent.click(await screen.findByRole('button', { name: 'Tout marquer lu' }));

    expect(mocks.markAllAsRead).toHaveBeenCalledTimes(1);
  });
});
