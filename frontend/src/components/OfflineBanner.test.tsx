import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import OfflineBanner from './OfflineBanner';

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

describe('OfflineBanner', () => {
  it("ne rend rien quand la connexion est disponible", () => {
    setOnline(true);
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("affiche le bandeau quand le navigateur est hors-ligne", () => {
    setOnline(false);
    render(<OfflineBanner />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('hors-ligne');
    expect(banner).toHaveTextContent('dernière visite');
    expect(banner).toHaveTextContent('Réservation');
  });

  it("apparaît et disparaît avec les événements online/offline", () => {
    setOnline(true);
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(container.firstChild).toBeNull();
  });
});
