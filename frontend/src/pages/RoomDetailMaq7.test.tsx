import type { MarketCode } from '../config/markets';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import type { Room } from '../data/rooms';
import type { GerantInfo } from '../lib/api';
import RoomDetailMaq7 from './RoomDetailMaq7';

const mocks = vi.hoisted(() => ({
  fetchRoomById: vi.fn<(id: string) => Promise<unknown>>(),
  fetchCategoriesByMarket: vi.fn<(market: MarketCode) => Promise<unknown[]>>(),
  listByRoom: vi.fn<(id: string) => Promise<unknown>>(),
  addReservation: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  redirectTo: vi.fn<(url: string) => void>(),
  me: vi.fn<() => Promise<unknown>>(),
  getOrCreateConversation: vi.fn<(roomId: string) => Promise<unknown>>(),
  clerk: {
    isLoaded: true,
    isSignedIn: false,
    user: null as unknown,
  },
}));

vi.mock('../lib/api', () => ({
  apiReviews: { listByRoom: mocks.listByRoom },
  apiAuth: { me: mocks.me },
  apiMessages: { getOrCreateConversation: mocks.getOrCreateConversation },
  apiNewsletter: vi.fn(),
  request: vi.fn().mockRejectedValue(new Error('réseau interdit dans les tests')),
  cachedGet: vi.fn().mockRejectedValue(new Error('réseau interdit dans les tests')),
}));

vi.mock('../lib/reservations', () => ({
  addReservation: mocks.addReservation,
}));

vi.mock('../lib/navigation', () => ({
  redirectTo: mocks.redirectTo,
}));

vi.mock('../data/rooms', () => ({
  fetchRoomById: mocks.fetchRoomById,
}));

vi.mock('../data/categories', () => ({
  fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
}));

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: mocks.clerk.user, isLoaded: mocks.clerk.isLoaded }),
  useAuth: () => ({ isLoaded: mocks.clerk.isLoaded, isSignedIn: mocks.clerk.isSignedIn }),
}));

const CATEGORIES = [
  {
    id: 'cat-premium',
    title: 'Chambres premium',
    img: '/images/premium.jpg',
    alt: 'Premium',
    market: 'CI',
  },
];

const GERANT: GerantInfo = {
  nom: 'Kouassi',
  prenom: 'Aya',
  phone: '+2250707070707',
  is_verified: true,
  is_premium: true,
  created_at: '2024-03-12T10:00:00.000Z',
};

const REVIEWS = {
  reviews: [
    {
      id: 'rv1',
      room_id: 'r1',
      gerant_id: 'g1',
      client_name: 'Jeanne',
      note_appartement: 5,
      note_gerant: 4,
      commentaire: 'Super séjour',
      created_at: '2026-01-15T10:00:00.000Z',
    },
  ],
  room_avg: 4.5,
  room_count: 3,
  gerant_avg: 4,
  gerant_count: 2,
};

const NO_REVIEWS = {
  reviews: [],
  room_avg: null,
  room_count: 0,
  gerant_avg: null,
  gerant_count: 0,
};

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    title: 'Suite vue mer',
    subtitle: 'À deux pas de la plage',
    info: 'Wi-Fi · Climatisation',
    price: '25 000',
    priceNum: 25000,
    priceUnit: '/ nuit',
    img: '/images/suite.jpg',
    alt: 'Suite vue sur la mer',
    images: ['/images/a.jpg', '/images/b.jpg', '/images/c.jpg'],
    description: 'Un espace lumineux avec terrasse.',
    capacity: '2 personnes',
    category: 'cat-premium',
    market: 'CI',
    pays: "Côte d'Ivoire",
    ville: 'Grand-Bassam',
    quartier: 'Ficaye',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '2026-01-01',
    conditions: 'Annulation gratuite, Dépôt de garantie',
    gerant: GERANT,
    ...overrides,
  };
}

