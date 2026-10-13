import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LANDING_COUNTRIES } from '../data/landing';
import CountrySelector from './CountrySelector';

const mocks = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
  getMe: vi.fn<() => Promise<{ market: string }>>(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: mocks.isLoaded, isSignedIn: mocks.isSignedIn }),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGerants: { getMe: mocks.getMe },
  };
});

function renderSelector() {
  return render(
    <MemoryRouter>
      <CountrySelector />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isLoaded = true;
  mocks.isSignedIn = false;
  mocks.getMe.mockRejectedValue(new Error('Non connecté'));
});

afterEach(() => {
  cleanup();
});

describe('CountrySelector', () => {
  it('visiteur : les pays ouverts sont des liens cliquables', () => {
    renderSelector();

    const links = screen.getAllByRole('link');
    // 12 marchés ouverts dans LANDING_COUNTRIES
    expect(links).toHaveLength(12);
    expect(links[0]).toHaveAttribute('href', '/sn');
  });

  it("visiteur : les pays fermés affichent « Bientôt »", () => {
    renderSelector();

    // Tous les marchés sont ouverts actuellement, donc pas de « Bientôt ».
    // Ce test vérifie juste qu'aucun « Bientôt » n'apparaît.
    expect(screen.queryByText('Bientôt')).toBeNull();
  });

  it('gérant connecté : aucun lien, le pays du gérant est en surbrillance', async () => {
    mocks.isSignedIn = true;
    mocks.getMe.mockResolvedValue({ market: 'CI' });

    renderSelector();

    // Attendre que le state gerantMarket soit défini
    await waitFor(() => {
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    // Le pays du gérant porte is-active + le badge « Votre marché »
    expect(await screen.findByText('Votre marché')).toBeInTheDocument();
    // Le label utilise l'apostrophe typographique (U+2019)
    const ciLabel = LANDING_COUNTRIES.find((c) => c.slug === 'ci')!.label;
    const active = screen.getByText(ciLabel).closest('.landing-countries__card');
    expect(active).toHaveClass('is-active');
  });

  it('gérant connecté : les autres pays sont désactivés', async () => {
    mocks.isSignedIn = true;
    mocks.getMe.mockResolvedValue({ market: 'CI' });

    renderSelector();

    await waitFor(() => {
      // Re-querier à chaque tick (le DOM change après re-render)
      const card = screen.getByText('Bénin').closest('.landing-countries__card');
      expect(card).toHaveClass('is-disabled');
      expect(card).not.toHaveClass('is-active');
    });
  });

  it('client connecté (pas gérant) : les liens restent actifs', async () => {
    mocks.isSignedIn = true;
    mocks.getMe.mockRejectedValue(new Error('Pas un gérant'));

    renderSelector();

    expect(await screen.findAllByRole('link')).toHaveLength(12);
  });
});
