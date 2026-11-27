import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHostMarket } from './useHostMarket';

const mocks = vi.hoisted(() => ({ detect: vi.fn() }));

vi.mock('../lib/api', () => ({
  apiDiscover: { market: mocks.detect },
}));

function Probe() {
  return <output data-testid="market">{useHostMarket()}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.detect.mockReset();
});

afterEach(cleanup);

describe('useHostMarket', () => {
  it('utilise le marché détecté à la racine', async () => {
    mocks.detect.mockResolvedValue({ market: 'BJ', countryCode: 'BJ' });

    renderAt('/');

    await waitFor(() => expect(screen.getByTestId('market')).toHaveTextContent('BJ'));
  });

  it('retombe sur CI si le pays est inconnu', async () => {
    mocks.detect.mockResolvedValue({ market: null, countryCode: null });

    renderAt('/');

    await waitFor(() => expect(mocks.detect).toHaveBeenCalled());
    expect(screen.getByTestId('market')).toHaveTextContent('CI');
  });

  it('retombe sur CI si la détection échoue', async () => {
    mocks.detect.mockRejectedValue(new Error('offline'));

    renderAt('/');

    await waitFor(() => expect(mocks.detect).toHaveBeenCalled());
    expect(screen.getByTestId('market')).toHaveTextContent('CI');
  });

  it("respecte le marché de l'URL sans appeler la détection", () => {
    renderAt('/sn/recherche');

    expect(screen.getByTestId('market')).toHaveTextContent('SN');
    expect(mocks.detect).not.toHaveBeenCalled();
  });

  it('ignore un code marché inconnu renvoyé par l’API', async () => {
    mocks.detect.mockResolvedValue({ market: 'ZZ', countryCode: 'ZZ' });

    renderAt('/');

    await waitFor(() => expect(mocks.detect).toHaveBeenCalled());
    expect(screen.getByTestId('market')).toHaveTextContent('CI');
  });
});
