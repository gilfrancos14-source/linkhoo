import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import type { Room } from '../data/rooms';
import type { GerantInfo } from '../lib/api';
import { clearQueue, readQueue } from '../lib/offlineQueue';
import RoomDetailPage from './RoomDetailPage';

const mocks = vi.hoisted(() => ({
  fetchRoomsByMarket: vi.fn<(market: 'CI' | 'BJ') => Promise<unknown[]>>(),
  fetchRoomById: vi.fn<(id: string) => Promise<unknown>>(),
  fetchCategoriesByMarket: vi.fn<(market: 'CI' | 'BJ') => Promise<unknown[]>>(),
  listByRoom: vi.fn<(id: string) => Promise<unknown>>(),
  addReservation: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  request: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  cachedGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  clerk: {
    isLoaded: true,
    isSignedIn: false,
    user: null as unknown,
  },
}));

// Aucune de ces couches ne doit toucher le réseau : `request`/`cachedGet`
// rejettent, les fonctions métier sont remplacées par des mocks.
vi.mock('../lib/api', () => ({
  apiReviews: { listByRoom: mocks.listByRoom },
  request: mocks.request,
  cachedGet: mocks.cachedGet,
}));

vi.mock('../lib/reservations', () => ({
  addReservation: mocks.addReservation,
}));

vi.mock('../data/rooms', () => ({
  fetchRoomsByMarket: mocks.fetchRoomsByMarket,
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
  { id: 'cat-premium', title: 'Chambres premium', img: '/images/premium.jpg', alt: 'Premium', market: 'CI' },
];

const GERANT_VERIFIED: GerantInfo = {
  nom: 'Kouassi',
  prenom: 'Aya',
  phone: '+2250707070707',
  is_verified: true,
  is_premium: true,
};

const GERANT_PLAIN: GerantInfo = {
  nom: 'N’Guessan',
  prenom: 'Paul',
  phone: null,
  is_verified: false,
  is_premium: false,
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

const CLERK_USER = {
  firstName: 'Aya',
  lastName: 'Kouassi',
  primaryEmailAddress: { emailAddress: 'aya@test.com' },
  emailAddresses: [],
};

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    title: 'Suite vue mer',
    subtitle: 'À deux pas de la plage',
    info: 'Nouveau',
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
    ...overrides,
  };
}

function renderPage(entry = '/ci/chambre/r1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Routes>
          <Route path="/:market/chambre/:id" element={<RoomDetailPage />} />
          <Route path="/:market" element={<div data-testid="home">Accueil du marché</div>} />
          <Route path="/:market/categorie/:catId" element={<div data-testid="cat">Catégorie</div>} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

async function renderLoaded(entry = '/ci/chambre/r1') {
  const view = renderPage(entry);
  await screen.findByRole('heading', { level: 1, name: 'Suite vue mer' });
  // Le titre apparaît dès le commit de chargement, avant les effets passifs
  // (dont la conversion nuit → mois qui réécrit la durée). Sans ce flush, un
  // test qui tape dans la durée immédiatement peut se faire écraser par cet
  // effet quand la machine est chargée : la valeur atterrit à 24 au lieu de 30.
  await act(async () => {});
  return view;
}

function getForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector('form');
  if (!form) throw new Error('formulaire de réservation introuvable');
  return form;
}

function mustFind<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`élément introuvable : ${selector}`);
  return el;
}

type FormValues = Partial<Record<'name' | 'email' | 'phone' | 'dateDebut' | 'duree' | 'message', string>>;

