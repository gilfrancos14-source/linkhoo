import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scrollToAccueil } from './scroll';

const scrollMock = vi.fn<(options?: ScrollIntoViewOptions | boolean) => void>();

beforeEach(() => {
  scrollMock.mockReset();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollMock,
  });
  document.body.innerHTML = '';
});

describe('scrollToAccueil', () => {
  it("ne fait rien quand l'ancre #accueil n'existe pas", () => {
    expect(() => scrollToAccueil()).not.toThrow();

    expect(scrollMock).not.toHaveBeenCalled();
  });

  it('fait un défilement doux vers #accueil quand il existe', () => {
    document.body.innerHTML = '<section id="accueil"><h2>Accueil</h2></section>';

    scrollToAccueil();

    expect(scrollMock).toHaveBeenCalledTimes(1);
    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it("ignore les autres éléments porteurs d'une id", () => {
    document.body.innerHTML = '<section id="autre"></section>';

    scrollToAccueil();

    expect(scrollMock).not.toHaveBeenCalled();
  });
});
