import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import CalendrierMaq5 from './CalendrierMaq5';
import type { Room } from '../../data/rooms';
import type { GerantData } from '../../lib/api';
import type { Reservation } from '../../lib/reservations';

const mocks = vi.hoisted(() => ({
  fetchMyRooms: vi.fn<() => Promise<Room[]>>(),
  getReservations: vi.fn<() => Promise<Reservation[]>>(),
  getMe: vi.fn<() => Promise<GerantData>>(),
  gerantUnread: vi.fn<() => Promise<{ count: number }>>(),
}));

vi.mock('../../data/rooms', () => ({
  fetchMyRooms: mocks.fetchMyRooms,
}));

vi.mock('../../lib/reservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/reservations')>();
  return {
    ...actual,
    getReservations: mocks.getReservations,
  };
});

vi.mock('../../lib/api', () => ({
  apiGerants: { getMe: mocks.getMe },
  apiMessages: { gerantUnread: mocks.gerantUnread },
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

const room: Room = {
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
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ci/gerant/reservations/calendrier']}>
      <MarketProvider>
        <CalendrierMaq5 />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMyRooms.mockResolvedValue([room]);
  mocks.getReservations.mockResolvedValue([]);
  mocks.getMe.mockResolvedValue(gerant);
  mocks.gerantUnread.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  cleanup();
});

describe('CalendrierMaq5', () => {
  it('bascule entre les vues mois, semaine et jour', async () => {
    renderPage();

    expect((await screen.findAllByText(room.title)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Mois' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Résumé du mois' })).toBeInTheDocument();
    expect(document.querySelectorAll('.week')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Mois précédent' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }));

    expect(screen.getByRole('button', { name: 'Semaine' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Résumé de la semaine' })).toBeInTheDocument();
    expect(document.querySelectorAll('.week')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Jour' }));

    expect(screen.getByRole('button', { name: 'Jour' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Résumé du jour' })).toBeInTheDocument();
    expect(document.querySelectorAll('.week')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Jour précédent' })).toBeInTheDocument();
    expect(screen.getByText(/Aucune réservation pour cette date|→/)).toBeInTheDocument();
  }, 15000);

  it('ouvre la vue jour depuis une case du calendrier', async () => {
    renderPage();

    expect((await screen.findAllByText(room.title)).length).toBeGreaterThan(0);
    const firstDay = screen.getAllByRole('button', { name: /Voir le détail du/ })[0];
    fireEvent.click(firstDay);

    expect(screen.getByRole('button', { name: 'Jour' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Résumé du jour' })).toBeInTheDocument();
  }, 15000);
});
