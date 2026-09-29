import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import AdminLayout from './AdminLayout';
import type { Notification } from '../../lib/notifications';
import type { GerantData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  getNotifications: vi.fn<() => Promise<Notification[]>>(),
  markAsRead: vi.fn<(id: string) => Promise<void>>(),
  markAllAsRead: vi.fn<() => Promise<void>>(),
  addClientNotification: vi.fn<(data: Record<string, unknown>) => Promise<void>>(),
  fetchMyRooms: vi.fn<() => Promise<{ id: string }[]>>(),
  updateReservationStatut: vi.fn<(id: string, statut: string) => Promise<void>>(),
  getReservations: vi.fn<() => Promise<unknown[]>>(),
  checkDateConflict: vi.fn<() => Promise<{ hasConflict: boolean }>>(),
  getMe: vi.fn<() => Promise<GerantData>>(),
  signOut: vi.fn<(opts: { redirectUrl: string }) => void>(),
  userId: 'user_abc',
  user: null as {
    firstName?: string | null;
    emailAddresses?: Array<{ emailAddress: string }>;
  } | null,
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: mocks.userId, isLoaded: true, isSignedIn: true }),
  useClerk: () => ({ signOut: mocks.signOut }),
  useUser: () => ({ user: mocks.user }),
}));

vi.mock('../../lib/notifications', () => ({
  getNotifications: mocks.getNotifications,
  markAsRead: mocks.markAsRead,
  markAllAsRead: mocks.markAllAsRead,
  addClientNotification: mocks.addClientNotification,
}));

vi.mock('../../data/rooms', () => ({
  fetchMyRooms: mocks.fetchMyRooms,
}));

vi.mock('../../lib/reservations', () => ({
  updateReservationStatut: mocks.updateReservationStatut,
  getReservations: mocks.getReservations,
  checkDateConflict: mocks.checkDateConflict,
}));

vi.mock('../../lib/api', () => ({
  apiGerants: { getMe: mocks.getMe },
}));

// ── Données ──
const gerantBrouillon: GerantData = {
  id: 'g-1',
  clerk_user_id: 'user_abc',
  email: 'awa@ilehya.ci',
  nom: 'Koné',
  prenom: 'Awa',
  phone: '+225070102030',
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
  created_at: '2025-12-01T00:00:00.000Z',
};

const gerantQualifie: GerantData = {
  ...gerantBrouillon,
  is_verified: true,
  verification_status: 'approved',
  is_premium: true,
};

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: 'reservation',
    roomTitle: 'Studio Ayida',
    roomId: 'room-1',
    clientName: 'Koffi',
    clientEmail: 'koffi@mail.ci',
    clientPhone: '+225010203040',
    message: 'Demande de réservation',
    date: new Date().toISOString(),
    read: false,
    reservationId: 'res-1',
    ...overrides,
  };
}