function fillForm(values: FormValues = {}) {
  const v = {
    name: 'Jean Koffi',
    email: 'jean@test.com',
    phone: '0707070707',
    dateDebut: '2026-03-01',
    duree: '3',
    message: '',
    ...values,
  };
  fireEvent.change(screen.getByLabelText(/Nom complet/), { target: { value: v.name } });
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: v.email } });
  fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: v.phone } });
  fireEvent.change(screen.getByLabelText(/Date de début/), { target: { value: v.dateDebut } });
  fireEvent.change(screen.getByLabelText(/Durée/), { target: { value: v.duree } });
  if (v.message) {
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: v.message } });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clerk = { isLoaded: true, isSignedIn: false, user: null };
  mocks.request.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.cachedGet.mockRejectedValue(new Error('réseau interdit dans les tests'));
  mocks.fetchRoomById.mockResolvedValue(makeRoom());
  mocks.fetchCategoriesByMarket.mockResolvedValue(CATEGORIES);
  // La fiche est désormais la source unique d'affichage de la chambre.
  mocks.fetchRoomById.mockResolvedValue(makeRoom());
  mocks.listByRoom.mockResolvedValue(REVIEWS);
  mocks.addReservation.mockResolvedValue({ id: 'res-1' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('RoomDetailPage — états', () => {
  it('affiche « Chargement... » tant que la chambre n’est pas revenue', () => {
    mocks.fetchRoomById.mockReturnValue(new Promise<Room>(() => {}));

    renderPage();

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it("affiche « Chambre introuvable. » quand l'identifiant n'existe pas", async () => {
    mocks.fetchRoomById.mockRejectedValue(new Error('404'));

    renderPage('/ci/chambre/inconnu');

    expect(await screen.findByText('Chambre introuvable.')).toBeInTheDocument();
    expect(screen.getByText('Chambre introuvable')).toBeInTheDocument();
  });

  it("affiche un lien de retour à l'accueil sur la page d'erreur", async () => {
    mocks.fetchRoomById.mockRejectedValue(new Error('404'));

    renderPage('/ci/chambre/inconnu');

    const back = await screen.findByRole('link', { name: "← Retour à l'accueil" });
    expect(back).toHaveAttribute('href', '/ci');
  });

  it("affiche « Chambre introuvable. » si le chargement de la chambre échoue", async () => {
    mocks.fetchRoomById.mockRejectedValue(new Error('panne api'));

    renderPage();

    expect(await screen.findByText('Chambre introuvable.')).toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });
});

describe("RoomDetailPage — fil d'Ariane et marché", () => {
  it("affiche le fil d'Ariane avec la catégorie cliquable", async () => {
    await renderLoaded();

    const cat = screen.getByRole('link', { name: 'Chambres premium' });
    expect(cat).toHaveAttribute('href', '/ci/categorie/cat-premium');
    expect(screen.getByText('Accueil')).toHaveAttribute('href', '/ci');
    expect(mustFind<HTMLElement>('[aria-current="page"]')).toHaveTextContent('Suite vue mer');
  });

  it("n'affiche pas la catégorie quand elle est absente du référentiel", async () => {
    mocks.fetchCategoriesByMarket.mockResolvedValue([]);

    await renderLoaded();

    expect(screen.queryByRole('link', { name: 'Chambres premium' })).not.toBeInTheDocument();
    expect(screen.getByText('Accueil')).toHaveAttribute('href', '/ci');
  });

  it("construit les liens d'authentification depuis le marché de l'URL", async () => {
    mocks.fetchRoomById.mockResolvedValue(makeRoom({ market: 'BJ' }));

    await renderLoaded('/bj/chambre/r1');

    expect(screen.getByText('Accueil')).toHaveAttribute('href', '/bj');
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/bj/login');
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/bj/inscription');
  });
});

describe('RoomDetailPage — galerie', () => {
  it('affiche la photo principale et son compteur', async () => {
    await renderLoaded();

    expect(screen.getByAltText('Suite vue mer — photo 1 sur 3')).toBeInTheDocument();
    expect(screen.getByText('Photo 1 sur 3')).toBeInTheDocument();
  });

  it('avance et boucle avec les flèches de navigation', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
    expect(screen.getByText('Photo 2 sur 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Photo précédente' }));
    expect(screen.getByText('Photo 1 sur 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Photo précédente' }));
    expect(screen.getByText('Photo 3 sur 3')).toBeInTheDocument();
  });

  it('sélectionne une photo depuis ses vignettes', async () => {
    await renderLoaded();

    const thumb = screen.getByRole('button', { name: 'Voir la photo 3' });
    fireEvent.click(thumb);

    expect(screen.getByText('Photo 3 sur 3')).toBeInTheDocument();
    expect(thumb.className).toContain('is-active');
    expect(screen.getByRole('button', { name: 'Voir la photo 1' }).className).not.toContain('is-active');
  });

  it('signale l’absence de photo sans flèches ni vignettes', async () => {
    mocks.fetchRoomById.mockResolvedValue(makeRoom({ images: [] }));

    await renderLoaded();

    expect(screen.getByText('Aucune photo disponible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Photo suivante' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voir la photo 1' })).not.toBeInTheDocument();
  });
});

describe('RoomDetailPage — contenu', () => {
  it('affiche le titre, le prix, le sous-titre et la description', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { level: 1, name: 'Suite vue mer' })).toBeInTheDocument();
    expect(screen.getByText('À deux pas de la plage')).toBeInTheDocument();
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
    expect(screen.getByText(/dès/)).toHaveTextContent('25 000');
    expect(screen.getByText('Un espace lumineux avec terrasse.')).toBeInTheDocument();
  });

  it("n'affiche aucune capacité même quand le bien en porte une", async () => {
    await renderLoaded();

    expect(document.querySelector('.room-detail__capacity')).not.toBeInTheDocument();
    expect(screen.queryByText(/Capacité/)).not.toBeInTheDocument();
  });

  it("complète le sous-titre quand le bien est saisi sans lui", async () => {
    mocks.fetchRoomById.mockResolvedValue(
      makeRoom({
        subtitle: '',
        description: 'Vue sur mer, calme absolu. Proche des commerces.',
      }),
    );

    await renderLoaded();

    expect(document.querySelector('.room-detail__subtitle')).toHaveTextContent(
      'Vue sur mer, calme absolu.',
    );
  });

  it('découpe les conditions en éléments de liste', async () => {
    await renderLoaded();

    const items = document.querySelectorAll('.room-detail__conditions li');
    expect(items).toHaveLength(2);
    expect(screen.getByText('Annulation gratuite')).toBeInTheDocument();
    expect(screen.getByText('Dépôt de garantie')).toBeInTheDocument();
  });

  it("affiche la carte de l'hôte vérifié et premium", async () => {
    mocks.fetchRoomById.mockResolvedValue(makeRoom({ gerant: GERANT_VERIFIED }));

    await renderLoaded();

    expect(screen.getByRole('heading', { level: 2, name: "Votre hôte" })).toBeInTheDocument();
    expect(screen.getByText('Aya Kouassi')).toBeInTheDocument();
    expect(screen.getByText('Vérifié')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it("n'affiche pas la carte de l'hôte pour un gérant non vérifié", async () => {
    mocks.fetchRoomById.mockResolvedValue(makeRoom({ gerant: GERANT_PLAIN }));

    await renderLoaded();

    expect(screen.queryByRole('heading', { level: 2, name: "Votre hôte" })).not.toBeInTheDocument();
    expect(screen.queryByText('Paul N’Guessan')).not.toBeInTheDocument();
  });

  it("affiche le lien téléphonique de l'hôte", async () => {
    mocks.fetchRoomById.mockResolvedValue(makeRoom({ gerant: GERANT_VERIFIED }));

    await renderLoaded();

    expect(screen.getByRole('link', { name: '+2250707070707' })).toHaveAttribute('href', 'tel:+2250707070707');
  });

  it("n'affiche pas de lien téléphonique quand le gérant n'a pas de numéro", async () => {
    mocks.fetchRoomById.mockResolvedValue(makeRoom({ gerant: { ...GERANT_VERIFIED, phone: null } }));

    await renderLoaded();

    expect(screen.getByRole('heading', { level: 2, name: "Votre hôte" })).toBeInTheDocument();
    expect(document.querySelector('.host-card__phone')).toBeNull();
  });

  it("charge la chambre via fetchRoomById et affiche son gérant", async () => {
    let resolveDetail: (value: unknown) => void = () => {};
    mocks.fetchRoomById.mockReturnValue(
      new Promise((resolve) => {
        resolveDetail = resolve;
      }),
    );

    renderPage();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: "Votre hôte" })).not.toBeInTheDocument();

    await act(async () => {
      resolveDetail(makeRoom({ gerant: GERANT_VERIFIED, gerantId: 'g9' }));
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Suite vue mer' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: "Votre hôte" })).toBeInTheDocument();
    expect(mocks.fetchRoomById).toHaveBeenCalledWith('r1');
    // La page ne télécharge plus le catalogue du marché.
    expect(mocks.fetchRoomsByMarket).not.toHaveBeenCalled();
  });
});

describe('RoomDetailPage — avis', () => {
  it('affiche les moyennes de la chambre et du gérant', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { level: 2, name: 'Avis des locataires' })).toBeInTheDocument();
    const summary = mustFind<HTMLElement>('.room-reviews__summary');
    expect(summary).toHaveTextContent('★ 4.5');
    expect(summary).toHaveTextContent('(3)');
    expect(summary).toHaveTextContent('Gérant ★ 4.0');
    expect(summary).toHaveTextContent('(2)');
  });

  it('affiche le locataire, ses notes et son commentaire', async () => {
    await renderLoaded();

    expect(screen.getByText('Jeanne')).toBeInTheDocument();
    expect(screen.getByText('Appartement ★★★★★')).toBeInTheDocument();
    expect(screen.getByText('Gérant ★★★★')).toBeInTheDocument();
    expect(screen.getByText('« Super séjour »')).toBeInTheDocument();
  });

  it("masque la section d'avis quand il n'y en a aucun", async () => {
    mocks.listByRoom.mockResolvedValue(NO_REVIEWS);

    await renderLoaded();

    expect(screen.queryByRole('heading', { level: 2, name: 'Avis des locataires' })).not.toBeInTheDocument();
  });

  it("n'affiche pas la section d'avis si l'API échoue", async () => {
    mocks.listByRoom.mockRejectedValue(new Error('404'));

    await renderLoaded();

    expect(screen.queryByRole('heading', { level: 2, name: 'Avis des locataires' })).not.toBeInTheDocument();
  });

  it("masque les moyennes quand elles sont nulles", async () => {
    mocks.listByRoom.mockResolvedValue({ ...NO_REVIEWS, reviews: REVIEWS.reviews });

    await renderLoaded();

    expect(mustFind<HTMLElement>('.room-reviews__summary').children).toHaveLength(0);
    expect(screen.getByText('Jeanne')).toBeInTheDocument();
  });
});

