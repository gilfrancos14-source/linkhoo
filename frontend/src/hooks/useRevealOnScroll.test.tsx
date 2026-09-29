import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useRevealOnScroll } from './useRevealOnScroll';

// ── IntersectionObserver contrôlable ──
// Le stub de src/test/setup.ts est passif : on le remplace ici pour piloter
// les callbacks et inspecter les options/éléments observés.
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
  }

  unobserve(el: Element) {
    this.observed = this.observed.filter((e) => e !== el);
  }

  disconnect() {
    this.disconnected = true;
    this.observed = [];
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  fire(entries: Array<{ target: Element; isIntersecting: boolean }>) {
    this.callback(
      entries as unknown as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

function lastObserver(): MockIntersectionObserver {
  const io = MockIntersectionObserver.instances.at(-1);
  if (!io) throw new Error('IntersectionObserver non instancié par le hook');
  return io;
}

function domRect(overrides: Partial<DOMRect>): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
    ...overrides,
  };
}

function Probe({ children }: { children?: ReactNode }) {
  useRevealOnScroll();
  return <div data-testid="probe">{children}</div>;
}

// Un élément est « dans le viewport » s'il porte data-viewport="in",
// hors viewport sinon (rect tout à zéro : bottom > 0 est faux).
function viewportSpy() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    if (this.getAttribute('data-viewport') === 'in') {
      return domRect({ top: 10, bottom: 110, left: 0, right: 100, width: 100, height: 100 });
    }
    return domRect({});
  });
}

let rectSpy: ReturnType<typeof viewportSpy>;

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  rectSpy = viewportSpy();
});

afterEach(() => {
  cleanup();
  rectSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useRevealOnScroll', () => {
  it('marque immédiatement comme visible un élément déjà dans le viewport', () => {
    render(
      <Probe>
        <div className="reveal" data-testid="visible" data-viewport="in" />
      </Probe>,
    );

    expect(screen.getByTestId('visible').classList.contains('is-visible')).toBe(true);
    expect(lastObserver().observed).toHaveLength(0);
  });

  it('observe les éléments hors viewport sans les rendre visibles tout de suite', () => {
    render(
      <Probe>
        <div className="reveal" data-testid="cache" />
      </Probe>,
    );

    expect(screen.getByTestId('cache').classList.contains('is-visible')).toBe(false);
    expect(lastObserver().observed).toEqual([screen.getByTestId('cache')]);
  });

  it('configure l’observateur avec le seuil et la marge de défilement attendus', () => {
    render(<Probe />);

    expect(lastObserver().options).toEqual({
      threshold: 0.05,
      rootMargin: '0px 0px -40px 0px',
    });
  });

  it('révèle puis cesse d’observer un élément qui entre dans le viewport', () => {
    render(
      <Probe>
        <div className="reveal" data-testid="cache" />
      </Probe>,
    );
    const io = lastObserver();
    const el = screen.getByTestId('cache');

    act(() => {
      io.fire([{ target: el, isIntersecting: true }]);
    });

    expect(el.classList.contains('is-visible')).toBe(true);
    expect(io.observed).toHaveLength(0);
  });

  it('ignore un élément dont l’intersection est fausse (hors écran)', () => {
    render(
      <Probe>
        <div className="reveal" data-testid="cache" />
      </Probe>,
    );
    const io = lastObserver();
    const el = screen.getByTestId('cache');

    act(() => {
      io.fire([{ target: el, isIntersecting: false }]);
    });

    expect(el.classList.contains('is-visible')).toBe(false);
    expect(io.observed).toEqual([el]);
  });

  it('n’observe que les éléments de classe « reveal »', () => {
    render(
      <Probe>
        <div data-testid="autre">section ordinaire</div>
      </Probe>,
    );

    expect(screen.getByTestId('autre').classList.contains('is-visible')).toBe(false);
    expect(lastObserver().observed).toHaveLength(0);
  });

  it('enregistre les éléments ajoutés après le premier rendu (MutationObserver)', async () => {
    const { rerender } = render(<Probe />);
    const io = lastObserver();

    rerender(
      <Probe>
        <div className="reveal" data-testid="tardif" />
      </Probe>,
    );
    await act(async () => {});

    expect(io.observed).toEqual([screen.getByTestId('tardif')]);

    act(() => {
      io.fire([{ target: screen.getByTestId('tardif'), isIntersecting: true }]);
    });
    expect(screen.getByTestId('tardif').classList.contains('is-visible')).toBe(true);
  });

  it('rend visible un élément tardif déjà dans le viewport, sans l’observer', async () => {
    render(<Probe />);
    const io = lastObserver();

    const late = document.createElement('div');
    late.className = 'reveal';
    late.setAttribute('data-viewport', 'in');
    await act(async () => {
      screen.getByTestId('probe').appendChild(late);
    });

    expect(late.classList.contains('is-visible')).toBe(true);
    expect(io.observed).toHaveLength(0);
  });

  it('ne ré-enregistre pas un élément déjà traité (même après un déplacement)', async () => {
    render(
      <Probe>
        <div className="reveal" data-testid="unique" />
      </Probe>,
    );
    const io = lastObserver();
    const el = screen.getByTestId('unique');
    expect(io.observed).toEqual([el]);

    // Relocaliser le nœud génère un nouveau record de mutation « addedNodes ».
    await act(async () => {
      document.body.appendChild(el);
    });

    expect(io.observed).toEqual([el]);
  });

  it('déconnecte les deux observateurs au démontage', () => {
    const mutationSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const { unmount } = render(<Probe />);
    const io = lastObserver();

    unmount();

    expect(io.disconnected).toBe(true);
    expect(mutationSpy).toHaveBeenCalledTimes(1);
  });
});