const reservation = {
  id: 'res-1',
  roomId: 'room-1',
  dateDebut: '2026-03-01',
  dateFin: '2026-03-05',
  clientName: 'Koffi',
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLayout(entry = '/ci/gerant') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Routes>
          <Route path="/:market/gerant" element={<AdminLayout />}>
            <Route index element={<p>Contenu aperçu</p>} />
            <Route path="chambres" element={<p>Contenu chambres</p>} />
            <Route path="verification" element={<p>Contenu vérification</p>} />
            <Route path="profil" element={<p>Contenu profil</p>} />
            <Route path="premium" element={<p>Contenu premium</p>} />
            <Route path="reservations" element={<p>Contenu réservations</p>} />
          </Route>
          <Route path="/:market/login" element={<p>Page de connexion</p>} />
        </Routes>
        <LocationProbe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function root(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.admin');
  if (!(el instanceof HTMLElement)) throw new Error('racine .admin introuvable');
  return el;
}

async function openNotifications() {
  await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  return document.querySelector('.notif-dropdown');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.userId = 'user_abc';
  mocks.user = null;
  mocks.getMe.mockResolvedValue(gerantBrouillon);
  mocks.fetchMyRooms.mockResolvedValue([]);
  mocks.getNotifications.mockResolvedValue([]);
  mocks.markAsRead.mockResolvedValue(undefined);
  mocks.markAllAsRead.mockResolvedValue(undefined);
  mocks.addClientNotification.mockResolvedValue(undefined);
  mocks.updateReservationStatut.mockResolvedValue(undefined);
  mocks.getReservations.mockResolvedValue([reservation]);
  mocks.checkDateConflict.mockResolvedValue({ hasConflict: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('structure de la barre latérale', () => {
  it('affiche les groupes de navigation Général, Gestion et Abonnement', async () => {
    const { container } = renderLayout();

    expect(screen.getByText('Général')).toBeInTheDocument();
    expect(screen.getByText('Gestion')).toBeInTheDocument();
    expect(screen.getByText('Abonnement')).toBeInTheDocument();
    expect(container.querySelector('nav.sidebar__nav')).not.toBeNull();
  });

  it('propose les liens Aperçu et Chambres vers les bonnes routes du marché', async () => {
    renderLayout();

    const apercu = screen.getByRole('link', { name: 'Aperçu' });
    expect(apercu).toHaveAttribute('href', '/ci/gerant');
    const chambres = screen.getByRole('link', { name: /Chambres/ });
    expect(chambres).toHaveAttribute('href', '/ci/gerant/chambres');
  });

  it('présente Vérification, Profil et Premium dans les groupes de gestion', async () => {
    renderLayout();

    expect(screen.getByRole('link', { name: 'Vérification' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute(
      'href',
      '/ci/gerant/profil',
    );
    expect(screen.getByRole('link', { name: 'Premium' })).toHaveAttribute(
      'href',
      '/ci/gerant/premium',
    );
  });

  it('masque le lien Réservations tant que le gérant n’est pas qualifié', async () => {
    renderLayout();

    // Laisse le gérant se charger : le lien doit rester absent ensuite.
    expect(await screen.findByText('Gérant immobilier')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Réservations' })).toBeNull();
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
  });

  it('affiche Réservations pour un gérant vérifié et premium', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);

    renderLayout();

    const link = await screen.findByRole('link', { name: 'Réservations' });
    expect(link).toHaveAttribute('href', '/ci/gerant/reservations');
  });

  it('masque Réservations quand le premium est expiré', async () => {
    mocks.getMe.mockResolvedValue({
      ...gerantQualifie,
      premium_expires_at: '2020-01-01T00:00:00.000Z',
    });

    renderLayout();

    expect(screen.queryByRole('link', { name: 'Réservations' })).toBeNull();
  });

  it('affiche le nombre de chambres du gérant en pastille', async () => {
    mocks.fetchMyRooms.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);

    const { container } = renderLayout();

    await waitFor(() => {
      expect(container.querySelector('.sidebar__pill')).toHaveTextContent('3');
    });
    expect(mocks.fetchMyRooms).toHaveBeenCalledTimes(1);
  });

  it('rend le contenu de la route enfant dans la zone principale', async () => {
    renderLayout();

    expect(screen.getByText('Contenu aperçu')).toBeInTheDocument();
  });

  it('propose un lien « Retour au site » vers l’accueil du marché', async () => {
    renderLayout();

    expect(
      screen.getByRole('link', { name: 'Retour au site' }),
    ).toHaveAttribute('href', '/ci');
  });
});

describe('etat de la barre latérale', () => {
  it('démarre dépliée puis se réduit au clic sur « Réduire le menu »', async () => {
    const { container } = renderLayout();
    expect(root(container)).not.toHaveClass('collapsed');

    await userEvent.click(screen.getByRole('button', { name: 'Réduire le menu' }));

    expect(root(container)).toHaveClass('collapsed');
  });

  it('restaure l’état réduit mémorisé dans localStorage au montage', async () => {
    localStorage.setItem('gerant-sidebar', 'true');

    const { container } = renderLayout();

    expect(root(container)).toHaveClass('collapsed');
  });

  it('persiste l’état courant dans localStorage', async () => {
    const { container } = renderLayout();

    await userEvent.click(screen.getByRole('button', { name: 'Réduire le menu' }));

    expect(localStorage.getItem('gerant-sidebar')).toBe('true');
    expect(root(container)).toHaveClass('collapsed');
  });
});

describe('menu mobile', () => {
  it('ouvre le menu au clic sur « Ouvrir le menu »', async () => {
    const { container } = renderLayout();

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));

    expect(root(container)).toHaveClass('mobile-open');
    expect(container.querySelector('.sidebar-backdrop')).not.toBeNull();
  });

  it('referme le menu en cliquant sur le fond noir', async () => {
    const { container } = renderLayout();

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const backdrop = container.querySelector('.sidebar-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(root(container)).not.toHaveClass('mobile-open');
  });

  it('referme le menu avec le bouton « Fermer le menu »', async () => {
    const { container } = renderLayout();

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fermer le menu' }));

    expect(root(container)).not.toHaveClass('mobile-open');
  });

  it('referme automatiquement le menu quand la route change', async () => {
    const { container } = renderLayout();

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    expect(root(container)).toHaveClass('mobile-open');

    await userEvent.click(screen.getByRole('link', { name: /Chambres/ }));

    expect(root(container)).not.toHaveClass('mobile-open');
    expect(screen.getByTestId('location')).toHaveTextContent('/ci/gerant/chambres');
    expect(screen.getByText('Contenu chambres')).toBeInTheDocument();
  });
});

describe('notifications', () => {
  it('affiche le compteur d’unread sur la cloche', async () => {
    mocks.getNotifications.mockResolvedValue([
      makeNotif({ id: 'n1', read: false }),
      makeNotif({ id: 'n2', read: true }),
    ]);

    renderLayout();

    const badge = await screen.findByText('1');
    expect(badge).toHaveClass('topbar__badge');
  });

  it('n’affiche aucun compteur quand tout est lu', async () => {
    mocks.getNotifications.mockResolvedValue([makeNotif({ read: true })]);

    const { container } = renderLayout();

    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalled());
    expect(container.querySelector('.topbar__badge')).toBeNull();
  });

  it('ouvre le panneau et affiche l’état vide quand il n’y a aucune notification', async () => {
    renderLayout();

    const dropdown = await openNotifications();

    expect(dropdown).not.toBeNull();
    expect(screen.getByText('Aucune notification')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tout marquer lu' })).toBeNull();
  });

  it('détaille chaque notification avec son message et son ancienneté', async () => {
    mocks.getNotifications.mockResolvedValue([makeNotif()]);

    renderLayout();
    await openNotifications();

    expect(screen.getByText(/Demande de réservation pour/)).toBeInTheDocument();
    expect(screen.getByText('Studio Ayida')).toBeInTheDocument();
    expect(screen.getByText('À l\'instant')).toBeInTheDocument();
    expect(screen.getByText('Réservation en attente')).toBeInTheDocument();
  });

  it('formate les anciennetés en minutes, heures et jours', async () => {
    const now = Date.now();
    mocks.getNotifications.mockResolvedValue([
      makeNotif({ id: 'a', date: new Date(now - 5 * 60000).toISOString() }),
      makeNotif({ id: 'b', date: new Date(now - 2 * 3600000).toISOString() }),
      makeNotif({ id: 'c', date: new Date(now - 25 * 3600000).toISOString() }),
    ]);

    renderLayout();
    await openNotifications();

    expect(screen.getByText('Il y a 5 min')).toBeInTheDocument();
    expect(screen.getByText('Il y a 2 h')).toBeInTheDocument();
    expect(screen.getByText('Il y a 1 j')).toBeInTheDocument();
  });

  it('marque la notification comme lue au clic et recharge la liste', async () => {
    mocks.getNotifications.mockResolvedValue([makeNotif()]);

    renderLayout();
    await openNotifications();

    await userEvent.click(screen.getByRole('button', { name: /Demande de réservation/ }));

    expect(mocks.markAsRead).toHaveBeenCalledWith('n1');
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(2));
  });

  it('marque toutes les notifications d’un coup', async () => {
    mocks.getNotifications.mockResolvedValue([makeNotif()]);

    renderLayout();
    await openNotifications();

    await userEvent.click(screen.getByRole('button', { name: 'Tout marquer lu' }));

    expect(mocks.markAllAsRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(2));
  });

  it('referme le panneau quand on clique en dehors', async () => {
    renderLayout();
    await openNotifications();

    fireEvent.mouseDown(document.body);

    await waitFor(() =>
      expect(document.querySelector('.notif-dropdown')).toBeNull(),
    );
  });

  it('referme le panneau quand on navigue', async () => {
    renderLayout();
    await openNotifications();
    expect(document.querySelector('.notif-dropdown')).not.toBeNull();

    await userEvent.click(screen.getByRole('link', { name: 'Profil' }));

    await waitFor(() =>
      expect(document.querySelector('.notif-dropdown')).toBeNull(),
    );
    expect(screen.getByText('Contenu profil')).toBeInTheDocument();
  });

  it('interroge les notifications toutes les 30 secondes', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

    renderLayout();
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mocks.getNotifications).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mocks.getNotifications).toHaveBeenCalledTimes(3);
  });
});