describe('RoomDetailPage — authentification Clerk', () => {
  it('affiche l’invitation à se connecter quand l’utilisateur est déconnecté', async () => {
    await renderLoaded();

    expect(screen.getByText(/Connectez-vous pour pré-remplir/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/ci/login');
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/ci/inscription');
  });

  it("masque l'invitation une fois connecté", async () => {
    mocks.clerk = { isLoaded: true, isSignedIn: true, user: CLERK_USER };

    await renderLoaded();

    expect(screen.queryByText(/Connectez-vous pour pré-remplir/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it("affiche l'invitation tant que Clerk n'est pas chargé", async () => {
    mocks.clerk = { isLoaded: false, isSignedIn: false, user: null };

    await renderLoaded();

    expect(screen.getByText(/Connectez-vous pour pré-remplir/)).toBeInTheDocument();
  });

  it('pré-remplit le nom et l’email depuis le compte Clerk', async () => {
    mocks.clerk = { isLoaded: true, isSignedIn: true, user: CLERK_USER };

    await renderLoaded();

    expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Aya Kouassi');
    expect(screen.getByLabelText(/Email/)).toHaveValue('aya@test.com');
  });

  it('pré-remplit la date de début et la durée depuis les paramètres', async () => {
    await renderLoaded('/ci/chambre/r1?arrivee=2026-03-01&depart=2026-03-04');

    expect(screen.getByLabelText(/Date de début/)).toHaveValue('2026-03-01');
    expect((screen.getByLabelText(/Durée/) as HTMLInputElement).value).toBe('3');
  });

  it("utilise une durée de 1 quand les dates d'URL sont absentes", async () => {
    await renderLoaded();

    expect((screen.getByLabelText(/Durée/) as HTMLInputElement).value).toBe('1');
  });
});

describe('RoomDetailPage — validation', () => {
  it('signale chaque champ requis après une soumission vide', async () => {
    const { container } = await renderLoaded();

    fireEvent.submit(getForm(container));

    // La durée vaut 1 par défaut : elle est valide même sur un formulaire vide.
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    expect(screen.getByText('Veuillez renseigner votre nom.')).toBeInTheDocument();
    expect(screen.getByText('Veuillez renseigner votre email.')).toBeInTheDocument();
    expect(screen.getByText('Veuillez renseigner votre téléphone.')).toBeInTheDocument();
    expect(screen.getByText('Veuillez choisir une date de début.')).toBeInTheDocument();
    expect(screen.queryByText(/durée valide/)).not.toBeInTheDocument();
    expect(mocks.addReservation).not.toHaveBeenCalled();
  });

  it('signale un email invalide à la sortie du champ', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'pas-un-email' } });
    fireEvent.blur(screen.getByLabelText(/Email/));

    expect(screen.getByRole('alert')).toHaveTextContent('Adresse email invalide.');
  });

  it('signale un numéro de téléphone invalide', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: 'abc' } });
    fireEvent.blur(screen.getByLabelText(/Téléphone/));

    expect(screen.getByRole('alert')).toHaveTextContent('Numéro de téléphone invalide.');
  });

  it('signale la date de début vidée après saisie', async () => {
    await renderLoaded('/ci/chambre/r1?arrivee=2026-03-01');

    expect(screen.getByLabelText(/Date de début/)).toHaveValue('2026-03-01');

    // Un input type="date" rejette toute chaîne non normalisable : c'est le
    // seul chemin d'erreur atteignable depuis l'interface.
    fireEvent.change(screen.getByLabelText(/Date de début/), { target: { value: '2026-02-31' } });
    fireEvent.blur(screen.getByLabelText(/Date de début/));

    expect((screen.getByLabelText(/Date de début/) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('alert')).toHaveTextContent('Veuillez choisir une date de début.');
  });

  it('signale une durée vide', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText(/Durée/), { target: { value: '' } });
    fireEvent.blur(screen.getByLabelText(/Durée/));

    expect(screen.getByRole('alert')).toHaveTextContent('Veuillez saisir une durée valide.');
    expect(screen.getByLabelText(/Durée/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('signale une durée supérieure au maximum en nuits', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText(/Durée/), { target: { value: '999' } });
    fireEvent.blur(screen.getByLabelText(/Durée/));

    expect(screen.getByRole('alert')).toHaveTextContent('La durée maximale est de 366 nuits.');
  });

  it("efface l'erreur d'email dès que la valeur devient valide", async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'pas-un-email' } });
    fireEvent.blur(screen.getByLabelText(/Email/));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'jean@test.com' } });
    fireEvent.blur(screen.getByLabelText(/Email/));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("ne marque pas les champs tant qu'on n'a pas quitté le champ", async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText(/Nom complet/), { target: { value: '' } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('RoomDetailPage — estimation et date de fin', () => {
  it('calcule la date de fin et le montant à partir de la durée en nuits', async () => {
    await renderLoaded('/ci/chambre/r1?arrivee=2026-03-01&depart=2026-03-04');

    expect(screen.getByLabelText(/Date de fin \(calculée\)/)).toHaveValue('2026-03-04');
    const summary = screen.getByText(/estimation/);
    expect(summary).toHaveTextContent('Du 2026-03-01 au 2026-03-04');
    expect(summary).toHaveTextContent('3 nuits');
    expect(summary).toHaveTextContent(/75\s*000\s*FCFA/);
  });

  it('recalcule le montant quand la durée change', async () => {
    await renderLoaded('/ci/chambre/r1?arrivee=2026-03-01&depart=2026-03-04');

    fireEvent.change(screen.getByLabelText(/Durée/), { target: { value: '5' } });

    expect(screen.getByText(/estimation/)).toHaveTextContent(/125\s*000\s*FCFA/);
    expect(screen.getByLabelText(/Date de fin \(calculée\)/)).toHaveValue('2026-03-06');
  });

  it("n'affiche ni date de fin ni estimation sans date de début", async () => {
    await renderLoaded();

    expect(screen.queryByText(/estimation/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Date de fin \(calculée\)/)).not.toBeInTheDocument();
  });

  it("n'affiche pas d'estimation quand la durée est invalide", async () => {
    await renderLoaded('/ci/chambre/r1?arrivee=2026-03-01&depart=2026-03-04');

    fireEvent.change(screen.getByLabelText(/Durée/), { target: { value: '0' } });

    expect(screen.queryByText(/estimation/)).not.toBeInTheDocument();
  });

  it("utilise l'unité mois et borne la durée pour un bien mensuel", async () => {
    mocks.fetchRoomById.mockResolvedValue(makeRoom({ priceUnit: '/ mois' }));

    await renderLoaded('/ci/chambre/r1?arrivee=2026-03-01');

    expect(screen.getByLabelText(/Unité/)).toHaveValue('mois');
    expect(screen.getByLabelText(/Unité/)).toBeDisabled();
    expect(screen.getByLabelText(/Durée/)).toHaveAttribute('max', '24');

    fireEvent.change(screen.getByLabelText(/Date de début/), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText(/Durée/), { target: { value: '2' } });

    expect(screen.getByLabelText(/Date de fin \(calculée\)/)).toHaveValue('2026-05-01');
    const summary = screen.getByText(/estimation/);
    expect(summary).toHaveTextContent('Du 2026-03-01 au 2026-05-01');
    expect(summary).toHaveTextContent('2 mois');
    expect(summary).toHaveTextContent(/50\s*000\s*FCFA/);
  });

  it('borne la durée à 24 mois sur un bien mensuel', async () => {
    mocks.fetchRoomById.mockResolvedValue(makeRoom({ priceUnit: '/ mois' }));

    await renderLoaded('/ci/chambre/r1?arrivee=2026-03-01');

    fireEvent.change(screen.getByLabelText(/Durée/), { target: { value: '30' } });
    fireEvent.blur(screen.getByLabelText(/Durée/));

    expect(screen.getByRole('alert')).toHaveTextContent('La durée maximale est de 24 mois.');
  });
});

describe('RoomDetailPage — soumission', () => {
  it('envoie la réservation et affiche le succès', async () => {
    const { container } = await renderLoaded();

    fillForm({ message: 'Disponible ce week-end ?' });
    fireEvent.submit(getForm(container));

    expect(await screen.findByRole('status')).toHaveTextContent('Votre demande a bien été envoyée !');
    expect(mocks.addReservation).toHaveBeenCalledWith({
      clientName: 'Jean Koffi',
      clientEmail: 'jean@test.com',
      clientPhone: '0707070707',
      roomId: 'r1',
      roomTitle: 'Suite vue mer',
      dateDebut: '2026-03-01',
      dateFin: '2026-03-04',
      dureeNombre: 3,
      dureeUnite: 'nuit',
      montant: 75000,
      message: 'Disponible ce week-end ?',
      clientKey: expect.any(String),
    });
  });

  it('envoie la durée en mois pour un bien mensuel', async () => {
    mocks.fetchRoomById.mockResolvedValue(makeRoom({ priceUnit: '/ mois' }));
    const { container } = await renderLoaded('/ci/chambre/r1?arrivee=2026-03-01');

    fillForm();
    fireEvent.submit(getForm(container));

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(mocks.addReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFin: '2026-06-01',
        dureeNombre: 3,
        dureeUnite: 'mois',
        montant: 75000,
      }),
    );
  });

  it('propose de suivre la réservation sans compte', async () => {
    const { container } = await renderLoaded();

    fillForm();
    fireEvent.submit(getForm(container));

    const track = await screen.findByRole('link', { name: /Suivre ma réservation/ });
    expect(track).toHaveAttribute('href', '/ci/suivi-reservation');
  });

  it('renvoie vers le compte personnel quand on est connecté', async () => {
    mocks.clerk = { isLoaded: true, isSignedIn: true, user: CLERK_USER };
    const { container } = await renderLoaded();

    fillForm();
    fireEvent.submit(getForm(container));

    const track = await screen.findByRole('link', { name: /Suivre ma réservation/ });
    expect(track).toHaveAttribute('href', '/ci/compte');
  });

  it("affiche le message d'erreur de l'API", async () => {
    mocks.addReservation.mockRejectedValue(new Error('Service indisponible'));
    const { container } = await renderLoaded();

    fillForm();
    fireEvent.submit(getForm(container));

    expect(await screen.findByRole('alert')).toHaveTextContent('Service indisponible');
    expect(screen.getByRole('heading', { name: 'Demande de réservation' })).toBeInTheDocument();
  });

  it("affiche un message générique si l'erreur n'est pas une instance d'Error", async () => {
    mocks.addReservation.mockRejectedValue('boom');
    const { container } = await renderLoaded();

    fillForm();
    fireEvent.submit(getForm(container));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une erreur est survenue. Veuillez réessayer.',
    );
  });

  it("désactive le bouton pendant l'envoi", async () => {
    let resolveAdd: (value: unknown) => void = () => {};
    mocks.addReservation.mockReturnValue(
      new Promise((resolve) => {
        resolveAdd = resolve;
      }),
    );
    const { container } = await renderLoaded();

    fillForm();
    fireEvent.submit(getForm(container));

    const pending = await screen.findByRole('button', { name: 'Envoi en cours...' });
    expect(pending).toBeDisabled();

    await act(async () => {
      resolveAdd({ id: 'res-1' });
    });

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});

describe('RoomDetailPage — partage', () => {
  const SHARE_NAME = 'Copier le lien de cette page';

  it("copie l'adresse de la page et confirme", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await renderLoaded();

    const shareBtn = screen.getByRole('button', { name: SHARE_NAME });
    expect(shareBtn).toHaveTextContent('Partager');
    fireEvent.click(shareBtn);

    expect(await screen.findByText('Lien copié !')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("confirme aussi quand l'API clipboard n'existe pas", async () => {
    Reflect.deleteProperty(navigator, 'clipboard');

    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: SHARE_NAME }));

    expect(await screen.findByText('Lien copié !')).toBeInTheDocument();
  });

  it("réinitialise le retour au bout de 2 secondes", async () => {
    Reflect.deleteProperty(navigator, 'clipboard');
    await renderLoaded();
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: SHARE_NAME }));
    expect(screen.getByText('Lien copié !')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText('Lien copié !')).not.toBeInTheDocument();
    expect(screen.getByText('Partager')).toBeInTheDocument();
  });
});

