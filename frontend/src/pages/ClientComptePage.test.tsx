import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import type { ClientMineReservationData, ReviewData } from '../lib/api';
import ClientComptePage from './ClientComptePage';

const mocks = vi.hoisted(() => ({
  getMyReservations: vi.fn<() => Promise<unknown[]>>(),
  cancelMyReservation: vi.fn<(id: string) => Promise<unknown>>(),
  listMine: vi.fn<() => Promise<unknown[]>>(),
  createReview: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getMe: vi.fn<() => Promise<unknown>>(),
  updateMe: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  setAuthTokenGetter: vi.fn<(...args: unknown[]) => void>(),
  getToken: vi.fn<() => Promise<string | null>>(),
  signOut: vi.fn<() => Promise<void>>(),
  request: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  cachedGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  unreadMessages: vi.fn<() => Promise<{ count: number }>>(),
  clerk: {
    isLoaded: true,
    isSignedIn: true,
    user: null as unknown,
  },
}));

// Réseau verrouillé : `request`/`cachedGet` rejettent, et chaque méthode
// utilisée par la page est remplacée par un mock explicite.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    request: mocks.request,
    cachedGet: mocks.cachedGet,
    setAuthTokenGetter: mocks.setAuthTokenGetter,
    apiClients: { ...actual.apiClients, getMe: mocks.getMe, updateMe: mocks.updateMe },
    apiReviews: { ...actual.apiReviews, listMine: mocks.listMine, create: mocks.createReview },
    apiMessages: { ...actual.apiMessages, unread: mocks.unreadMessages },
  };
});

// statutLabels / statutColors restent les valeurs réelles.
vi.mock('../lib/reservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/reservations')>();
  return {
    ...actual,
    getMyReservations: mocks.getMyReservations,
    cancelMyReservation: mocks.cancelMyReservation,
  };
});

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: mocks.clerk.user }),
  useAuth: () => ({
    isLoaded: mocks.clerk.isLoaded,
    isSignedIn: mocks.clerk.isSignedIn,
    getToken: mocks.getToken,
  }),
  useClerk: () => ({ signOut: mocks.signOut }),
}));

/** Les statuts affichés dépendent des dates du séjour : on les garde
 *  relatives à aujourd'hui pour que la suite de tests ne vieillisse pas. */
const isoOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const RESERVATIONS: ClientMineReservationData[] = [
  {
    id: 'res1',
    room_id: 'room1',
    room_title: 'Suite vue mer',
    date_debut: isoOffset(2),
    date_fin: isoOffset(5),
    duree_nombre: 3,
    duree_unite: 'nuit',
    statut: 'confirmee',
    created_at: '2026-02-01T10:00:00.000Z',
    montant: 75000,
    responded_at: '2026-02-02T10:00:00.000Z',
    room: { img: '/images/suite.jpg', alt: 'Suite', description: 'Belle suite avec terrasse' },
  },
  {
    id: 'res2',
    room_id: 'room2',
    room_title: 'Bungalow cocody',
    date_debut: isoOffset(10),
    date_fin: isoOffset(12),
    duree_nombre: 2,
    duree_unite: 'nuit',
    statut: 'en_attente',
    created_at: '2026-04-01T10:00:00.000Z',
    montant: null,
    responded_at: null,
    room: null,
  },
  {
    id: 'res3',
    room_id: 'room3',
    room_title: 'Loft plateau',
    date_debut: isoOffset(-60),
    date_fin: isoOffset(-57),
    duree_nombre: 4,
    duree_unite: 'nuit',
    statut: 'annulee',
    created_at: '2025-10-01T10:00:00.000Z',
    montant: 100000,
    responded_at: '2025-10-02T10:00:00.000Z',
    room: { img: '/images/loft.jpg', alt: null, description: null },
  },
  {
    id: 'res4',
    room_id: 'room4',
    room_title: 'Chambre vue',
    date_debut: isoOffset(-40),
    date_fin: isoOffset(-38),
    duree_nombre: 2,
    duree_unite: 'nuit',
    statut: 'confirmee',
    created_at: '2025-12-01T10:00:00.000Z',
    montant: 40000,
    responded_at: '2025-12-02T10:00:00.000Z',
    room: { img: null, alt: null, description: null },
  },
];