describe('vérification d’une réservation depuis la cloche', () => {
  it('ne propose pas « Vérifier » à un gérant non qualifié', async () => {
    mocks.getNotifications.mockResolvedValue([makeNotif()]);

    renderLayout();
    await openNotifications();

    expect(screen.queryByRole('button', { name: 'Vérifier' })).toBeNull();
  });

  it('affiche l’état de chargement puis le résultat « Disponible »', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);
    mocks.getNotifications.mockResolvedValue([makeNotif()]);
    let resolveRes: ((value: unknown[]) => void) | null = null;
    mocks.getReservations.mockImplementation(
      () => new Promise((resolve) => { resolveRes = resolve; }),
    );

    renderLayout();
    await openNotifications();
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(screen.getByText('Vérification de la disponibilité...')).toBeInTheDocument();
    expect(document.querySelector('.verify-modal__room')).toHaveTextContent('Studio Ayida');

    await act(async () => { resolveRes?.([reservation]); });

    expect(await screen.findByRole('heading', { name: 'Disponible' })).toBeInTheDocument();
    expect(mocks.checkDateConflict).toHaveBeenCalledWith(
      'room-1',
      '2026-03-01',
      '2026-03-05',
      'res-1',
    );
  });

  it('annonce « Non disponible » quand les dates se chevauchent', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);
    mocks.getNotifications.mockResolvedValue([makeNotif()]);
    mocks.checkDateConflict.mockResolvedValue({ hasConflict: true });

    renderLayout();
    await openNotifications();
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(
      await screen.findByRole('heading', { name: 'Non disponible' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/n'est pas disponible pour les dates demandées/),
    ).toBeInTheDocument();
  });

  it('annonce « Non disponible » quand la réservation est introuvable', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);
    mocks.getNotifications.mockResolvedValue([makeNotif()]);
    mocks.getReservations.mockResolvedValue([]);

    renderLayout();
    await openNotifications();
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(
      await screen.findByRole('heading', { name: 'Non disponible' }),
    ).toBeInTheDocument();
    expect(mocks.checkDateConflict).not.toHaveBeenCalled();
  });

  it('retombe sur « Non disponible » quand l’API de réservation échoue', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);
    mocks.getNotifications.mockResolvedValue([makeNotif()]);
    mocks.getReservations.mockRejectedValue(new Error('réseau'));

    renderLayout();
    await openNotifications();
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(
      await screen.findByRole('heading', { name: 'Non disponible' }),
    ).toBeInTheDocument();
  });

  it('confirme la réservation et notifie le client', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);
    mocks.getNotifications.mockResolvedValue([makeNotif()]);

    renderLayout();
    await openNotifications();
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    await screen.findByRole('heading', { name: 'Disponible' });

    await userEvent.click(
      screen.getByRole('button', { name: /Disponible — Confirmer/ }),
    );

    expect(mocks.updateReservationStatut).toHaveBeenCalledWith('res-1', 'confirmee');
    expect(mocks.addClientNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reservation_confirmed',
        roomTitle: 'Studio Ayida',
        clientEmail: 'koffi@mail.ci',
      }),
    );
    expect(mocks.markAsRead).toHaveBeenCalledWith('n1');
    await waitFor(() => expect(document.querySelector('.verify-overlay')).toBeNull());
  });

  it('refuse la réservation et notifie le client du refus', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);
    mocks.getNotifications.mockResolvedValue([makeNotif()]);
    mocks.checkDateConflict.mockResolvedValue({ hasConflict: true });

    renderLayout();
    await openNotifications();
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    await screen.findByRole('heading', { name: 'Non disponible' });

    await userEvent.click(
      screen.getByRole('button', { name: /Non disponible — Refuser/ }),
    );

    expect(mocks.updateReservationStatut).toHaveBeenCalledWith('res-1', 'annulee');
    expect(mocks.addClientNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reservation_rejected' }),
    );
    await waitFor(() => expect(document.querySelector('.verify-overlay')).toBeNull());
  });

  it('ferme la modale via « Annuler » sans toucher à la réservation', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);
    mocks.getNotifications.mockResolvedValue([makeNotif()]);

    renderLayout();
    await openNotifications();
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    await screen.findByRole('heading', { name: 'Disponible' });

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(document.querySelector('.verify-overlay')).toBeNull();
    expect(mocks.updateReservationStatut).not.toHaveBeenCalled();
    expect(mocks.addClientNotification).not.toHaveBeenCalled();
  });

  it('ferme la modale en cliquant sur le fond', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);
    mocks.getNotifications.mockResolvedValue([makeNotif()]);

    const { container } = renderLayout();
    await openNotifications();
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier' }));
    await screen.findByRole('heading', { name: 'Disponible' });

    const overlay = container.querySelector('.verify-overlay');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);

    await waitFor(() => expect(document.querySelector('.verify-overlay')).toBeNull());
  });
});

