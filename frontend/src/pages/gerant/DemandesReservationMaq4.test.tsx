import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import DemandesReservationMaq4 from './DemandesReservationMaq4';
import type { Room } from '../../data/rooms';
import type { GerantData } from '../../lib/api';
import type { Reservation } from '../../lib/reservations';

const mocks = vi.hoisted(() => ({
  getReservations: vi.fn<() => Promise<Reservation[]>>(),
  fetchMyRooms: vi.fn<() => Promise<Room[]>>(),
  updateReservationStatut: vi.fn<
    (id: string, statut: 'confirmee' | 'annulee') => Promise<void>
  >(),
  getMe: vi.fn<() => Promise<GerantData>>(),
  gerantUnread: vi.fn<() => Promise<{ count: number }>>(),
}));

vi.mock('../../lib/reservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/reservations')>();
  return {
    ...actual,
    getReservations: mocks.getReservations,
    updateReservationStatut: mocks.updateReservationStatut,
  };
});

vi.mock('../../data/rooms', () => ({
  fetchMyRooms: mocks.fetchMyRooms,
}));

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

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
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
    ...overrides,
  };
}

const reservations: Reservation[] = [
  makeReservation(),
  makeReservation({
    id: 'res-2',
    clientName: 'Koffi Mensah',
    clientEmail: 'koffi@example.ci',
    roomId: 'room-2',
    roomTitle: 'Villa avec piscine',
    statut: 'confirmee',
    montant: 150000,
    createdAt: '2026-09-18T09:00:00.000Z',
  }),
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ci/gerant/reservations/demandes']}>
      <MarketProvider>
        <DemandesReservationMaq4 />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getReservations.mockResolvedValue(reservations);
  mocks.fetchMyRooms.mockResolvedValue([room]);
  mocks.updateReservationStatut.mockResolvedValue(undefined);
  mocks.getMe.mockResolvedValue(gerant);
  mocks.gerantUnread.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  cleanup();
});

describe('DemandesReservationMaq4', () => {
  it('affiche les demandes chargées depuis l’API', async () => {
    renderPage();

    expect(document.querySelector('.gerant-maq4')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Demandes de réservation' }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText('Aïcha Diallo')).toHaveLength(2);
    expect(screen.getAllByText(/Appartement lumineux/).length).toBeGreaterThan(0);
    expect(screen.getByText('225 000 FCFA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toutes/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('pointe le lien Demandes vers la page maq4', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Demandes' })).toHaveAttribute(
      'href',
      '/ci/gerant/reservations/demandes',
    );
  });

  it('explique l\'accès réservé aux gérants vérifiés et Premium', async () => {
    mocks.getReservations.mockRejectedValue(
      Object.assign(new Error('Réservations gérées par l\'administrateur'), { status: 403 }),
    );

    renderPage();

    expect(
      await screen.findByText(
        'Les réservations sont visibles uniquement pour les gérants vérifiés et Premium.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Aucune demande de réservation pour le moment.')).not.toBeInTheDocument();
  });
});
