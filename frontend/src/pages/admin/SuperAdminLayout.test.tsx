import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import SuperAdminLayout from './SuperAdminLayout';
import type { AdminData, AdminNotification } from '../../lib/adminApi';

const mocks = vi.hoisted(() => ({
  getMe: vi.fn<() => Promise<AdminData>>(),
  getNotifications: vi.fn<
    () => Promise<{ notifications: AdminNotification[]; unread_count: number }>
  >(),
  markNotificationRead: vi.fn<(id: string) => Promise<void>>(),
  checkAvailability: vi.fn<(id: string) => Promise<{ statut: string; reason: string | null }>>(),
  setAdminToken: vi.fn<(token: string | null) => void>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    getMe: mocks.getMe,
    getNotifications: mocks.getNotifications,
    markNotificationRead: mocks.markNotificationRead,
    checkAvailability: mocks.checkAvailability,
  },
  setAdminToken: mocks.setAdminToken,
}));

function makeAdmin(overrides: Partial<AdminData> = {}): AdminData {
  return {
    id: 'adm-1',
    email: 'root@ilehya.ci',
    nom: 'Bar',
    prenom: 'Awa',
    ...overrides,
  };
}

function makeNotif(overrides: Partial<AdminNotification> = {}): AdminNotification {
  return {
    id: 'n-1',
    type: 'reservation',
    room_title: 'Studio Ayida',
    room_id: 'room-1',
    client_name: 'Koffi',
    client_email: 'koffi@mail.ci',
    client_phone: '+225010203040',
    message: 'Demande de réservation',
    reservation_id: 'res-1',
    read: false,
    date: new Date(Date.now() - 5 * 60000 - 30000).toISOString(),
    ...overrides,
  };
}

