import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import type { Conversation, Message } from '../../lib/api';
import ClientMessagesMaq from './ClientMessagesMaq';

const mocks = vi.hoisted(() => ({
  inbox: vi.fn<(page?: number) => Promise<unknown>>(),
  getConversation: vi.fn<(id: string) => Promise<unknown>>(),
  listMessages: vi.fn<(id: string, page?: number) => Promise<unknown>>(),
  sendMessage: vi.fn<(id: string, body: string) => Promise<unknown>>(),
  markRead: vi.fn<(id: string) => Promise<unknown>>(),
  getRoom: vi.fn<(id: string) => Promise<unknown>>(),
  listByRoom: vi.fn<(id: string) => Promise<unknown>>(),
  signOut: vi.fn<() => Promise<void>>(),
}));

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    apiMessages: {
      ...actual.apiMessages,
      inbox: mocks.inbox,
      getConversation: mocks.getConversation,
      listMessages: mocks.listMessages,
      sendMessage: mocks.sendMessage,
      markRead: mocks.markRead,
    },
    apiRooms: { ...actual.apiRooms, get: mocks.getRoom },
    apiReviews: { ...actual.apiReviews, listByRoom: mocks.listByRoom },
  };
});

vi.mock('@clerk/clerk-react', () => ({
  useClerk: () => ({ signOut: mocks.signOut }),
}));

const CONVERSATION_ONE: Conversation = {
  id: 'c1',
  room_id: 'room1',
  client_id: 'client1',
  gerant_id: 'g1',
  client_name: 'Aya Kouassi',
  client_email: 'aya@test.com',
  last_message_at: '2026-10-29T09:00:00.000Z',
  created_at: '2026-10-20T10:00:00.000Z',
  room: { id: 'room1', title: 'Suite vue mer', img: '/images/suite.jpg', market: 'CI' },
  last_message: {
    id: 'm2',
    conversation_id: 'c1',
    sender_role: 'gerant',
    body: 'La chambre est disponible.',
    read_at: null,
    created_at: '2026-10-29T09:00:00.000Z',
  },
  unread_count: 2,
};

const CONVERSATION_TWO: Conversation = {
  id: 'c2',
  room_id: 'room2',
  client_id: 'client1',
  gerant_id: 'g2',
  client_name: 'Aya Kouassi',
  client_email: 'aya@test.com',
  last_message_at: '2026-10-28T15:30:00.000Z',
  created_at: '2026-10-10T10:00:00.000Z',
  room: { id: 'room2', title: 'Bungalow cocody', img: null, market: null },
  last_message: {
    id: 'm4',
    conversation_id: 'c2',
    sender_role: 'client',
    body: 'Merci pour votre réponse.',
    read_at: '2026-10-28T15:31:00.000Z',
    created_at: '2026-10-28T15:30:00.000Z',
  },
  unread_count: 0,
};

const MESSAGES: Message[] = [
  {
    id: 'm1',
    conversation_id: 'c1',
    sender_role: 'client',
    body: 'Bonjour, la chambre est-elle libre ?',
    read_at: '2026-10-28T08:01:00.000Z',
    created_at: '2026-10-28T08:00:00.000Z',
  },
  {
    id: 'm2',
    conversation_id: 'c1',
    sender_role: 'gerant',
    body: 'La chambre est disponible.',
    read_at: null,
    created_at: '2026-10-29T09:00:00.000Z',
  },
];

/** La page réelle lit l'id dans l'URL : le harnais fait de même. */
function MessagesRoute() {
  const { conversationId } = useParams<{ conversationId: string }>();
  return (
    <ClientMessagesMaq
      basePath="/ci/messages"
      conversationId={conversationId}
      homePath="/ci"
      displayName="Aya"
      profileFirstName="Aya"
      profileLastName="Kouassi"
      unreadMessages={2}
    />
  );
}

