import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import { useHomePath } from './useHomePath';

function Probe() {
  const homePath = useHomePath();
  return <div data-testid="home-path">{homePath}</div>;
}

function renderPath(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Probe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('useHomePath', () => {
  it('dérive le chemin du marché depuis l’URL (CI)', () => {
    renderPath('/ci/chambres');

    expect(screen.getByTestId('home-path')).toHaveTextContent('/ci');
  });

  it('dérive le chemin du marché depuis l’URL (BJ)', () => {
    renderPath('/bj/chambre/12');

    expect(screen.getByTestId('home-path')).toHaveTextContent('/bj');
  });

  it('retombe sur CI pour les URL sans marché', () => {
    renderPath('/');

    expect(screen.getByTestId('home-path')).toHaveTextContent('/ci');
  });

  it('ne tient pas compte de la casse du segment', () => {
    renderPath('/CI');

    expect(screen.getByTestId('home-path')).toHaveTextContent('/ci');
  });
});
