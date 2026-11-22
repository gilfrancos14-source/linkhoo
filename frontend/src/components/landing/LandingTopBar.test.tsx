import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import LandingTopBar from './LandingTopBar';

const BANNER_TEXT =
  'Vous êtes actuellement hors ligne. Certaines fonctionnalités peuvent être limitées.';

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  cleanup();
  setOnline(true);
});

describe('LandingTopBar — bandeau hors ligne', () => {
  it("ne s'affiche pas quand la connexion est disponible", () => {
    setOnline(true);
    render(<LandingTopBar />);
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it("s'affiche quand le navigateur est hors ligne", () => {
    setOnline(false);
    render(<LandingTopBar />);
    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it('apparaît et disparaît avec les événements offline / online', () => {
    setOnline(true);
    render(<LandingTopBar />);
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('peut être fermé, puis réapparaît après une nouvelle coupure', () => {
    setOnline(false);
    render(<LandingTopBar />);

    act(() => {
      screen.getByRole('button', { name: 'Fermer' }).click();
    });
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();
  });
});
