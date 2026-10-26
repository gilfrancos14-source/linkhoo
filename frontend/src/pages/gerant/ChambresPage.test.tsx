import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import ChambresPage from './ChambresPage';
import type { Room } from '../../data/rooms';
import type { Category } from '../../data/categories';
import type { GerantData } from '../../lib/api';
import type { Reservation } from '../../lib/reservations';

const mocks = vi.hoisted(() => ({
  fetchMyRooms: vi.fn<() => Promise<Room[]>>(),
  fetchCategoriesByMarket: vi.fn<(market: string) => Promise<Category[]>>(),
  getMe: vi.fn<() => Promise<GerantData>>(),
  gerantUnread: vi.fn<() => Promise<{ count: number }>>(),
  getReservations: vi.fn<() => Promise<Reservation[]>>(),
  toggleRoom: vi.fn<(id: string) => Promise<Room>>(),
  updateRoom: vi.fn<(id: string, patch: Partial<Room>) => Promise<Room>>(),
}));

vi.mock('../../data/rooms', () => ({
  fetchMyRooms: mocks.fetchMyRooms,
  toggleRoom: mocks.toggleRoom,
  updateRoom: mocks.updateRoom,
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
    price: '150000',
    priceNum: 150000,
    priceUnit: '/ mois',
    category: 'ci-chambres-premium',
    quartier: 'Marcory',
    disponible: false,
    isPopular: false,
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

function renderPage(entry = '/ci/gerant/chambres') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <ChambresPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMyRooms.mockResolvedValue(rooms);
  mocks.fetchCategoriesByMarket.mockResolvedValue(categories);
  mocks.getMe.mockResolvedValue(gerant);
  mocks.gerantUnread.mockResolvedValue({ count: 0 });
  mocks.getReservations.mockResolvedValue([]);
  mocks.toggleRoom.mockResolvedValue(rooms[0]);
  mocks.updateRoom.mockResolvedValue(rooms[0]);
});

afterEach(() => {
  cleanup();
});

describe('ChambresPage', () => {
  it('affiche les chambres chargées depuis l’API', async () => {
    renderPage();

    expect(document.querySelector('.gerant-maq2')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Mes chambres' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('2 chambres trouvées')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('Aperçu de vos chambres')).toBeInTheDocument();
    expect(screen.getByText('Statut de vérification')).toBeInTheDocument();
  });

  it('pointe les actions vers les routes du gérant', () => {
    renderPage();

    const addLinks = screen.getAllByRole('link', { name: /Ajouter une chambre/ });
    expect(addLinks[0]).toHaveAttribute('href', '/ci/gerant/chambres/ajouter');
    expect(
      screen.getAllByRole('link', { name: 'Toutes les chambres' })[0],
    ).toHaveAttribute('href', '/ci/gerant/chambres');
    expect(screen.getAllByRole('link', { name: 'Aperçu' })[0]).toHaveAttribute(
      'href',
      '/ci/gerant',
    );
    expect(screen.getByRole('link', { name: 'Demandes' })).toHaveAttribute(
      'href',
      '/ci/gerant/reservations/demandes',
    );
  });

  it('affiche les données et les états des chambres de l’API', async () => {
    renderPage();

    expect(
      await screen.findByText('Appartement lumineux avec vue sur la lagune'),
    ).toBeInTheDocument();
    expect(screen.getByText('Villa avec piscine')).toBeInTheDocument();
    expect(screen.getByText('75 000 FCFA / nuit')).toBeInTheDocument();
    expect(screen.getByText('150 000 FCFA / mois')).toBeInTheDocument();

    const statuts = Array.from(
      document.querySelectorAll('.gerant-maq2 .st'),
      (badge) => badge.textContent,
    );
    expect(statuts).toEqual(['Disponible', 'Occupée']);
  });
});
