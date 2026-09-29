import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('présente le sélecteur de marché et un burger fermé', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: 'Choisir le marché' })).toBeInTheDocument();
    expect(burger()).toHaveAttribute('aria-expanded', 'false');
    expect(burger()).toHaveAttribute('aria-controls', 'mobile-menu');
    expect(burger()).toHaveAccessibleName('Ouvrir le menu');
    expect(menu()).toHaveAttribute('aria-hidden', 'true');
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

  it('contient les cinq sections de navigation', async () => {
    renderHeader();
    await userEvent.click(burger());

    for (const label of ['Accueil', 'Appartements', 'Événements', 'Tourisme', 'Avis']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it("referme le menu et défile vers la section choisie", async () => {
    renderHeader();

    await userEvent.click(burger());
    await userEvent.click(screen.getByRole('button', { name: 'Appartements' }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Avis' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/ci');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it("affiche le lien de connexion pour un visiteur", () => {
    renderHeader();

    const link = screen.getByRole('link', { name: 'Se connecter' });
    expect(link).toHaveAttribute('href', '/ci/login');
    expect(screen.queryByRole('button', { name: 'Mon espace' })).not.toBeInTheDocument();
  });

  it("construit le lien de connexion depuis le marché de l'URL", () => {
    renderHeader('/bj');

    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/bj/login',
    );
  });

  it("affiche le lien d'inscription dans le menu mobile hors session", async () => {
    renderHeader();
    await userEvent.click(burger());

    const links = screen.getAllByRole('link', { name: "S'inscrire" });
    expect(links[0]).toHaveAttribute('href', '/ci/inscription');
  });

  it("affiche Mon espace quand l'utilisateur est connecté et y accède au clic", async () => {
    mocks.isSignedIn = true;
    renderHeader();

    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mon espace' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/ci/compte'));
    expect(mocks.me).toHaveBeenCalledTimes(1);
  });

  it("affiche Mon espace dans le menu mobile quand l'utilisateur est connecté", async () => {
    mocks.isSignedIn = true;
    renderHeader();

    await userEvent.click(burger());

    expect(screen.getAllByRole('button', { name: 'Mon espace' })).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it("n'affiche aucune action d'authentification tant que Clerk n'a pas chargé", () => {
    mocks.isLoaded = false;
    renderHeader();

    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mon espace' })).not.toBeInTheDocument();
    expect(burger()).toBeInTheDocument();
  });

  it("change de marché via le sélecteur et met à jour les liens", async () => {
    renderHeader();

    await userEvent.click(screen.getByRole('button', { name: 'Choisir le marché' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bénin' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/bj');
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
        'href',
        '/bj/login',
      ),
    );
  });
});
