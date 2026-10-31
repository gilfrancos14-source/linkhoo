import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Room } from '../data/rooms';
import type { ClientMineReservationData, ReviewData, RoomReviewsResponse } from '../lib/api';
import { MarketProvider } from '../contexts/MarketContext';
import LaisserAvisPage from './LaisserAvisPage';

const mocks = vi.hoisted(() => ({
  getMyReservations: vi.fn<() => Promise<unknown[]>>(),
  listMine: vi.fn<() => Promise<unknown[]>>(),
  listByRoom: vi.fn<(roomId: string) => Promise<unknown>>(),
  createReview: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  fetchRoomById: vi.fn<(id: string) => Promise<unknown>>(),
  setAuthTokenGetter: vi.fn<(...args: unknown[]) => void>(),
  getToken: vi.fn<() => Promise<string | null>>(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    setAuthTokenGetter: mocks.setAuthTokenGetter,
    apiReviews: {
      ...actual.apiReviews,
      listMine: mocks.listMine,
      listByRoom: mocks.listByRoom,
      create: mocks.createReview,
    },
  };
});

vi.mock('../lib/reservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/reservations')>();
  return { ...actual, getMyReservations: mocks.getMyReservations };
});

vi.mock('../data/rooms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/rooms')>();
  return { ...actual, fetchRoomById: mocks.fetchRoomById };
});

vi.mock('../hooks/useHomePath', () => ({
  useHomePath: () => '/ci',
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, getToken: mocks.getToken }),
  useUser: () => ({
    user: { firstName: 'Awa', lastName: 'Kone', fullName: 'Awa Kone', imageUrl: null },
  }),
}));

const RESERVATION: ClientMineReservationData = {
  id: 'res1',
  room_id: 'room1',
  room_title: 'Suite vue mer',
  date_debut: '2026-11-02',
  date_fin: '2026-11-05',
  duree_nombre: 3,
  duree_unite: 'nuit',
  statut: 'confirmee',
  created_at: '2026-10-20T10:00:00.000Z',
  responded_at: '2026-10-21T10:00:00.000Z',
  montant: 75000,
};

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room1',
    title: 'Suite vue mer',
    subtitle: 'À deux pas de la plage',
    info: 'Wi-Fi · Climatisation',
    price: '25 000',
    priceNum: 25000,
    priceUnit: '/ nuit',
    img: '/images/suite.jpg',
    alt: 'Suite vue sur la mer',
    images: ['/images/a.jpg', '/images/b.jpg'],
    description: 'Un espace lumineux avec terrasse.',
    capacity: '2 personnes',
    category: 'chambre',
    market: 'CI',
    pays: "Côte d'Ivoire",
    ville: 'Grand-Bassam',
    quartier: 'Ficaye',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '2026-11-01',
    conditions: 'Non fumeur',
    ...overrides,
  };
}

const ROOM_REVIEWS: RoomReviewsResponse = {
  reviews: [
    {
      id: 'rv1',
      room_id: 'room1',
      gerant_id: 'g1',
      client_name: 'Jeanne',
      reservation_id: 'res0',
      note_appartement: 5,
      note_gerant: 4,
      commentaire: 'Super séjour',
      created_at: '2026-10-15T10:00:00.000Z',
    },
  ],
  room_avg: 4.5,
  room_count: 3,
  room_distribution: [
    { note: 5, count: 2, percent: 66.7 },
    { note: 4, count: 1, percent: 33.3 },
  ],
  gerant_avg: 4,
  gerant_count: 2,
};