const REVIEWS: ReviewData[] = [
  {
    id: 'rv4',
    room_id: 'room4',
    gerant_id: 'g1',
    client_name: 'Moi',
    reservation_id: 'res4',
    note_appartement: 5,
    note_gerant: 4,
    commentaire: 'Très bon séjour',
    created_at: '2026-01-08T10:00:00.000Z',
  },
];

const CLERK_USER = {
  firstName: 'Aya',
  lastName: 'Kouassi',
  createdAt: '2024-01-15T00:00:00.000Z',
  primaryEmailAddress: { emailAddress: 'aya@test.com' },
  emailAddresses: [],
};

function SearchRouteProbe() {
  const location = useLocation();
  return <div data-testid="search-route">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(entry = '/ci/compte') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Routes>
          <Route path="/:market/compte" element={<ClientComptePage />} />
          <Route path="/:market/recherche" element={<SearchRouteProbe />} />
          <Route path="/:market" element={<div data-testid="home">Accueil du marché</div>} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

async function renderLoaded(entry = '/ci/compte?view=stays') {
  const view = renderPage(entry);
  await screen.findAllByText('Suite vue mer');
  return view;
}

async function renderProfile(entry = '/ci/compte?view=profile') {
  const view = renderPage(entry);
  await screen.findByLabelText('Prénom');
  return view;
}

function mustFind<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`élément introuvable : ${selector}`);
  return el;
}

function cards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.rs'));
}

function cardByTitle(title: string): HTMLElement {
  const found = cards().find((c) => c.querySelector('h3')?.textContent === title);
  if (!found) throw new Error(`carte introuvable : ${title}`);
  return found;
}

/** Même formatage que la page (date locale, jour/mois abrégé/année). */
function fmtDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clerk = { isLoaded: true, isSignedIn: true, user: CLERK_USER };
  mocks.request.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.cachedGet.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.unreadMessages.mockResolvedValue({ count: 0 });
  mocks.getToken.mockResolvedValue('token-test');
  mocks.signOut.mockResolvedValue(undefined);
  mocks.getMyReservations.mockResolvedValue(RESERVATIONS);
  mocks.listMine.mockResolvedValue(REVIEWS);
  mocks.createReview.mockResolvedValue({ id: 'rv1' });
  mocks.getMe.mockResolvedValue({ nom: 'Kouassi', prenom: 'Aya', telephone: '+2250707070707' });
  mocks.updateMe.mockResolvedValue({});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ClientComptePage — états de chargement', () => {
  it('affiche le chargement des réservations', () => {
    mocks.getMyReservations.mockReturnValue(new Promise<ClientMineReservationData[]>(() => {}));

    renderPage('/ci/compte?view=stays');

    expect(screen.getByText('Chargement de vos réservations…')).toBeInTheDocument();
    expect(document.querySelector('.rs')).toBeNull();
  });

  it("n'interroge rien tant que Clerk n'est pas chargé", () => {
    mocks.clerk = { isLoaded: false, isSignedIn: true, user: CLERK_USER };

    renderPage('/ci/compte?view=stays');

    expect(screen.getByText('Chargement de vos réservations…')).toBeInTheDocument();
    expect(mocks.getMyReservations).not.toHaveBeenCalled();
  });

  it("affiche l'état vide avec un lien vers l'accueil", async () => {
    mocks.getMyReservations.mockResolvedValue([]);

    renderPage('/ci/compte?view=stays');

    expect(await screen.findByText('Aucune réservation pour le moment')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parcourir les appartements' })).toHaveAttribute('href', '/ci');
  });

  it("affiche l'erreur de l'API lors du chargement", async () => {
    mocks.getMyReservations.mockRejectedValue(new Error('Service indisponible'));

    renderPage('/ci/compte?view=stays');

    expect(await screen.findByRole('alert')).toHaveTextContent('Service indisponible');
  });

  it("affiche un message générique si l'erreur n'est pas une instance d'Error", async () => {
    mocks.getMyReservations.mockRejectedValue('boom');

    renderPage('/ci/compte?view=stays');

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger vos données.');
  });
});

