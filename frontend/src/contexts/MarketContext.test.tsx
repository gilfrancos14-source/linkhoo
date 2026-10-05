import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { MarketProvider, marketSlugFromPath, useMarket } from './MarketContext';

// Capture l'erreur levée par useMarket() hors provider : React ne la propage
// pas toujours de façon synchrone à render(), on la lit donc via une
// error boundary de test.
class Catcher extends Component<{ children: ReactNode }, { message: string | null }> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: Error): { message: string | null } {
    return { message: error.message };
  }

  render() {
    if (this.state.message !== null) {
      return <div data-testid="caught">{this.state.message}</div>;
    }
    return this.props.children;
  }
}

function Probe() {
  const { market, setMarket } = useMarket();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <span data-testid="market">{market}</span>
      <span data-testid="pathname">{pathname}</span>
      <button type="button" onClick={() => setMarket('BJ')}>
        Passer en BJ
      </button>
      <button type="button" onClick={() => setMarket('CI')}>
        Passer en CI
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Retour historique
      </button>
    </>
  );
}

function renderProvider(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Probe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-market');
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-market');
});

describe('marketSlugFromPath', () => {
  it('retourne « ci » pour la racine du marché CI', () => {
    expect(marketSlugFromPath('/ci')).toBe('ci');
  });

  it('retourne « bj » pour la racine du marché BJ', () => {
    expect(marketSlugFromPath('/bj')).toBe('bj');
  });

  it('lit le segment de marché quelle que soit la profondeur de la route', () => {
    expect(marketSlugFromPath('/ci/chambres')).toBe('ci');
    expect(marketSlugFromPath('/bj/chambre/12/reserver')).toBe('bj');
    expect(marketSlugFromPath('/bj/')).toBe('bj');
  });

  it('retourne null sur les routes sans marché', () => {
    expect(marketSlugFromPath('/')).toBeNull();
    expect(marketSlugFromPath('/admin/dashboard')).toBeNull();
    expect(marketSlugFromPath('/admin')).toBeNull();
  });

  it('retourne null sur un segment qui n’est pas un marché exact', () => {
    expect(marketSlugFromPath('/CI')).toBeNull();
    expect(marketSlugFromPath('/civique')).toBeNull();
    expect(marketSlugFromPath('')).toBeNull();
  });
});

describe('MarketProvider', () => {
  it('rend ses children', () => {
    renderProvider('/ci');

    expect(screen.getByTestId('market')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passer en BJ' })).toBeInTheDocument();
  });

  it('expose le marché dérivé de l’URL (CI)', () => {
    renderProvider('/ci/chambres');

    expect(screen.getByTestId('market')).toHaveTextContent('CI');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci/chambres');
  });

  it('expose le marché dérivé de l’URL (BJ)', () => {
    renderProvider('/bj');

    expect(screen.getByTestId('market')).toHaveTextContent('BJ');
  });

  it('retombe sur CI hors /ci|/bj', () => {
    renderProvider('/admin/login');

    expect(screen.getByTestId('market')).toHaveTextContent('CI');
  });

  it('pose data-market sur <html> pour piloter le thème', () => {
    renderProvider('/bj');

    expect(document.documentElement.getAttribute('data-market')).toBe('BJ');
  });

  it('met à jour data-market quand l’URL change de marché', async () => {
    renderProvider('/ci');
    expect(document.documentElement.getAttribute('data-market')).toBe('CI');

    await userEvent.click(screen.getByRole('button', { name: 'Passer en BJ' }));

    expect(document.documentElement.getAttribute('data-market')).toBe('BJ');
    expect(screen.getByTestId('market')).toHaveTextContent('BJ');
  });

  it('setMarket navigue vers /{marché} en conservant l’entrée précédente', async () => {
    renderProvider('/ci');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci');

    await userEvent.click(screen.getByRole('button', { name: 'Passer en BJ' }));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/bj');

    await userEvent.click(screen.getByRole('button', { name: 'Passer en CI' }));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci');
  });

  it('le retour du navigateur revient à la page précédente après un changement de marché', async () => {
    renderProvider('/');

    await userEvent.click(screen.getByRole('button', { name: 'Passer en CI' }));
    expect(screen.getByTestId('pathname')).toHaveTextContent('/ci');

    await userEvent.click(screen.getByRole('button', { name: 'Retour historique' }));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/');
  });
});

describe('useMarket', () => {
  it('lève une erreur explicite en dehors de MarketProvider', () => {
    render(
      <Catcher>
        <Probe />
      </Catcher>,
    );

    expect(screen.getByTestId('caught')).toHaveTextContent(
      'useMarket must be used within MarketProvider',
    );
  });
});