const MY_REVIEW: ReviewData = {
  id: 'rv-mine',
  room_id: 'room1',
  gerant_id: 'g1',
  client_name: 'Awa Kone',
  reservation_id: 'res1',
  note_appartement: 4,
  note_gerant: 5,
  commentaire: 'Très bon séjour, je recommande.',
  created_at: '2026-10-25T10:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ci/avis/res1']}>
      <MarketProvider>
        <Routes>
          <Route path="/ci/avis/:reservationId" element={<LaisserAvisPage />} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.getMyReservations.mockResolvedValue([RESERVATION]);
  mocks.listMine.mockResolvedValue([]);
  mocks.listByRoom.mockResolvedValue(ROOM_REVIEWS);
  mocks.fetchRoomById.mockResolvedValue(makeRoom());
  mocks.getToken.mockResolvedValue('jwt-test');
  mocks.createReview.mockResolvedValue({ ...MY_REVIEW, id: 'rv-new' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LaisserAvisPage — avis du logement', () => {
  it('affiche les données réelles de la chambre et des avis', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Suite vue mer', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('4,5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('(3 avis)').length).toBeGreaterThan(0);
    expect(screen.getByText('Jeanne')).toBeInTheDocument();
    expect(screen.getByText('Super séjour')).toBeInTheDocument();
    expect(screen.getByText('Awa Kone')).toBeInTheDocument();
    expect(mocks.listByRoom).toHaveBeenCalledWith('room1');
  });

  it('affiche les photos de la réservation sous chaque avis', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Suite vue mer', level: 1 });

    expect(
      (await screen.findAllByAltText('Photo 1 de la réservation')).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Photo 2 de la réservation').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Photo 3 de la réservation').length).toBeGreaterThan(0);
  });

  it('affiche le footer de la page d’accueil à la place de la carte « À bientôt »', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Suite vue mer', level: 1 });

    expect(screen.queryByText('À bientôt sur Linkhoo !')).not.toBeInTheDocument();
    expect(screen.queryByText('Merci pour votre confiance !')).not.toBeInTheDocument();
    expect(screen.getByText('Linkhoo', { selector: '.acc-footer__name' })).toBeInTheDocument();
    expect(
      screen.getByText('© 2025 Linkhoo. Tous droits réservés.'),
    ).toBeInTheDocument();
  });

  it('remplace le formulaire par l’avis déjà publié', async () => {
    mocks.listMine.mockResolvedValue([MY_REVIEW]);
    renderPage();

    expect(
      (await screen.findAllByText('Vous avez déjà laissé un avis pour ce séjour.')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Publier mon avis' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Très bon séjour, je recommande.').length).toBeGreaterThan(0);
    expect(mocks.listByRoom).toHaveBeenCalledWith('room1');
  });

  it('bloque une réservation qui n’est pas confirmée', async () => {
    mocks.getMyReservations.mockResolvedValue([{ ...RESERVATION, statut: 'en_attente' }]);
    renderPage();

    expect(
      (await screen.findAllByText(
        'Vous pourrez laisser un avis dès que votre réservation sera confirmée.',
      )).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Publier mon avis' })).not.toBeInTheDocument();
  });

  it('publie les deux notes et le commentaire via l’API', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Suite vue mer', level: 1 });

    fireEvent.click(screen.getByRole('button', { name: '3 étoiles — Logement' }));
    fireEvent.click(screen.getByRole('button', { name: '4 étoiles — Gérant' }));
    fireEvent.change(
      screen.getByPlaceholderText(
        'Partagez votre expérience : qu’avez-vous aimé ? Qu’est-ce qui pourrait être amélioré ?',
      ),
      { target: { value: 'Séjour très agréable et hôte disponible.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publier mon avis' }));

    await waitFor(() => {
      expect(mocks.createReview).toHaveBeenCalledWith({
        reservation_id: 'res1',
        note_appartement: 3,
        note_gerant: 4,
        commentaire: 'Séjour très agréable et hôte disponible.',
      });
    });

    expect(
      (await screen.findAllByText('Merci ! Votre avis a bien été publié.')).length,
    ).toBeGreaterThan(0);
    // Les agrégats sont rechargés après publication.
    await waitFor(() => expect(mocks.listByRoom).toHaveBeenCalledTimes(2));
  });

  it('refuse un commentaire trop court', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Suite vue mer', level: 1 });

    fireEvent.change(
      screen.getByPlaceholderText(
        'Partagez votre expérience : qu’avez-vous aimé ? Qu’est-ce qui pourrait être amélioré ?',
      ),
      { target: { value: 'Court' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publier mon avis' }));

    expect(
      await screen.findByText('Écrivez au moins 10 caractères pour publier votre avis.'),
    ).toBeInTheDocument();
    expect(mocks.createReview).not.toHaveBeenCalled();
  });

  it('affiche l’erreur renvoyée par le serveur', async () => {
    mocks.createReview.mockRejectedValue(new Error('Avis déjà publié'));
    renderPage();
    await screen.findByRole('heading', { name: 'Suite vue mer', level: 1 });

    fireEvent.change(
      screen.getByPlaceholderText(
        'Partagez votre expérience : qu’avez-vous aimé ? Qu’est-ce qui pourrait être amélioré ?',
      ),
      { target: { value: 'Séjour très agréable et hôte disponible.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publier mon avis' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Avis déjà publié')).toBeInTheDocument();
  });
});