const demande = makeNotif();
const annulee = makeNotif({
  id: 'n-2',
  type: 'reservation_cancelled',
  room_title: 'Loft Ouidah',
  reservation_id: 'res-2',
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function GoTo({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="go-to" onClick={() => navigate(to)}>
      {label}
    </button>
  );
}

function layoutRoute(path: string) {
  return (
    <Route path={path} element={<SuperAdminLayout />}>
      <Route index element={<p>Contenu tableau de bord</p>} />
      <Route path="reservations" element={<p>Contenu réservations</p>} />
      <Route path="gerants" element={<p>Contenu gérants</p>} />
      <Route path="banners" element={<p>Contenu bannières</p>} />
      <Route path="evenements" element={<p>Contenu événements</p>} />
      <Route path="promotions" element={<p>Contenu promotions</p>} />
      <Route path="mot-de-passe" element={<p>Contenu mot de passe</p>} />
    </Route>
  );
}

function renderLayout(entry = '/admin') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {layoutRoute('/admin')}
        {layoutRoute('/:market/admin')}
        <Route path="/admin/login" element={<p>Connexion admin</p>} />
        <Route path="/:market/admin/login" element={<p>Connexion admin</p>} />
      </Routes>
      <GoTo to="/bj/admin" label="Aller au Bénin" />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function user() {
  return userEvent.setup({ delay: null, pointerEventsCheck: 0 });
}

function root() {
  const el = document.querySelector('.admin');
  if (!el) throw new Error('racine .admin introuvable');
  return el as HTMLElement;
}

function bell() {
  return screen.getByRole('button', { name: /^Notifications/ });
}

async function openNotifs() {
  const u = user();
  await u.click(bell());
  const el = document.querySelector('.notif-dropdown');
  if (!el) throw new Error('panneau de notifications absent');
  return within(el as HTMLElement);
}

function navLink(name: RegExp) {
  return screen.getByRole('link', { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.getMe.mockResolvedValue(makeAdmin());
  mocks.getNotifications.mockResolvedValue({ notifications: [demande], unread_count: 1 });
  mocks.markNotificationRead.mockResolvedValue(undefined);
  mocks.checkAvailability.mockResolvedValue({ statut: 'confirmee', reason: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SuperAdminLayout — navigation de la barre latérale', () => {
  it("affiche le logo, le groupe d'administration et le pied de panneau", () => {
    const { container } = renderLayout();

    expect(container.querySelector('aside.sidebar')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Logo Linkhoo' })).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
    expect(container.querySelector('nav.sidebar__nav')).not.toBeNull();
    expect(screen.getByText('Contenu tableau de bord')).toBeInTheDocument();
  });

  it("construit les sept liens de navigation depuis la route racine", () => {
    renderLayout('/admin');

    expect(navLink(/Tableau de bord/)).toHaveAttribute('href', '/admin');
    expect(navLink(/Réservations/)).toHaveAttribute('href', '/admin/reservations');
    expect(navLink(/Gérants/)).toHaveAttribute('href', '/admin/gerants');
    expect(navLink(/Bannières/)).toHaveAttribute('href', '/admin/banners');
    expect(navLink(/Événements/)).toHaveAttribute('href', '/admin/evenements');
    expect(navLink(/Promotions/)).toHaveAttribute('href', '/admin/promotions');
    expect(navLink(/Mot de passe/)).toHaveAttribute('href', '/admin/mot-de-passe');
  });

  it("préfixe tous les liens du marché détecté dans l'URL", () => {
    renderLayout('/ci/admin');

    expect(navLink(/Tableau de bord/)).toHaveAttribute('href', '/ci/admin');
    expect(navLink(/Réservations/)).toHaveAttribute('href', '/ci/admin/reservations');
    expect(navLink(/Gérants/)).toHaveAttribute('href', '/ci/admin/gerants');
    expect(navLink(/Bannières/)).toHaveAttribute('href', '/ci/admin/banners');
    expect(navLink(/Événements/)).toHaveAttribute('href', '/ci/admin/evenements');
    expect(navLink(/Promotions/)).toHaveAttribute('href', '/ci/admin/promotions');
    expect(navLink(/Mot de passe/)).toHaveAttribute('href', '/ci/admin/mot-de-passe');
  });

  it("marque le tableau de bord comme lien actif uniquement à la racine", () => {
    renderLayout('/admin');

    expect(navLink(/Tableau de bord/)).toHaveClass('sidebar__link--active');
    expect(navLink(/Réservations/)).not.toHaveClass('sidebar__link--active');
    expect(navLink(/Gérants/)).not.toHaveClass('sidebar__link--active');
  });

  it("marque la page courante comme lien actif sur une sous-route", async () => {
    const { container } = renderLayout('/admin/reservations');

    expect(navLink(/Réservations/)).toHaveClass('sidebar__link--active');
    expect(navLink(/Tableau de bord/)).not.toHaveClass('sidebar__link--active');
    expect(container.querySelector('.admin-content')).not.toBeNull();
    expect(screen.getByText('Contenu réservations')).toBeInTheDocument();
    expect(screen.queryByText('Contenu tableau de bord')).not.toBeInTheDocument();
  });

  it('affiche le prénom de l’administrateur chargé', async () => {
    renderLayout();

    expect(await screen.findByText('Awa')).toBeInTheDocument();
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
  });

  it("affiche l'email quand l'administrateur n'a pas de prénom", async () => {
    mocks.getMe.mockResolvedValue(makeAdmin({ prenom: '' }));

    renderLayout();

    expect(await screen.findByText('root@ilehya.ci')).toBeInTheDocument();
    expect(screen.queryByText('Awa')).not.toBeInTheDocument();
  });

  it("retombe sur « Admin » quand le profil ne peut pas être chargé", async () => {
    mocks.getMe.mockRejectedValue(new Error('401'));

    renderLayout();

    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(mocks.getNotifications).toHaveBeenCalled();
  });

  it("restaure l'état replié mémorisé dans localStorage au montage", () => {
    localStorage.setItem('admin-sidebar', 'true');

    renderLayout();

    expect(root()).toHaveClass('collapsed');
    expect(screen.getByRole('button', { name: 'Déplier' })).toBeInTheDocument();
  });

  it('replie la barre au clic, change le libellé et persiste le choix', async () => {
    const u = user();
    renderLayout();

    expect(root()).not.toHaveClass('collapsed');
    expect(screen.getByRole('button', { name: 'Replier' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Replier' }));

    expect(root()).toHaveClass('collapsed');
    expect(screen.getByRole('button', { name: 'Déplier' })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('admin-sidebar')).toBe('true'));

    await u.click(screen.getByRole('button', { name: 'Déplier' }));

    expect(root()).not.toHaveClass('collapsed');
    await waitFor(() => expect(localStorage.getItem('admin-sidebar')).toBe('false'));
  });
});

describe('SuperAdminLayout — menu mobile', () => {
  it('ouvre le menu mobile avec le fond noir', async () => {
    const u = user();
    const { container } = renderLayout();

    expect(root()).not.toHaveClass('mobile-open');
    expect(container.querySelector('.sidebar-backdrop')).toBeNull();

    await u.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));

    expect(root()).toHaveClass('mobile-open');
    expect(container.querySelector('.sidebar-backdrop')).not.toBeNull();
  });

  it('referme le menu avec le bouton Fermer le menu', async () => {
    const u = user();
    renderLayout();

    await u.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    expect(root()).toHaveClass('mobile-open');

    await u.click(screen.getByRole('button', { name: 'Fermer le menu' }));

    expect(root()).not.toHaveClass('mobile-open');
  });

  it('referme le menu en cliquant sur le fond noir', async () => {
    const u = user();
    renderLayout();

    await u.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    fireEvent.click(document.querySelector('.sidebar-backdrop') as Element);

    expect(root()).not.toHaveClass('mobile-open');
  });

  it('referme le menu et les notifications quand le marché change', async () => {
    const u = user();
    renderLayout('/ci/admin');

    await u.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    await openNotifs();
    expect(root()).toHaveClass('mobile-open');
    expect(document.querySelector('.notif-dropdown')).not.toBeNull();

    await u.click(screen.getByTestId('go-to'));

    expect(screen.getByTestId('location')).toHaveTextContent('/bj/admin');
    expect(root()).not.toHaveClass('mobile-open');
    expect(document.querySelector('.notif-dropdown')).toBeNull();
  });
});

describe('SuperAdminLayout — déconnexion', () => {
  it('déconnecte et rejoint la connexion racine', async () => {
    const u = user();
    renderLayout('/admin');

    await u.click(screen.getByRole('button', { name: 'Déconnexion' }));

    expect(mocks.setAdminToken).toHaveBeenCalledWith(null);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/login'));
    expect(screen.getByText('Connexion admin')).toBeInTheDocument();
  });

  it('déconnecte et rejoint la connexion du marché courant', async () => {
    const u = user();
    renderLayout('/ci/admin');

    await u.click(screen.getByRole('button', { name: 'Déconnexion' }));

    expect(mocks.setAdminToken).toHaveBeenCalledWith(null);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/ci/admin/login'),
    );
    expect(screen.getByText('Connexion admin')).toBeInTheDocument();
  });
});

describe('SuperAdminLayout — notifications', () => {
  it('affiche le compteur non lu sur la cloche et en pastille de navigation', async () => {
    renderLayout();

    await waitFor(() => expect(document.querySelector('.topbar__badge')).not.toBeNull());
    const badge = document.querySelector('.topbar__badge');
    expect(badge?.textContent).toBe('1');
    const pill = document.querySelector('.sidebar__pill');
    expect(pill?.textContent).toBe('1');
    expect(navLink(/Réservations/)).toHaveTextContent('1');
    expect(navLink(/Gérants/)).not.toHaveTextContent('1');
  });

  it("n'affiche aucun compteur quand toutes les notifications sont lues", async () => {
    mocks.getNotifications.mockResolvedValue({
      notifications: [makeNotif({ read: true })],
      unread_count: 0,
    });

    renderLayout();

    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.topbar__badge')).toBeNull();
    expect(document.querySelector('.sidebar__pill')).toBeNull();
    expect(screen.queryByText('1')).toBeNull();
  });

  it("ouvre le panneau et affiche l'état vide sans notification", async () => {
    mocks.getNotifications.mockResolvedValue({ notifications: [], unread_count: 0 });

    renderLayout();
    const scope = await openNotifs();

    expect(scope.getByText('Notifications')).toBeInTheDocument();
    expect(scope.getByText('Aucune notification')).toBeInTheDocument();
    expect(scope.queryByRole('button', { name: 'Tout marquer lu' })).toBeNull();
  });

  it("détaille la demande de réservation avec son client et son ancienneté", async () => {
    renderLayout();
    const scope = await openNotifs();

    expect(scope.getByText('Demande de réservation pour')).toBeInTheDocument();
    expect(scope.getByText('Studio Ayida')).toBeInTheDocument();
    expect(scope.getByText('Koffi · koffi@mail.ci')).toBeInTheDocument();
    expect(scope.getByText('Il y a 5 min')).toBeInTheDocument();
    expect(scope.getByRole('button', { name: 'Tout marquer lu' })).toBeInTheDocument();
  });

  it('détaille une réservation annulée différemment', async () => {
    mocks.getNotifications.mockResolvedValue({
      notifications: [annulee],
      unread_count: 1,
    });

    renderLayout();
    const scope = await openNotifs();

    expect(scope.getByText('Réservation pour')).toBeInTheDocument();
    expect(scope.getByText('annulée')).toBeInTheDocument();
    expect(scope.getByText('Loft Ouidah')).toBeInTheDocument();
    expect(scope.queryByText('Demande de réservation pour')).toBeNull();
  });

  it("n'affiche pas le client dont les coordonnées sont absentes", async () => {
    mocks.getNotifications.mockResolvedValue({
      notifications: [makeNotif({ client_name: null, client_email: null })],
      unread_count: 1,
    });

    renderLayout();
    const scope = await openNotifs();

    expect(scope.queryByText(/Koffi/)).toBeNull();
    expect(scope.getByText('Studio Ayida')).toBeInTheDocument();
  });

  it("formate les anciennetés en instant, minutes, heures et jours", async () => {
    const now = Date.now();
    mocks.getNotifications.mockResolvedValue({
      notifications: [
        makeNotif({ id: 'n-a', date: new Date(now - 10000).toISOString() }),
        makeNotif({ id: 'n-b', date: new Date(now - 5 * 60000 - 30000).toISOString() }),
        makeNotif({ id: 'n-c', date: new Date(now - 2 * 3600000 - 30000).toISOString() }),
        makeNotif({ id: 'n-d', date: new Date(now - 3 * 86400000 - 3600000).toISOString() }),
      ],
      unread_count: 0,
    });

    renderLayout();
    await openNotifs();

    expect(screen.getByText("À l'instant")).toBeInTheDocument();
    expect(screen.getByText('Il y a 5 min')).toBeInTheDocument();
    expect(screen.getByText('Il y a 2 h')).toBeInTheDocument();
    expect(screen.getByText('Il y a 3 j')).toBeInTheDocument();
  });

  it('marque la notification non lue au clic puis recharge la liste', async () => {
    renderLayout();
    await openNotifs();

    fireEvent.click(screen.getByRole('button', { name: /Demande de réservation/ }));

    await waitFor(() => expect(mocks.markNotificationRead).toHaveBeenCalledTimes(1));
    expect(mocks.markNotificationRead).toHaveBeenCalledWith('n-1');
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(2));
  });

  it('ne marque pas une notification déjà lue', async () => {
    mocks.getNotifications.mockResolvedValue({
      notifications: [makeNotif({ read: true })],
      unread_count: 0,
    });

    renderLayout();
    const scope = await openNotifs();

    const item = scope.getByText('Studio Ayida').closest('button');
    expect(item).not.toBeNull();
    fireEvent.click(item as HTMLElement);

    expect(mocks.markNotificationRead).not.toHaveBeenCalled();
    expect(mocks.getNotifications).toHaveBeenCalledTimes(1);
  });

  it('marque toutes les notifications non lues d’un seul geste', async () => {
    mocks.getNotifications.mockResolvedValue({
      notifications: [
        demande,
        makeNotif({ id: 'n-3', room_title: 'Villa Ganvié', reservation_id: 'res-3' }),
        makeNotif({ id: 'n-4', read: true, room_title: 'Déjà lu' }),
      ],
      unread_count: 2,
    });

    renderLayout();
    const scope = await openNotifs();

    await user().click(scope.getByRole('button', { name: 'Tout marquer lu' }));

    await waitFor(() => expect(mocks.markNotificationRead).toHaveBeenCalledTimes(2));
    expect(mocks.markNotificationRead).toHaveBeenCalledWith('n-1');
    expect(mocks.markNotificationRead).toHaveBeenCalledWith('n-3');
    expect(mocks.markNotificationRead).not.toHaveBeenCalledWith('n-4');
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(2));
  });

  it('referme le panneau en cliquant à l’extérieur', async () => {
    renderLayout();
    await openNotifs();
    expect(document.querySelector('.notif-dropdown')).not.toBeNull();

    fireEvent.mouseDown(document.body);

    expect(document.querySelector('.notif-dropdown')).toBeNull();
  });

  it('conserve le panneau quand on clique à l’intérieur', async () => {
    renderLayout();
    await openNotifs();

    fireEvent.mouseDown(bell());

    expect(document.querySelector('.notif-dropdown')).not.toBeNull();
  });

  it("ignore silencieusement l'échec de chargement des notifications", async () => {
    mocks.getNotifications.mockRejectedValue(new Error('réseau coupé'));

    renderLayout();

    expect(await screen.findByText('Awa')).toBeInTheDocument();
    expect(document.querySelector('.topbar__badge')).toBeNull();
    expect(document.querySelector('.sidebar__pill')).toBeNull();
    await openNotifs();
    expect(screen.getByText('Aucune notification')).toBeInTheDocument();
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

  it('arrête le polling au démontage', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { unmount } = renderLayout();

    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90000);
    });
    expect(mocks.getNotifications).toHaveBeenCalledTimes(1);
  });
});

describe('SuperAdminLayout — traitement d’une réservation', () => {
  it("n'affiche le bouton Traiter que pour une demande non lue avec réservation", async () => {
    mocks.getNotifications.mockResolvedValue({
      notifications: [
        demande,
        annulee,
        makeNotif({ id: 'n-5', reservation_id: null, room_title: 'Sans réservation' }),
        makeNotif({ id: 'n-6', read: true, room_title: 'Déjà lu' }),
      ],
      unread_count: 3,
    });

    renderLayout();
    await openNotifs();

    expect(screen.getAllByRole('button', { name: /Traiter/ })).toHaveLength(1);
    expect(screen.getByText('Sans réservation')).toBeInTheDocument();
    expect(screen.getByText('Déjà lu')).toBeInTheDocument();
  });

  it('affiche l’état de chargement de la vérification', async () => {
    let resolveCheck: (r: { statut: string; reason: string | null }) => void = () => {};
    mocks.checkAvailability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );

    renderLayout();
    await openNotifs();

    fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));

    expect(screen.getByText('Vérification de la disponibilité...')).toBeInTheDocument();
    expect(document.querySelector('.verify-modal__room')).toHaveTextContent('Studio Ayida');
    expect(mocks.checkAvailability).toHaveBeenCalledWith('res-1');

    resolveCheck({ statut: 'confirmee', reason: null });
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Réservation confirmée' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('La chambre est disponible. Le client a été notifié.'),
    ).toBeInTheDocument();
  });

  it('marque la notification comme lue après un traitement réussi', async () => {
    renderLayout();
    await openNotifs();

    fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));

    await screen.findByRole('heading', { level: 3, name: 'Réservation confirmée' });
    await waitFor(() => expect(mocks.markNotificationRead).toHaveBeenCalledWith('n-1'));
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(2));
  });

  it("détaille les trois motifs d'annulation", async () => {
    renderLayout();
    await openNotifs();

    const cases: { reason: string; text: RegExp | string }[] = [
      { reason: 'chambre_non_disponible', text: "La chambre n'est plus disponible." },
      { reason: 'conflit_dates', text: /^Conflit de dates pour/ },
      { reason: 'delai_depose', text: 'La réservation pour a été annulée.' },
    ];

    for (const c of cases) {
      mocks.checkAvailability.mockResolvedValue({ statut: 'annulee', reason: c.reason });

      fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));

      expect(await screen.findByRole('heading', { level: 3, name: 'Réservation annulée' })).toBeInTheDocument();
      expect(screen.getByText(c.text)).toBeInTheDocument();
      expect(screen.getByText('Le client a été notifié.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
      expect(document.querySelector('.verify-modal')).toBeNull();
    }

    expect(mocks.checkAvailability).toHaveBeenCalledTimes(3);
    expect(mocks.checkAvailability).toHaveBeenNthCalledWith(1, 'res-1');
  });

  it("affiche l'erreur quand la vérification échoue", async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.checkAvailability.mockRejectedValue(new Error('pas de token'));

    renderLayout();
    await openNotifs();
    fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));

    expect(await screen.findByRole('heading', { level: 3, name: 'Erreur' })).toBeInTheDocument();
    expect(screen.getByText('pas de token')).toBeInTheDocument();
    expect(mocks.markNotificationRead).not.toHaveBeenCalled();
    expect(mocks.getNotifications).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('ne referme pas la modale pendant le chargement', async () => {
    mocks.checkAvailability.mockImplementation(() => new Promise<never>(() => {}));

    renderLayout();
    await openNotifs();
    fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));
    expect(screen.getByText('Vérification de la disponibilité...')).toBeInTheDocument();

    fireEvent.click(document.querySelector('.verify-overlay') as Element);

    expect(document.querySelector('.verify-modal')).not.toBeNull();
    expect(screen.getByText('Vérification de la disponibilité...')).toBeInTheDocument();
  });

  it('referme la modale avec le bouton Fermer', async () => {
    renderLayout();
    await openNotifs();
    fireEvent.click(screen.getByRole('button', { name: /Traiter/ }));

    await screen.findByRole('heading', { level: 3, name: 'Réservation confirmée' });
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(document.querySelector('.verify-modal')).toBeNull();
  });
});
