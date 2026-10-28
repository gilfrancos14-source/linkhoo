import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
}));

vi.mock('../../data/rooms', () => ({
  fetchMyRooms: mocks.fetchMyRooms,
}));

vi.mock('../../data/categories', () => ({
  fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
}));

vi.mock('../../lib/api', () => ({
  apiGerants: { getMe: mocks.getMe },
  apiMessages: { gerantUnread: mocks.gerantUnread },
}));

vi.mock('../../lib/reservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/reservations')>();
  return {
    ...actual,
    getReservations: mocks.getReservations,
  };
});

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
});

afterEach(() => {
  cleanup();
});

describe('DashboardPage', () => {
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
});