describe('ClientComptePage — navigation du compte', () => {
  it("affiche l'avatar et le nom du compte Clerk dans le chrome de la page", async () => {
    await renderLoaded();

    expect(mustFind('.avatar')).toHaveTextContent('AK');
    expect(screen.getByText('Aya Kouassi')).toBeInTheDocument();
  });

  it("affiche l'email du compte sur la vue profil", async () => {
    await renderProfile();

    expect(mustFind('.client-compte__profile-aside-email')).toHaveTextContent('aya@test.com');
  });

  it("retombe sur « Client » et l'initiale C sans compte Clerk", async () => {
    mocks.clerk = { isLoaded: true, isSignedIn: true, user: null };
    mocks.getMe.mockResolvedValue({ nom: '', prenom: '', telephone: '' });

    await renderLoaded();

    expect(mustFind('.avatar')).toHaveTextContent('C');
    expect(screen.getAllByText('Client').length).toBeGreaterThan(0);
  });

  it('déconnecte et revient vers le marché', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: /Aya Kouassi/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Déconnexion' }));

    expect(await screen.findByTestId('home')).toBeInTheDocument();
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("affiche l'accès Messages avec son badge de non lus", async () => {
    mocks.unreadMessages.mockResolvedValue({ count: 4 });
    await renderLoaded();

    const link = screen.getByRole('link', { name: /Mes messages/ });
    expect(link).toHaveAttribute('href', '/ci/messages');
    expect(within(link).getByText('4')).toBeInTheDocument();
  });

  it("n'affiche pas de pastille Messages quand tout est lu", async () => {
    await renderLoaded();

    const link = screen.getByRole('link', { name: /Mes messages/ });
    expect(link.querySelector('.bd')).toBeNull();
  });
});

describe('ClientComptePage — vues', () => {
  it("ouvre sur la vue d'ensemble", async () => {
    renderPage('/ci/compte');

    expect(
      await screen.findByRole('heading', { level: 1, name: /Votre prochain séjour/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Mes réservations/ })).not.toHaveAttribute('aria-current');
  });

  it('affiche la vue « Mes réservations »', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { level: 1, name: 'Mes réservations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mes réservations/ })).toHaveAttribute('aria-current', 'page');
  });

  it('affiche le nombre de réservations en pastille', async () => {
    await renderLoaded();

    const link = screen.getByRole('link', { name: /Mes réservations/ });
    expect(within(link).getByText('4')).toBeInTheDocument();
  });

  it("bascule sur la vue profil et change le titre", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('link', { name: 'Mon profil' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Mon profil' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mon profil' })).toHaveClass('sidebar__link--active');
    expect(document.querySelector('.rs')).toBeNull();
  });
});

describe('ClientComptePage — formulaire de recherche du tableau de bord', () => {
  async function renderDashboard() {
    renderPage('/ci/compte');
    await screen.findByRole('heading', { level: 1, name: /Votre prochain séjour/ });
  }

  function submitHeroSearch() {
    const form = mustFind<HTMLFormElement>('.cdash-maq main form');
    fireEvent.submit(form);
  }

  it('transmet destination, dates et catégorie à la page de recherche', async () => {
    await renderDashboard();
    await screen.findByRole('option', { name: 'Appartements' });

    fireEvent.change(screen.getByLabelText('Où souhaitez-vous séjourner ?'), {
      target: { value: 'Cocody' },
    });
    fireEvent.change(screen.getByLabelText('Date d’arrivée'), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText('Date de départ'), { target: { value: '2026-11-15' } });
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'ci-appartements' } });

    expect(screen.getByText('12 nov. 2026')).toBeInTheDocument();
    expect(screen.getByText('15 nov. 2026')).toBeInTheDocument();

    submitHeroSearch();

    expect(await screen.findByTestId('search-route')).toHaveTextContent(
      '/ci/recherche?q=Cocody&arrivee=2026-11-12&depart=2026-11-15&categorie=ci-appartements',
    );
  });

  it('refuse une recherche avec une seule date', async () => {
    await renderDashboard();

    fireEvent.change(screen.getByLabelText('Date d’arrivée'), { target: { value: '2026-11-12' } });
    submitHeroSearch();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Renseignez la date d’arrivée et la date de départ.',
    );
    expect(screen.queryByTestId('search-route')).toBeNull();
  });

  it('refuse un départ antérieur à l’arrivée', async () => {
    await renderDashboard();

    fireEvent.change(screen.getByLabelText('Date d’arrivée'), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText('Date de départ'), { target: { value: '2026-11-10' } });
    submitHeroSearch();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La date de départ doit être postérieure à la date d’arrivée.',
    );
    expect(screen.queryByTestId('search-route')).toBeNull();
  });
});