function renderMessages(entry = '/ci/messages') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/ci/messages" element={<MessagesRoute />} />
        <Route path="/ci/messages/:conversationId" element={<MessagesRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue(undefined);
  mocks.inbox.mockResolvedValue({
    items: [CONVERSATION_ONE, CONVERSATION_TWO],
    total: 2,
    page: 1,
    limit: 20,
  });
  mocks.getConversation.mockResolvedValue(CONVERSATION_ONE);
  mocks.listMessages.mockResolvedValue(MESSAGES);
  mocks.markRead.mockResolvedValue({ updated: 1 });
  mocks.getRoom.mockResolvedValue({
    id: 'room1',
    title: 'Suite vue mer',
    subtitle: '',
    info: '',
    price: '75000',
    price_num: 75000,
    price_unit: 'nuit',
    img: '/images/suite.jpg',
    alt: 'Suite',
    images: [],
    description: '',
    category: 'appartements',
    market: 'CI',
    pays: 'Côte d’Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 2,
    douches: 1,
    disponible: true,
    date_dispo: '2026-10-29',
    conditions: '',
  });
  mocks.listByRoom.mockResolvedValue({
    reviews: [],
    room_avg: 4.6,
    room_count: 8,
    gerant_avg: null,
    gerant_count: 0,
  });
  mocks.sendMessage.mockResolvedValue({
    id: 'm3',
    conversation_id: 'c1',
    sender_role: 'client',
    body: 'Je réserve.',
    read_at: null,
    created_at: '2026-10-29T10:00:00.000Z',
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ClientMessagesMaq — boîte de réception', () => {
  it('affiche les conversations avec aperçu et non-lus', async () => {
    renderMessages();

    expect(await screen.findByText('Suite vue mer')).toBeInTheDocument();
    expect(screen.getByText('Bungalow cocody')).toBeInTheDocument();
    expect(screen.getByText('La chambre est disponible.')).toBeInTheDocument();
    expect(screen.getByText('Vous : Merci pour votre réponse.')).toBeInTheDocument();
    expect(screen.getByLabelText('2 non lus')).toHaveTextContent('2');
  });

  it('relie chaque conversation à son fil', async () => {
    renderMessages();

    const link = await screen.findByRole('link', { name: /Suite vue mer/ });
    expect(link).toHaveAttribute('href', '/ci/messages/c1');
  });

  it('affiche un état vide quand aucune conversation n’existe', async () => {
    mocks.inbox.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    renderMessages();

    expect(
      await screen.findByText(/Aucune conversation pour le moment/),
    ).toBeInTheDocument();
  });

  it('affiche l’erreur de chargement de la boîte de réception', async () => {
    mocks.inbox.mockRejectedValue(new Error('boom'));

    renderMessages();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger vos conversations.',
    );
  });

  it('filtre les conversations sur l’onglet « Non lus »', async () => {
    renderMessages();
    await screen.findByText('Suite vue mer');

    fireEvent.click(screen.getByRole('button', { name: /Non lus/ }));

    expect(screen.getByText('Suite vue mer')).toBeInTheDocument();
    expect(screen.queryByText('Bungalow cocody')).not.toBeInTheDocument();
  });

  it('recharge la liste via le bouton d’actualisation', async () => {
    renderMessages();
    await screen.findByText('Suite vue mer');
    expect(mocks.inbox).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));

    await waitFor(() => expect(mocks.inbox).toHaveBeenCalledTimes(2));
  });

  it('affiche un état vide dédié à l’onglet Linkhoo', async () => {
    renderMessages();
    await screen.findByText('Suite vue mer');

    fireEvent.click(screen.getByRole('button', { name: /Linkhoo/ }));

    expect(
      screen.getByText(/Aucune conversation avec le support/),
    ).toBeInTheDocument();
  });
});