describe('identité et déconnexion', () => {
  it('affiche le prénom du gérant avec ses badges vérifié et premium', async () => {
    mocks.getMe.mockResolvedValue(gerantQualifie);

    renderLayout();

    const name = await screen.findByText(/Awa/);
    const container = name.closest('.sidebar__user-name');
    expect(container).not.toBeNull();
    const badges = container!.querySelectorAll('.verified-badge');
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveAttribute('title', 'Gérant vérifié');
    expect(badges[1]).toHaveAttribute('title', 'Gérant Premium');
  });

  it('n’affiche aucun badge pour un gérant ni vérifié ni premium', async () => {
    renderLayout();

    const name = await screen.findByText(/Awa/);
    const container = name.closest('.sidebar__user-name');
    expect(container!.querySelectorAll('.verified-badge')).toHaveLength(0);
  });

  it('retombe sur le prénom Clerk quand le gérant n’en a pas', async () => {
    mocks.getMe.mockResolvedValue({ ...gerantBrouillon, prenom: '' });
    mocks.user = { firstName: 'Clerk Prénom' };

    renderLayout();

    expect(await screen.findByText(/Clerk Prénom/)).toBeInTheDocument();
  });

  it('déconnecte vers la page de connexion du marché courant', async () => {
    renderLayout();

    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));

    expect(mocks.signOut).toHaveBeenCalledWith({ redirectUrl: '/ci/login' });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('construit l’URL de déconnexion depuis le marché BJ', async () => {
    renderLayout('/bj/gerant');

    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));

    expect(mocks.signOut).toHaveBeenCalledWith({ redirectUrl: '/bj/login' });
  });

  it('retombe sur la page d’accueil du marché sans clé Clerk', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.resetModules();
    const freshLayout = await import('./AdminLayout');
    const freshMarket = await import('../../contexts/MarketContext');

    render(
      <MemoryRouter initialEntries={['/ci/gerant']}>
        <freshMarket.MarketProvider>
          <Routes>
            <Route path="/:market/gerant" element={<freshLayout.default />}>
              <Route index element={<p>Contenu aperçu</p>} />
            </Route>
          </Routes>
          <LocationProbe />
        </freshMarket.MarketProvider>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));

    expect(mocks.signOut).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/ci'),
    );
  });
});
