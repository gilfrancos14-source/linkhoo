import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackToTop from './BackToTop';

/** jsdom ne fait pas défiler : on force la position de scroll pour le test. */
function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  setScrollY(0);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Retire le scrollY forcé pour les fichiers/tests suivants.
  Reflect.deleteProperty(window, 'scrollY');
});

function scrollAndDispatch(y: number) {
  setScrollY(y);
  fireEvent.scroll(window);
}

describe('BackToTop', () => {
  it('reste masqué en haut de page', () => {
    render(<BackToTop />);
    scrollAndDispatch(0);

    expect(
      screen.queryByRole('button', { name: 'Retour en haut de page' }),
    ).toBeNull();
  });

  it('reste masqué à la limite exacte de 500 px', () => {
    render(<BackToTop />);
    scrollAndDispatch(500);

    expect(
      screen.queryByRole('button', { name: 'Retour en haut de page' }),
    ).toBeNull();
  });

  it('apparaît dès que le scroll dépasse 500 px', () => {
    render(<BackToTop />);
    expect(
      screen.queryByRole('button', { name: 'Retour en haut de page' }),
    ).toBeNull();

    scrollAndDispatch(501);

    expect(
      screen.getByRole('button', { name: 'Retour en haut de page' }),
    ).toBeInTheDocument();
  });

  it('disparaît à nouveau quand on remonte sous le seuil', () => {
    render(<BackToTop />);
    scrollAndDispatch(800);
    expect(
      screen.getByRole('button', { name: 'Retour en haut de page' }),
    ).toBeInTheDocument();

    scrollAndDispatch(200);

    expect(
      screen.queryByRole('button', { name: 'Retour en haut de page' }),
    ).toBeNull();
  });

  it('défile en douceur jusqu’en haut au clic', async () => {
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);

    render(<BackToTop />);
    scrollAndDispatch(600);

    await userEvent.click(
      screen.getByRole('button', { name: 'Retour en haut de page' }),
    );

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it("retire son écouteur de scroll au démontage", () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<BackToTop />);

    unmount();

    const removedScroll = removeSpy.mock.calls.filter(
      ([type]) => type === 'scroll',
    );
    expect(removedScroll.length).toBeGreaterThan(0);
  });
});