describe('ClientMessagesMaq — fil de discussion', () => {
  it('affiche les messages échangés et marque les messages comme lus', async () => {
    renderMessages('/ci/messages/c1');

    expect(
      await screen.findByText('Bonjour, la chambre est-elle libre ?'),
    ).toBeInTheDocument();
    // Le dernier message apparaît aussi dans l'aperçu de la liste.
    expect(screen.getAllByText('La chambre est disponible.').length).toBeGreaterThan(1);
    expect(mocks.getConversation).toHaveBeenCalledWith('c1');
    expect(mocks.listMessages).toHaveBeenCalledWith('c1', 1);
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith('c1'));
  });

  it('affiche « Aujourd’hui » comme séparateur de journée', async () => {
    mocks.listMessages.mockResolvedValue([
      {
        ...MESSAGES[1],
        created_at: new Date().toISOString(),
        read_at: '2026-10-29T09:01:00.000Z',
      },
    ]);

    renderMessages('/ci/messages/c1');

    expect(await screen.findByText('Aujourd’hui')).toBeInTheDocument();
  });

  it('affiche le prix et la note de la chambre dans le panneau de droite', async () => {
    renderMessages('/ci/messages/c1');
    await screen.findByText('Bonjour, la chambre est-elle libre ?');

    const panel = document.querySelector<HTMLElement>('aside.row-span-2');
    expect(panel).not.toBeNull();
    expect(await within(panel as HTMLElement).findByText('75 000')).toBeInTheDocument();
    expect(within(panel as HTMLElement).getByText('4.6')).toBeInTheDocument();
    expect(within(panel as HTMLElement).getByText(/\(8 avis\)/)).toBeInTheDocument();
  });

  it('affiche un état vide de sélection sans conversation', async () => {
    renderMessages();

    expect(await screen.findByText('Sélectionnez une conversation')).toBeInTheDocument();
  });

  it('affiche l’erreur quand le fil est introuvable', async () => {
    mocks.getConversation.mockRejectedValue(new Error('404'));
    mocks.listMessages.mockRejectedValue(new Error('404'));

    renderMessages('/ci/messages/inconnue');

    expect(await screen.findByRole('alert')).toHaveTextContent('Conversation introuvable');
  });

  it('envoie un message et l’ajoute au fil', async () => {
    renderMessages('/ci/messages/c1');
    await screen.findByText('Bonjour, la chambre est-elle libre ?');

    fireEvent.change(screen.getByPlaceholderText('Écrivez votre message...'), {
      target: { value: 'Je réserve.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));

    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith('c1', 'Je réserve.'));
    expect(await screen.findByText('Je réserve.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Écrivez votre message...')).toHaveValue('');
  });

  it('désactive l’envoi tant que le brouillon est vide', async () => {
    renderMessages('/ci/messages/c1');
    await screen.findByText('Bonjour, la chambre est-elle libre ?');

    expect(screen.getByRole('button', { name: 'Envoyer le message' })).toBeDisabled();
  });

  it('affiche une erreur quand l’envoi échoue', async () => {
    mocks.sendMessage.mockRejectedValue(new Error('boom'));
    renderMessages('/ci/messages/c1');
    await screen.findByText('Bonjour, la chambre est-elle libre ?');

    fireEvent.change(screen.getByPlaceholderText('Écrivez votre message...'), {
      target: { value: 'Je réserve.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Envoi impossible, veuillez réessayer.',
    );
  });
});

describe('ClientMessagesMaq — chrome de la page', () => {
  it('affiche le compte connecté et le badge de non-lus', async () => {
    renderMessages();
    await screen.findByText('Suite vue mer');

    expect(document.querySelector('.avatar')).toHaveTextContent('AK');
    expect(screen.getAllByText('Aya Kouassi').length).toBeGreaterThan(0);

    const messagesLink = screen.getByRole('link', { name: /^Mes messages/ });
    expect(messagesLink).toHaveAttribute('aria-current', 'page');
    expect(within(messagesLink).getByText('2')).toBeInTheDocument();
  });

  it('déconnecte et revient vers le marché', async () => {
    renderMessages();
    await screen.findByText('Suite vue mer');

    fireEvent.click(screen.getByRole('button', { name: /Aya Kouassi/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Déconnexion' }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
  });
});
