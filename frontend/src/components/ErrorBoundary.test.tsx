import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';

// React journalise chaque erreur capturée par une error boundary via
// console.error : on l'assourdit pour ne pas polluer la sortie des tests.
let consoleError: ReturnType<typeof vi.spyOn>;

// Drapeau global : l'enfant cesse de lever l'erreur au moment du « Réessayer »
// (simule un problème transitoire), sinon React re-leverait la même erreur.
let bombEnabled: boolean;

function Bomb({ message = 'boom de rendu' }: { message?: string }) {
  if (bombEnabled) throw new Error(message);
  return <div data-testid="bomb-ok">Rendu rétabli</div>;
}

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  bombEnabled = true;
});

afterEach(() => {
  cleanup();
  consoleError.mockRestore();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('rend ses enfants tant qu’aucune erreur ne survient', () => {
    render(
      <ErrorBoundary>
        <div data-testid="contenu">Contenu sain</div>
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('contenu')).toHaveTextContent('Contenu sain');
    expect(screen.queryByText('Une erreur est survenue')).not.toBeInTheDocument();
  });

  it('affiche le fallback générique quand un enfant lève une erreur', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Une erreur est survenue' })).toBeInTheDocument();
    expect(
      screen.getByText('Nous nous excusons pour ce désagrément. Veuillez réessayer ultérieurement.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/');
    expect(screen.queryByTestId('bomb-ok')).not.toBeInTheDocument();
  });

  it('« Réessayer » remonte l’arbre et rend à nouveau les enfants', async () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();

    bombEnabled = false;
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    // L’enfant cesse de lever l’erreur : la frontière est bien réinitialisée.
    expect(screen.getByTestId('bomb-ok')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Une erreur est survenue' })).not.toBeInTheDocument();
  });

  it('reste sur le fallback si l’enfant continue de lever l’erreur', async () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(screen.getByRole('heading', { name: 'Une erreur est survenue' })).toBeInTheDocument();
    expect(screen.queryByTestId('bomb-ok')).not.toBeInTheDocument();
  });

  it('détecte une erreur de chunk lazy et demande un rechargement de la page', async () => {
    render(
      <ErrorBoundary>
        <Bomb message="Failed to fetch dynamically imported module: /assets/index-abc123.js" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Mise à jour du site' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Une nouvelle version du site vient d'être publiée. Rechargez la page pour continuer.",
      ),
    ).toBeInTheDocument();

    // jsdom ne peut pas exécuter location.reload() et cette propriété n'est
    // pas spiable (unforgeable). On prouve donc la branche « reload » :
    // l'enfant cesserait de lever l'erreur si la frontière se réinitialisait.
    bombEnabled = false;
    await userEvent.click(screen.getByRole('button', { name: 'Recharger la page' }));

    expect(screen.getByRole('heading', { name: 'Mise à jour du site' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger la page' })).toBeInTheDocument();
    expect(screen.queryByTestId('bomb-ok')).not.toBeInTheDocument();
  });

  it('traite « Loading chunk failed » comme une erreur de chunk', () => {
    render(
      <ErrorBoundary>
        <Bomb message="Loading chunk 42 failed. (missing: /assets/x.js)" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Mise à jour du site' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger la page' })).toBeInTheDocument();
  });

  it('ne classe pas une erreur ordinaire comme erreur de chunk', () => {
    render(
      <ErrorBoundary>
        <Bomb message="Cannot read properties of undefined (reading 'map')" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Une erreur est survenue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('se réinitialise quand les children changent (nouvelle route)', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Une erreur est survenue' })).toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <div data-testid="nouvelle-route">Nouvelle page</div>
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('nouvelle-route')).toHaveTextContent('Nouvelle page');
    expect(screen.queryByRole('heading', { name: 'Une erreur est survenue' })).not.toBeInTheDocument();
  });
});
