import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';

afterEach(() => {
  cleanup();
});

describe('LandingPage', () => {
  it('rend un conteneur unique occupant toute la hauteur de la fenêtre', () => {
    const { container } = render(<LandingPage />);

    const pane = container.firstElementChild;
    expect(pane).not.toBeNull();
    expect(container.childElementCount).toBe(1);
    // jsdom convertit les unités de fenêtre en pixels (innerHeight), on lit
    // donc la déclaration inline plutôt que la valeur calculée.
    expect((pane as HTMLElement).getAttribute('style') ?? '').toContain('min-height: 100vh');
  });

  it('pose un fond blanc pour la page de transition', () => {
    const { container } = render(<LandingPage />);

    const pane = container.firstElementChild as Element;
    expect(getComputedStyle(pane).backgroundColor).toBe('rgb(255, 255, 255)');
  });

  it("n'affiche aucun contenu textuel ni lien", () => {
    render(<LandingPage />);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.body.textContent).toBe('');
  });
});