describe('ClientComptePage — liste des réservations', () => {
  it('affiche les dates formatées, le montant et le statut', async () => {
    await renderLoaded();

    const card = cardByTitle('Suite vue mer');
    expect(card).toHaveTextContent(fmtDate(RESERVATIONS[0].date_debut));
    expect(card).toHaveTextContent(fmtDate(RESERVATIONS[0].date_fin));
    expect(card).toHaveTextContent('75 000');
    expect(card).toHaveTextContent('FCFA / nuit');
    expect(card).toHaveTextContent('Confirmée');
  });

  it('affiche la photo de la chambre avec son texte alternatif', async () => {
    await renderLoaded();

    expect(screen.getByRole('img', { name: 'Suite' })).toHaveAttribute('src', '/images/suite.jpg');
  });

  it('affiche le prix communiqué par le gérant quand le montant est absent', async () => {
    await renderLoaded();

    const card = cardByTitle('Bungalow cocody');
    expect(card).toHaveTextContent('En attente');
    expect(card).toHaveTextContent('Prix communiqué par le gérant');
    expect(card).not.toHaveTextContent('FCFA / nuit');
  });

  it("masque le bouton d'annulation sur une réservation annulée", async () => {
    await renderLoaded();

    const card = cardByTitle('Loft plateau');
    expect(card).toHaveTextContent('Annulée');
    expect(within(card).queryByRole('button', { name: 'Annuler la réservation' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Laisser un avis' })).not.toBeInTheDocument();
  });

  it('propose de noter les séjours confirmés non encore notés', async () => {
    await renderLoaded();

    expect(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Laisser un avis' })).toBeInTheDocument();
    expect(screen.getByText('Vous avez 1 séjour(s) confirmé(s) que vous pouvez noter.')).toBeInTheDocument();
  });

  it("signale un avis déjà publié pour un séjour noté", async () => {
    await renderLoaded();

    const card = cardByTitle('Chambre vue');
    expect(card).toHaveTextContent('Avis publié');
    expect(within(card).queryByRole('button', { name: 'Laisser un avis' })).not.toBeInTheDocument();
    // Le bandeau ne compte que les séjours confirmés NON encore notés :
    // « Chambre vue » est noté, il ne reste que « Suite vue mer » → 1 (et non 2).
    expect(screen.getByText('Vous avez 1 séjour(s) confirmé(s) que vous pouvez noter.')).toBeInTheDocument();
    expect(screen.queryByText(/Vous avez 2 séjour\(s\)/)).not.toBeInTheDocument();
  });

  it("affiche l'image de repli faute de photo sur la chambre sans visuel", async () => {
    await renderLoaded();

    // « Loft plateau » a bien une photo (room.img) : l'image est rendue avec le titre en alt.
    const withPhoto = cardByTitle('Loft plateau');
    expect(withPhoto.querySelector('img')).toHaveAttribute('src', '/images/loft.jpg');
    expect(withPhoto.querySelector('img')).toHaveAttribute('alt', 'Loft plateau');
    expect(withPhoto).toHaveTextContent('Annulée');

    // « Chambre vue » a room.img === null : pas d'<img>, uniquement le repli (SVG masqué).
    const withoutPhoto = cardByTitle('Chambre vue');
    expect(withoutPhoto.querySelector('img')).toBeNull();
    expect(within(withoutPhoto).queryByRole('img')).not.toBeInTheDocument();
    expect(withoutPhoto).toHaveTextContent('Terminée');
  });
});

describe('ClientComptePage — annulation', () => {
  it('annule la réservation confirmée après confirmation', async () => {
    await renderLoaded();

    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Annuler la réservation' }));

    expect(window.confirm).toHaveBeenCalledWith('Annuler cette réservation ?');
    expect(mocks.cancelMyReservation).toHaveBeenCalledWith('res1');
    expect(await within(cardByTitle('Suite vue mer')).findByText('Annulée')).toBeInTheDocument();
    expect(within(cardByTitle('Suite vue mer')).queryByRole('button', { name: 'Annuler la réservation' })).not.toBeInTheDocument();
  });

  it('affiche le remboursement en cours quand la réservation était payée', async () => {
    mocks.cancelMyReservation.mockResolvedValue({
      refund: { requested: true, status: 'processing', refundId: 'refund-1' },
    });
    await renderLoaded();

    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Annuler la réservation' }));

    const card = cardByTitle('Suite vue mer');
    expect(await within(card).findByText('Remboursement en cours')).toBeInTheDocument();
    expect(within(card).queryByText('Payée')).not.toBeInTheDocument();
  });

  it("n'annule rien quand l'utilisateur refuse", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await renderLoaded();

    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Annuler la réservation' }));

    expect(mocks.cancelMyReservation).not.toHaveBeenCalled();
    expect(cardByTitle('Suite vue mer')).toHaveTextContent('Confirmée');
  });

  it("affiche l'erreur quand l'annulation échoue", async () => {
    mocks.cancelMyReservation.mockRejectedValue(new Error('Délai dépassé'));
    await renderLoaded();

    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Annuler la réservation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Délai dépassé');
    expect(cardByTitle('Suite vue mer')).toHaveTextContent('Confirmée');
  });

  it("désactive le bouton pendant l'annulation", async () => {
    let resolveCancel: (value?: unknown) => void = () => {};
    mocks.cancelMyReservation.mockReturnValue(
      new Promise((resolve) => {
        resolveCancel = resolve;
      }),
    );
    await renderLoaded();

    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Annuler la réservation' }));

    expect(await within(cardByTitle('Suite vue mer')).findByRole('button', { name: 'Annulation…' })).toBeDisabled();

    await act(async () => {
      resolveCancel();
    });

    expect(await within(cardByTitle('Suite vue mer')).findByText('Annulée')).toBeInTheDocument();
  });
});

describe('ClientComptePage — avis', () => {
  it('ouvre le formulaire de notation pour un séjour confirmé', async () => {
    await renderLoaded();

    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Laisser un avis' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: 'Suite vue mer' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radiogroup', { name: "Note de l'appartement : 5 sur 5" })).toBeInTheDocument();
    expect(within(dialog).getByRole('radiogroup', { name: 'Note du gérant : 5 sur 5' })).toBeInTheDocument();
  });

  it('change la note de l’appartement avec les étoiles', async () => {
    await renderLoaded();
    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Laisser un avis' }));

    const dialog = screen.getByRole('dialog');
    // Les deux groupes d'étoiles portent les mêmes libellés de boutons : on cible
    // explicitement celui de l'appartement pour éviter l'ambiguïté.
    const appartement = within(dialog).getByRole('radiogroup', { name: "Note de l'appartement : 5 sur 5" });
    fireEvent.click(within(appartement).getByRole('button', { name: '3 étoiles' }));

    expect(within(dialog).getByRole('radiogroup', { name: "Note de l'appartement : 3 sur 5" })).toBeInTheDocument();
    // Le groupe du gérant n'est pas touché.
    expect(within(dialog).getByRole('radiogroup', { name: 'Note du gérant : 5 sur 5' })).toBeInTheDocument();
  });

  it('publie l’avis avec les notes et le commentaire saisis', async () => {
    await renderLoaded();
    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Laisser un avis' }));

    const dialog = screen.getByRole('dialog');
    const appartement = within(dialog).getByRole('radiogroup', { name: "Note de l'appartement : 5 sur 5" });
    fireEvent.click(within(appartement).getByRole('button', { name: '4 étoiles' }));
    fireEvent.change(within(dialog).getByPlaceholderText('Racontez votre séjour...'), {
      target: { value: 'Séjour excellent' },
    });
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(await screen.findByRole('status')).toHaveTextContent('Merci ! Votre avis a bien été publié.');
    expect(mocks.createReview).toHaveBeenCalledWith({
      reservation_id: 'res1',
      note_appartement: 4,
      note_gerant: 5,
      commentaire: 'Séjour excellent',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("affiche l'erreur quand la publication échoue", async () => {
    mocks.createReview.mockRejectedValue(new Error('Avis déjà publié'));
    await renderLoaded();
    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Laisser un avis' }));

    fireEvent.submit(screen.getByRole('dialog').querySelector('form') as HTMLFormElement);

    expect(await screen.findByRole('alert')).toHaveTextContent('Avis déjà publié');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it("désactive les actions du formulaire pendant l'envoi", async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    mocks.createReview.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    await renderLoaded();
    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Laisser un avis' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    const pending = await within(dialog).findByRole('button', { name: 'Envoi...' });
    expect(pending).toBeDisabled();
    // « Annuler » existe aussi sur les cartes de réservation : on vise celui du formulaire.
    expect(within(dialog).getByRole('button', { name: 'Annuler' })).toBeDisabled();

    await act(async () => {
      resolveCreate({ id: 'rv1' });
    });

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('ferme le formulaire sans publier', async () => {
    await renderLoaded();
    fireEvent.click(within(cardByTitle('Suite vue mer')).getByRole('button', { name: 'Laisser un avis' }));

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.createReview).not.toHaveBeenCalled();
  });
});

describe('ClientComptePage — profil', () => {
  it('pré-remplit le profil depuis l’API client', async () => {
    await renderProfile();

    expect(mocks.getMe).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Prénom')).toHaveValue('Aya');
    expect(screen.getByLabelText('Nom')).toHaveValue('Kouassi');
    expect(screen.getByLabelText('Téléphone')).toHaveValue('+2250707070707');
  });

  it('désactive le champ email géré par le compte', async () => {
    await renderProfile();

    expect(screen.getByLabelText(/^Email/)).toBeDisabled();
    expect(screen.getByLabelText(/^Email/)).toHaveValue('aya@test.com');
  });

  it('retombe sur les informations Clerk si le profil est indisponible', async () => {
    mocks.getMe.mockRejectedValue(new Error('404'));
    await renderProfile();

    expect(screen.getByLabelText('Prénom')).toHaveValue('Aya');
    expect(screen.getByLabelText('Nom')).toHaveValue('Kouassi');
    expect(screen.getByLabelText('Téléphone')).toHaveValue('');
  });

  it('enregistre les modifications du profil', async () => {
    await renderProfile();

    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '+2250505050505' } });
    fireEvent.submit(mustFind<HTMLFormElement>('.client-compte__profile-form'));

    expect(await screen.findByRole('status')).toHaveTextContent('Profil mis à jour avec succès.');
    expect(mocks.updateMe).toHaveBeenCalledWith({
      nom: 'Kouassi',
      prenom: 'Aya',
      telephone: '+2250505050505',
    });
  });

  it("affiche l'erreur quand la mise à jour échoue", async () => {
    mocks.updateMe.mockRejectedValue(new Error('Profil verrouillé'));
    await renderProfile();

    fireEvent.submit(mustFind<HTMLFormElement>('.client-compte__profile-form'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Profil verrouillé');
  });

  it("désactive le bouton pendant l'enregistrement", async () => {
    let resolveUpdate: (value: unknown) => void = () => {};
    mocks.updateMe.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    await renderProfile();

    fireEvent.submit(mustFind<HTMLFormElement>('.client-compte__profile-form'));

    expect(await screen.findByRole('button', { name: 'Enregistrement…' })).toBeDisabled();

    await act(async () => {
      resolveUpdate({});
    });

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});

describe('ClientComptePage — appels réseau', () => {
  it("branche le jeton d'authentification sur l'API", async () => {
    await renderLoaded();

    // La page et le hook de non-lus enregistrent chacun un getter : on vérifie
    // que celui qui reste en place délègue bien à Clerk.
    expect(mocks.setAuthTokenGetter).toHaveBeenCalled();
    const calls = mocks.setAuthTokenGetter.mock.calls;
    const getter = calls[calls.length - 1][0] as () => Promise<string | null>;
    expect(getter).toBeTypeOf('function');
    await expect(getter()).resolves.toBe('token-test');
    expect(mocks.getToken).toHaveBeenCalled();
  });

  it('recharge réservations et avis en une seule passe', async () => {
    await renderLoaded();

    expect(mocks.getMyReservations).toHaveBeenCalledTimes(1);
    expect(mocks.listMine).toHaveBeenCalledTimes(1);
  });

  it('masque les invitations à noter quand la liste des avis échoue', async () => {
    mocks.listMine.mockRejectedValue(new Error('404'));

    await renderLoaded();

    expect((await screen.findAllByText('Suite vue mer')).length).toBeGreaterThan(0);
    // Sans avis, on ignore quels séjours sont déjà notés : on n'annonce ni de
    // compte de séjours notables, ni de bouton « Laisser un avis » (risque de
    // doublon), mais on explique l'état dégradé — sans page en erreur.
    expect(
      await screen.findByText(/Impossible de charger vos avis/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Vous avez \d+ séjour\(s\) confirmé\(s\)/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Laisser un avis' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ne laisse partir aucune requête réseau non mockée', async () => {
    await renderLoaded();

    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.cachedGet).not.toHaveBeenCalled();
  });
});
