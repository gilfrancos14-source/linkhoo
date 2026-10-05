import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import Header from './Header';

const mocks = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
  getToken: vi.fn<() => Promise<string | null>>(),
  me: vi.fn<() => Promise<{ role: 'client' | 'gerant' }>>(),
  bootstrap: vi.fn<() => Promise<unknown>>(),
  setAuthTokenGetter: vi.fn<(getter: () => Promise<string | null>) => void>(),
  user: null as unknown,
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: mocks.isLoaded,
    isSignedIn: mocks.isSignedIn,
    getToken: mocks.getToken,
  }),
  useUser: () => ({ user: mocks.user }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock('../lib/api', () => ({
  apiAuth: { me: mocks.me, bootstrap: mocks.bootstrap },
  setAuthTokenGetter: mocks.setAuthTokenGetter,
}));

// Header défile vers une section au clic : jsdom n'implémente pas scrollIntoView.
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderHeader(entry = '/ci') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Header />
        <LocationProbe />
        <div id="accueil" />
        <div id="categories" />
        <div id="evenements" />
        <div id="tourisme" />
        <div id="avis" />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function burger(): HTMLElement {
  return screen.getByRole('button', { name: /menu/ });
}

// Le menu porte aria-hidden quand il est fermé : on le cible par identifiant
// plutôt que par son rôle, indisponible hors arbre d'accessibilité.
function menu(): HTMLElement {
  const dialog = document.querySelector<HTMLElement>('#mobile-menu');
  if (!dialog) throw new Error('menu mobile introuvable');
  return dialog;
}

// Navigation visible en desktop : elle double les entrées du menu mobile.
function desktopNav(): HTMLElement {
  const nav = document.querySelector<HTMLElement>('.header-nav');
  if (!nav) throw new Error('navigation bureau introuvable');
  return nav;
}

afterEach(() => {
  cleanup();
  document.body.className = '';
});

beforeEach(() => {
  vi.clearAllMocks();
  scrollIntoView.mockClear();
  mocks.isLoaded = true;
  mocks.isSignedIn = false;
  mocks.getToken.mockResolvedValue('token');
  mocks.me.mockResolvedValue({ role: 'client' });
  mocks.user = null;
});

describe('Header', () => {
  it("affiche le logo en retour vers l'accueil du marché", () => {
    renderHeader();

    const logo = screen.getByRole('link', { name: "Linkhoo — retour à l'accueil" });
    expect(logo).toHaveAttribute('href', '/ci');
    expect(screen.getByAltText('Logo Linkhoo')).toHaveAttribute('src', '/logo.jpg');
  });

  it("présente le sélecteur de marché sur l'accueil et un burger fermé", () => {
    renderHeader('/');

    expect(screen.getByRole('button', { name: 'Choisir le marché' })).toBeInTheDocument();
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
    expect(burger()).toHaveAttribute('aria-controls', 'mobile-menu');
    expect(burger()).toHaveAccessibleName('Ouvrir le menu');
    expect(menu()).toHaveAttribute('aria-hidden', 'true');
  });

  it("n'affiche que le drapeau sur une page de marché", () => {
    renderHeader('/ci');

    expect(screen.queryByRole('button', { name: 'Choisir le marché' })).toBeNull();
    expect(
      screen.getByRole('img', { name: "Marché Côte d'Ivoire" }),
    ).toBeInTheDocument();
    expect(burger()).toBeInTheDocument();
  });

  it('ouvre puis referme le menu mobile au clic sur le burger', async () => {
    renderHeader();

    await userEvent.click(burger());

    expect(burger()).toHaveAccessibleName('Fermer le menu');
    expect(burger()).toHaveAttribute('aria-expanded', 'true');
    expect(menu()).toHaveClass('is-open');
    expect(menu()).toHaveAttribute('aria-hidden', 'false');
    expect(document.body).toHaveClass('nav-open');

    await userEvent.click(burger());

    expect(burger()).toHaveAccessibleName('Ouvrir le menu');
    expect(menu()).not.toHaveClass('is-open');
    expect(document.body).not.toHaveClass('nav-open');
  });

  it("place le focus sur la première entrée du menu à l'ouverture", async () => {
    renderHeader();

    await userEvent.click(burger());

    await waitFor(() => expect(document.activeElement?.textContent).toBe('Accueil'));
  });

  it('referme le menu avec la touche Échap', async () => {
    renderHeader();

    await userEvent.click(burger());
    expect(menu()).toHaveClass('is-open');

    await userEvent.keyboard('{Escape}');

    expect(menu()).not.toHaveClass('is-open');
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('referme le menu en cliquant sur le fond noir', async () => {
    const { container } = renderHeader();

    await userEvent.click(burger());
    const backdrop = container.querySelector('.mobile-menu__backdrop');
    if (!backdrop) throw new Error('backdrop introuvable');

    fireEvent.click(backdrop);

    expect(menu()).not.toHaveClass('is-open');
    expect(document.body).not.toHaveClass('nav-open');
  });

  it("n'affiche que Accueil, À propos et Contact sur l'accueil racine", async () => {
    renderHeader('/');

    expect(within(desktopNav()).getByRole('button', { name: 'Accueil' })).toBeInTheDocument();
    expect(within(desktopNav()).getByRole('link', { name: 'À propos' })).toHaveAttribute(
      'href',
      '/a-propos',
    );
    expect(within(desktopNav()).getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      '/contact',
    );
    for (const label of ['Appartements', 'Événements', 'Tourisme', 'Avis']) {
      expect(within(desktopNav()).queryByRole('button', { name: label })).toBeNull();
    }

    await userEvent.click(burger());

    expect(within(menu()).getByRole('button', { name: 'Accueil' })).toBeInTheDocument();
    expect(within(menu()).getByRole('link', { name: 'À propos' })).toHaveAttribute(
      'href',
      '/a-propos',
    );
    expect(within(menu()).getByRole('link', { name: 'Contact' })).toBeInTheDocument();
    expect(within(menu()).queryByRole('button', { name: 'Appartements' })).toBeNull();
    expect(within(menu()).queryByRole('button', { name: 'Avis' })).toBeNull();
  });

  it("garde la barre de navigation de l'accueil sur /contact et /a-propos", () => {
    renderHeader('/contact');

    expect(within(desktopNav()).getByRole('button', { name: 'Accueil' })).toBeInTheDocument();
    expect(within(desktopNav()).getByRole('link', { name: 'À propos' })).toHaveAttribute(
      'href',
      '/a-propos',
    );
    expect(within(desktopNav()).getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      '/contact',
    );
    for (const label of ['Appartements', 'Événements', 'Tourisme', 'Avis']) {
      expect(within(desktopNav()).queryByRole('button', { name: label })).toBeNull();
    }
    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choisir le marché' })).toBeInTheDocument();

    cleanup();
    renderHeader('/a-propos');

    expect(within(desktopNav()).getByRole('button', { name: 'Accueil' })).toBeInTheDocument();
    expect(within(desktopNav()).getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it("ramène à l'accueil depuis /contact au clic sur Accueil", async () => {
    renderHeader('/contact');

    await userEvent.click(within(desktopNav()).getByRole('button', { name: 'Accueil' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('contient la navigation complète sur les pages de marché', async () => {
    renderHeader('/ci');

    const labels = ['Accueil', 'Appartements', 'Événements', 'Tourisme', 'Avis'];

    for (const label of labels) {
      expect(within(desktopNav()).getByRole('button', { name: label })).toBeInTheDocument();
    }

    await userEvent.click(burger());

    for (const label of labels) {
      expect(within(menu()).getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('ouvre la page Contact depuis la barre et depuis le menu mobile', async () => {
    renderHeader('/');

    expect(
      within(desktopNav()).getByRole('link', { name: 'Contact' }),
    ).toHaveAttribute('href', '/contact');

    await userEvent.click(burger());
    await userEvent.click(within(menu()).getByRole('link', { name: 'Contact' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/contact');
    expect(menu()).not.toHaveClass('is-open');
    expect(document.body).not.toHaveClass('nav-open');
  });

  it("ne montre ni À propos ni Contact sur les pages de marché", () => {
    renderHeader('/ci');

    expect(within(desktopNav()).queryByRole('link', { name: 'À propos' })).toBeNull();
    expect(within(desktopNav()).queryByRole('link', { name: 'Contact' })).toBeNull();

    cleanup();
    renderHeader('/bj/chambre/12');

    expect(within(desktopNav()).queryByRole('link', { name: 'À propos' })).toBeNull();
    expect(within(desktopNav()).queryByRole('link', { name: 'Contact' })).toBeNull();
    expect(within(desktopNav()).getByRole('button', { name: 'Avis' })).toBeInTheDocument();
  });

  it('ouvre la page À propos depuis la barre de navigation', async () => {
    renderHeader('/');

    await userEvent.click(within(desktopNav()).getByRole('link', { name: 'À propos' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/a-propos');
  });

  it("referme le menu et défile vers la section choisie", async () => {
    renderHeader();

    await userEvent.click(burger());
    await userEvent.click(within(menu()).getByRole('button', { name: 'Accueil' }));

    expect(menu()).not.toHaveClass('is-open');
    expect(document.body).not.toHaveClass('nav-open');
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' }),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/ci');
  });

  it("ramène à l'accueil puis défile vers la section quand on est ailleurs", async () => {
    renderHeader('/ci/chambre/12');

    await userEvent.click(burger());
    await userEvent.click(within(menu()).getByRole('button', { name: 'Accueil' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/ci');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('défile depuis la navigation bureau quand les sections sont sur la page', async () => {
    renderHeader('/');

    await userEvent.click(within(desktopNav()).getByRole('button', { name: 'Accueil' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/');
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' }),
    );
  });

  it('dirige la navigation bureau vers le marché quand on est ailleurs', async () => {
    renderHeader('/bj/chambre/3');

    await userEvent.click(within(desktopNav()).getByRole('button', { name: 'Accueil' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/bj');
  });

  it("n'affiche ni bouton de connexion ni liens d'authentification sur l'accueil", async () => {
    renderHeader('/');

    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mon espace' })).not.toBeInTheDocument();

    await userEvent.click(burger());

    expect(within(menu()).queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
    expect(within(menu()).queryByRole('link', { name: "S'inscrire" })).not.toBeInTheDocument();
    expect(within(menu()).queryByRole('button', { name: 'Mon espace' })).not.toBeInTheDocument();
  });

  it("affiche le bouton Se connecter dans la barre sur une page de marché", () => {
    renderHeader('/bj');

    const link = screen.getByRole('link', { name: 'Se connecter' });
    expect(link).toHaveAttribute('href', '/bj/login');
  });

  it("ne met ni Se connecter ni S'inscrire dans le menu mobile", async () => {
    renderHeader('/ci');
    await userEvent.click(burger());

    expect(within(menu()).queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
    expect(within(menu()).queryByRole('link', { name: "S'inscrire" })).not.toBeInTheDocument();
    expect(within(menu()).queryByRole('button', { name: 'Mon espace' })).not.toBeInTheDocument();
  });

  it("affiche Mon espace dans la barre quand l'utilisateur est connecté et y accède au clic", async () => {
    mocks.isSignedIn = true;
    renderHeader('/ci');

    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mon espace' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/ci/compte'));
    expect(mocks.me).toHaveBeenCalledTimes(1);
  });

  it("n'affiche aucune action d'authentification dans la barre tant que Clerk n'a pas chargé", () => {
    mocks.isLoaded = false;
    renderHeader('/ci');

    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mon espace' })).not.toBeInTheDocument();
    expect(burger()).toBeInTheDocument();
  });

  it("change de marché depuis l'accueil et met à jour le lien de connexion", async () => {
    renderHeader('/');

    await userEvent.click(screen.getByRole('button', { name: 'Choisir le marché' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bénin' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/bj');
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/bj/login',
    );
  });
});