describe('RoomDetailPage — appels réseau', () => {
  it('interroge catégories, détail et avis pour le marché de l’URL, sans catalogue complet', async () => {
    await renderLoaded('/ci/chambre/r1?arrivee=2026-03-01&depart=2026-03-04');

    expect(mocks.fetchRoomsByMarket).not.toHaveBeenCalled();
    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('CI');
    expect(mocks.fetchRoomById).toHaveBeenCalledWith('r1');
    expect(mocks.listByRoom).toHaveBeenCalledWith('r1');
  });

  it('utilise le marché indiqué dans l’URL pour les données', async () => {
    await renderLoaded('/bj/chambre/r1');

    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('BJ');
    expect(mocks.fetchRoomsByMarket).not.toHaveBeenCalled();
  });

  it('recharge les avis après une réservation envoyée', async () => {
    const { container } = await renderLoaded();

    fillForm();
    fireEvent.submit(getForm(container));
    await screen.findByRole('status');

    // Le message de confirmation s'affiche avant la recharge des avis :
    // on attend explicitement le second appel.
    await waitFor(() => expect(mocks.listByRoom).toHaveBeenCalledTimes(2));
  });

  it('ne laisse partir aucune requête réseau non mockée', async () => {
    await renderLoaded();

    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.cachedGet).not.toHaveBeenCalled();
  });
});

