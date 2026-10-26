import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import SuiviVerificationPage from './SuiviVerificationPage';

function renderPage(path = '/ci/gerant/verification/suivi') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MarketProvider>
        <SuiviVerificationPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('SuiviVerificationPage', () => {
  it('affiche le suivi de la vérification et ses étapes', () => {
    const { container } = renderPage();

    expect(container.querySelector('.verif-maq')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Suivi de votre vérification' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: "Votre dossier est en cours d'examen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Détails de votre vérification' })).toBeInTheDocument();
    expect(screen.getByText('Documents soumis', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText("En cours d'examen")).toBeInTheDocument();
    expect(screen.getAllByText(/En attente/).length).toBeGreaterThan(0);
  });

  it('conserve les liens de navigation et de la sidebar', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    expect(screen.getByRole('link', { name: 'Suivi de vérification' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification/suivi',
    );
    expect(screen.getByRole('link', { name: 'Mes documents' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    expect(screen.getByRole('link', { name: /Contacter le support/ })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('adapte les liens au marché de l’URL', () => {
    renderPage('/bj/gerant/verification/suivi');

    expect(screen.getByRole('link', { name: /Retour/ })).toHaveAttribute(
      'href',
      '/bj/gerant/verification',
    );
    expect(screen.getByRole('link', { name: 'Toutes les chambres' })).toHaveAttribute(
      'href',
      '/bj/gerant/chambres',
    );
  });
});