function renderPage(entry = '/ci/chambre/r1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Routes>
          <Route path="/:market/chambre/:id" element={<RoomDetailMaq7 />} />
          <Route path="/:market" element={<div data-testid="home">Accueil du marché</div>} />
          <Route path="/:market/login" element={<div data-testid="login">Connexion</div>} />
          <Route
            path="/:market/messages/:conversationId"
            element={<div data-testid="messages-thread">Fil de discussion</div>}
          />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

async function renderLoaded(entry = '/ci/chambre/r1') {
  const view = renderPage(entry);
  await screen.findByRole('heading', { level: 1, name: 'Suite vue mer' });
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clerk = { isLoaded: true, isSignedIn: false, user: null };
  mocks.fetchRoomById.mockResolvedValue(makeRoom());
  mocks.fetchCategoriesByMarket.mockResolvedValue(CATEGORIES);
  mocks.listByRoom.mockResolvedValue(REVIEWS);
  mocks.addReservation.mockResolvedValue({ id: 'res-1' });
  mocks.me.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.getOrCreateConversation.mockRejectedValue(new Error('réseau interdit dans les tests'));
});

afterEach(() => {
  cleanup();
});

describe('RoomDetailMaq7 — états', () => {
  it('affiche un chargement tant que la chambre n’est pas revenue', () => {
    mocks.fetchRoomById.mockReturnValue(new Promise<Room>(() => {}));

    renderPage();

    expect(screen.getByText(/Chargement de l/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('affiche la barre de navigation de l’accueil du marché', async () => {
    await renderLoaded();

    expect(
      screen.getByRole('navigation', { name: 'Navigation principale' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Linkhoo — accueil' })).toHaveAttribute(
      'href',
      '/ci',
    );
    expect(screen.getByRole('link', { name: 'Mon espace' })).toHaveAttribute(
      'href',
      '/ci/compte',
    );
  });

  it('affiche « Chambre introuvable » quand l’identifiant n’existe pas', async () => {
    mocks.fetchRoomById.mockRejectedValue(new Error('404'));

    renderPage('/ci/chambre/inconnu');

    expect(await screen.findByText('Chambre introuvable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/ci');
  });
});

describe('RoomDetailMaq7 — données de l’API', () => {
  it('affiche le titre, la catégorie, le lieu, le prix et la description', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { level: 1, name: 'Suite vue mer' })).toBeInTheDocument();
    expect(screen.getAllByText('Chambres premium').length).toBeGreaterThan(0);
    expect(screen.getByText('Ficaye, Grand-Bassam, Côte d\'Ivoire')).toBeInTheDocument();
    expect(screen.getByText(/dès/)).toHaveTextContent('25 000');
    expect(screen.getByText('Un espace lumineux avec terrasse.')).toBeInTheDocument();
  });

  it('affiche les conditions de la chambre', async () => {
    await renderLoaded();

    expect(screen.getByText('Annulation gratuite')).toBeInTheDocument();
    expect(screen.getByText('Dépôt de garantie')).toBeInTheDocument();
  });

  it('affiche l’hôte, sa note et le badge vérifié', async () => {
    await renderLoaded();

    expect(screen.getByText('Aya Kouassi')).toBeInTheDocument();
    expect(screen.getByText('Membre depuis mars 2024')).toBeInTheDocument();
    expect(screen.getByText('Vérifié')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('(2 avis)')).toBeInTheDocument();
  });

  it('affiche les avis renvoyés par l’API', async () => {
    await renderLoaded();

    expect(screen.getAllByText('4,5').length).toBeGreaterThan(0);
    expect(screen.getByText('3 avis')).toBeInTheDocument();
    expect(screen.getAllByText('Jeanne').length).toBeGreaterThan(0);
    expect(screen.getAllByText('« Super séjour »').length).toBeGreaterThan(0);
    expect(screen.getByText('Tous les avis')).toBeInTheDocument();
    expect(screen.getByText('Utile')).toBeInTheDocument();
  });

  it('affiche un état vide quand la chambre n’a aucun avis', async () => {
    mocks.listByRoom.mockResolvedValue(NO_REVIEWS);

    await renderLoaded();

    expect(
      screen.getByText(/Aucun avis pour le moment/),
    ).toBeInTheDocument();
    expect(screen.getByText('Tous les avis')).toBeInTheDocument();
  });
});

describe('RoomDetailMaq7 — galerie', () => {
  it('affiche la photo principale et navigue avec les flèches', async () => {
    await renderLoaded();

    expect(screen.getByAltText('Suite vue mer — photo 1 sur 3')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
    expect(screen.getByAltText('Suite vue mer — photo 2 sur 3')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Photo précédente' }));
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('sélectionne une photo depuis la vignette latérale', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Voir la photo 3' }));

    expect(screen.getByAltText('Suite vue mer — photo 3 sur 3')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });
});

function fillReservationForm(container: HTMLElement) {
  fireEvent.change(screen.getByLabelText(/Nom complet/), {
    target: { value: 'Jean Koffi' },
  });
  fireEvent.change(screen.getByLabelText(/Email/), {
    target: { value: 'jean@test.com' },
  });
  fireEvent.change(screen.getByLabelText(/Téléphone/), {
    target: { value: '0707070707' },
  });
  fireEvent.change(screen.getByLabelText(/Date de début/), {
    target: { value: '2027-03-01' },
  });
  fireEvent.change(screen.getByLabelText(/Durée/), { target: { value: '3' } });

  const form = container.querySelector('form');
  if (!form) throw new Error('formulaire de réservation introuvable');
  fireEvent.submit(form);
}

describe('RoomDetailMaq7 — réservation', () => {
  it('envoie les champs du projet à addReservation', async () => {
    const { container } = await renderLoaded();

    fillReservationForm(container);

    expect(await screen.findByText('Demande envoyée !')).toBeInTheDocument();
    expect(mocks.addReservation).toHaveBeenCalledTimes(1);
    expect(mocks.addReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: 'Jean Koffi',
        clientEmail: 'jean@test.com',
        clientPhone: '0707070707',
        roomId: 'r1',
        roomTitle: 'Suite vue mer',
        dateDebut: '2027-03-01',
        dateFin: '2027-03-04',
        dureeNombre: 3,
        dureeUnite: 'nuit',
        montant: 75000,
      }),
    );
  }, 20000);

  it('redirige vers le checkout Hub2 quand la réservation en ouvre un', async () => {
    mocks.addReservation.mockResolvedValue({
      id: 'res-1',
      payment: {
        state: 'checkout',
        reference: 'pay-1',
        checkout_url: 'https://checkout.hub2.io/pay-1',
      },
    });
    const { container } = await renderLoaded();

    fillReservationForm(container);

    await vi.waitFor(() => {
      expect(mocks.redirectTo).toHaveBeenCalledWith('https://checkout.hub2.io/pay-1');
    });
    expect(screen.queryByText('Demande envoyée !')).not.toBeInTheDocument();
  }, 20000);
});

describe('RoomDetailMaq7 — contact de l’hôte', () => {
  it('ouvre la conversation pour un client connecté', async () => {
    mocks.clerk = {
      isLoaded: true,
      isSignedIn: true,
      user: {
        firstName: 'Jean',
        lastName: 'Koffi',
        primaryEmailAddress: { emailAddress: 'jean@test.com' },
        emailAddresses: [],
      },
    };
    mocks.me.mockResolvedValue({ role: 'client' });
    mocks.getOrCreateConversation.mockResolvedValue({ id: 'conv-9' });

    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: "Contacter l'hôte" }));

    expect(await screen.findByTestId('messages-thread')).toBeInTheDocument();
    expect(mocks.getOrCreateConversation).toHaveBeenCalledWith('r1');
  });

  it('affiche une erreur si l’ouverture de la discussion échoue', async () => {
    mocks.clerk = {
      isLoaded: true,
      isSignedIn: true,
      user: {
        firstName: 'Jean',
        lastName: 'Koffi',
        primaryEmailAddress: { emailAddress: 'jean@test.com' },
        emailAddresses: [],
      },
    };
    mocks.me.mockResolvedValue({ role: 'client' });
    mocks.getOrCreateConversation.mockRejectedValue(new Error('boom'));

    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: "Contacter l'hôte" }));

    expect(
      await screen.findByText("Impossible d'ouvrir la discussion. Veuillez réessayer."),
    ).toBeInTheDocument();
  });
});
