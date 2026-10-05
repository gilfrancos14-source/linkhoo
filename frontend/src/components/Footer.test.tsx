import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import Footer from './Footer';
import { clearQueue, readQueue } from '../lib/offlineQueue';

const mocks = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
  getToken: vi.fn<() => Promise<string | null>>(),
  me: vi.fn<() => Promise<{ role: 'client' | 'gerant' }>>(),
  bootstrap: vi.fn<() => Promise<unknown>>(),
  setAuthTokenGetter: vi.fn<(getter: () => Promise<string | null>) => void>(),
  subscribe: vi.fn<(args: { email: string; market: string }) => Promise<void>>(),
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
  apiNewsletter: { subscribe: mocks.subscribe },
  setAuthTokenGetter: mocks.setAuthTokenGetter,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderFooter(entry = '/ci') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Footer />
        <LocationProbe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function emailInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('#newsletter-email');
  if (!input) throw new Error('champ email introuvable');
  return input;
}

async function submitNewsletter() {
  await userEvent.click(screen.getByRole('button', { name: "S'abonner à la newsletter" }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isLoaded = true;
  mocks.isSignedIn = false;
  mocks.getToken.mockResolvedValue('token');
  mocks.me.mockResolvedValue({ role: 'client' });
  mocks.subscribe.mockResolvedValue(undefined);
  mocks.user = null;
});

describe('Footer', () => {
  it('affiche la marque, les colonnes et le copyright', () => {
    renderFooter();

    expect(
      screen.getByText(/Des chambres d'hôtel pour vos escales/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'On parle de nous' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Télécharger l’application' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Inscription newsletter' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Copyright © Linkhoo 2026')).toBeInTheDocument();
    expect(screen.getByAltText('Logo Linkhoo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Linkhoo sur Facebook' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Linkhoo sur LinkedIn' })).toBeInTheDocument();
  });

  it("affiche les parutions de presse et l'application à venir", () => {
    renderFooter();

    expect(
      screen.getByText('Linkhoo accélère la location directe en Côte d’Ivoire'),
    ).toBeInTheDocument();
    expect(screen.getByText('12 mars 2026 / actu-abidjan.ci')).toBeInTheDocument();
    expect(screen.getByText('Bientôt disponible sur Google Play')).toBeInTheDocument();
  });

  it("affiche les liens légaux", () => {
    renderFooter();

    expect(screen.getByRole('link', { name: 'À propos' })).toHaveAttribute(
      'href',
      '/a-propos',
    );
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute(
      'href',
      '/ci/mentions-legales',
    );
    expect(
      screen.getByRole('link', { name: 'Politique de confidentialité' }),
    ).toHaveAttribute('href', '/ci/politique-de-confidentialite');
  });

  it("affiche les liens de compte pour un visiteur", () => {
    renderFooter();

    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/ci/login',
    );
    expect(screen.getByRole('link', { name: "S'inscrire" })).toHaveAttribute(
      'href',
      '/ci/inscription',
    );
    expect(
      screen.getByRole('link', { name: 'Suivre ma réservation' }),
    ).toHaveAttribute('href', '/ci/suivi-reservation');
    expect(screen.queryByRole('button', { name: 'Mon espace' })).not.toBeInTheDocument();
  });

  it("ne montre que le suivi de réservation tant que Clerk n'a pas chargé", () => {
    mocks.isLoaded = false;
    renderFooter();

    expect(
      screen.getByRole('link', { name: 'Suivre ma réservation' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mon espace' })).not.toBeInTheDocument();
  });

  it("affiche Mon espace pour un connecté et y accède au clic", async () => {
    mocks.isSignedIn = true;
    renderFooter();

    await userEvent.click(screen.getByRole('button', { name: 'Mon espace' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/ci/compte'));
    expect(mocks.me).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it("bâtit les liens de compte depuis le marché courant", () => {
    renderFooter('/bj');

    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/bj/login',
    );
    expect(screen.getByRole('link', { name: 'Suivre ma réservation' })).toHaveAttribute(
      'href',
      '/bj/suivi-reservation',
    );
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute(
      'href',
      '/bj/mentions-legales',
    );
    expect(screen.getByRole('link', { name: 'À propos' })).toHaveAttribute(
      'href',
      '/a-propos',
    );
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it("demande une adresse email à la souscription", async () => {
    renderFooter();

    await submitNewsletter();

    expect(screen.getByRole('alert')).toHaveTextContent('Veuillez entrer votre adresse email.');
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("refuse une adresse email mal formée", async () => {
    renderFooter();

    await userEvent.type(emailInput(), 'pas-une-adresse');
    await submitNewsletter();

    expect(screen.getByRole('alert')).toHaveTextContent('Adresse email invalide.');
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("enregistre l'abonnement et confirme au visiteur", async () => {
    renderFooter();

    await userEvent.type(emailInput(), 'awa@example.com');
    await submitNewsletter();

    await waitFor(() =>
      expect(mocks.subscribe).toHaveBeenCalledWith({
        email: 'awa@example.com',
        market: 'CI',
      }),
    );
    expect(
      screen.getByText('Merci ! Vous recevrez nos prochaines offres.'),
    ).toBeInTheDocument();
    expect(emailInput().value).toBe('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("envoie l'abonnement sur le marché courant", async () => {
    renderFooter('/bj');

    await userEvent.type(emailInput(), 'kofi@example.com');
    await submitNewsletter();

    await waitFor(() =>
      expect(mocks.subscribe).toHaveBeenCalledWith({
        email: 'kofi@example.com',
        market: 'BJ',
      }),
    );
  });

  it("affiche l'état d'envoi le temps de la requête", async () => {
    const pending = deferred<void>();
    mocks.subscribe.mockReturnValue(pending.promise);
    renderFooter();

    await userEvent.type(emailInput(), 'awa@example.com');
    await submitNewsletter();

    expect(screen.getByRole('button', { name: 'Envoi en cours…' })).toBeDisabled();
    expect(emailInput()).toBeDisabled();

    await act(async () => {
      pending.resolve();
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: "S'abonner à la newsletter" })).toBeEnabled(),
    );
  });

  it("remonte l'erreur du service newsletter", async () => {
    mocks.subscribe.mockRejectedValue(new Error('Service indisponible'));
    renderFooter();

    await userEvent.type(emailInput(), 'awa@example.com');
    await submitNewsletter();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Service indisponible');
    expect(emailInput().value).toBe('awa@example.com');
  });

  it("affiche un message d'erreur générique pour une panne non typée", async () => {
    mocks.subscribe.mockRejectedValue('boom');
    renderFooter();

    await userEvent.type(emailInput(), 'awa@example.com');
    await submitNewsletter();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Une erreur est survenue. Veuillez réessayer.');
  });

  it('conserve les liens statiques quand la clé Clerk est absente', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.resetModules();
    const freshFooter = await import('./Footer');
    const freshMarket = await import('../contexts/MarketContext');

    mocks.isSignedIn = true;
    render(
      <MemoryRouter initialEntries={['/ci']}>
        <freshMarket.MarketProvider>
          <freshFooter.default />
        </freshMarket.MarketProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "S'inscrire" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mon espace' })).not.toBeInTheDocument();
  });
});

describe('Footer — mode hors-ligne', () => {
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

  it("enregistre l'inscription en file d'attente hors-ligne", async () => {
    setOnline(false);
    renderFooter();

    await userEvent.type(emailInput(), 'awa@example.com');
    await submitNewsletter();

    expect(mocks.subscribe).not.toHaveBeenCalled();
    const stored = readQueue();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.type).toBe('newsletter');
    expect(screen.getByText('Inscription enregistrée : elle sera envoyée au retour de la connexion.')).toBeInTheDocument();
    expect(emailInput().value).toBe('');
  });

  it("envoie l'inscription enregistrée quand la connexion revient", async () => {
    setOnline(false);
    renderFooter();

    await userEvent.type(emailInput(), 'awa@example.com');
    await submitNewsletter();
    expect(readQueue()).toHaveLength(1);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() =>
      expect(mocks.subscribe).toHaveBeenCalledWith({
        email: 'awa@example.com',
        market: 'CI',
      }),
    );
    expect(readQueue()).toEqual([]);
  });

  it("garde le formulaire utilisable hors-ligne", () => {
    setOnline(false);
    renderFooter();

    expect(emailInput()).toBeEnabled();
    expect(screen.getByRole('button', { name: "S'abonner à la newsletter" })).toBeEnabled();
    expect(screen.getByText('Nouveaux biens disponibles et offres de séjour, une fois par mois.')).toBeInTheDocument();
  });
});