describe('RoomDetailPage — mode hors-ligne', () => {
  function setOnline(value: boolean): void {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => value,
    });
  }

  afterEach(() => {
    setOnline(true);
    clearQueue();
  });

  it("informe que la demande sera mise en file d'attente hors-ligne", async () => {
    setOnline(false);
    const { container } = await renderLoaded();

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('hors-ligne');
    expect(notice).toHaveTextContent(/envoyée automatiquement/);
    expect(getSubmitButton()).toBeEnabled();
    // La consultation reste possible : la fiche est bien rendue.
    expect(container.querySelector('.room-detail__title')).not.toBeNull();
  });

  it("enregistre la demande en file d'attente sans appeler l'API", async () => {
    setOnline(false);
    const { container } = await renderLoaded();

    fillForm();
    fireEvent.submit(getForm(container));

    expect(mocks.addReservation).not.toHaveBeenCalled();
    const stored = readQueue();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.type).toBe('reservation');
    expect(screen.getByText('Votre demande a été enregistrée hors-ligne.')).toBeInTheDocument();
    expect(screen.queryByText('Suivre ma réservation')).not.toBeInTheDocument();
  });

  it("envoie la demande enregistrée quand la connexion revient", async () => {
    setOnline(false);
    const { container } = await renderLoaded();

    fillForm();
    fireEvent.submit(getForm(container));
    expect(readQueue()).toHaveLength(1);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(mocks.addReservation).toHaveBeenCalledTimes(1));
    expect(readQueue()).toEqual([]);
    expect(screen.getByText('Votre demande a été enregistrée hors-ligne.')).toBeInTheDocument();
  });

  it("valide les champs avant de mettre en file d'attente", async () => {
    setOnline(false);
    const { container } = await renderLoaded();

    fireEvent.submit(getForm(container));

    expect(readQueue()).toEqual([]);
    expect(screen.getByText('Veuillez renseigner votre nom.')).toBeInTheDocument();
  });

  function getSubmitButton(): HTMLButtonElement {
    const btn = screen.getByRole('button', { name: /Envoyer la demande/ }) as HTMLButtonElement;
    return btn;
  }
});
