import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import AProposPage from './AProposPage';

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function renderAPropos(entry = '/a-propos') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <LocationProbe />
        <Routes>
          <Route path="/" element={<div>Accueil</div>} />
          <Route path="/a-propos" element={<AProposPage />} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

const sectionTitles = [
  '1. Qui sommes-nous ?',
  '2. Notre mission',
  '3. Comment ça marche ?',
  '4. Nos marchés',
  '5. Nos engagements',
  '6. Contact',
];

afterEach(() => {
  cleanup();
});

describe('AProposPage', () => {
  it("affiche le titre de la page et sa date de mise à jour", () => {
    renderAPropos();

    expect(
      screen.getByRole('heading', { level: 1, name: 'À propos de Linkhoo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dernière mise à jour : 9 septembre 2026')).toBeInTheDocument();
  });

  it('contient les six sections dans l’ordre', () => {
    renderAPropos();

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(6);
    expect(headings.map((h) => h.textContent)).toEqual(sectionTitles);
  });

  it("propose un retour à l'accueil racine", async () => {
    renderAPropos();

    const back = screen.getByRole('link', { name: "← Retour à l'accueil" });
    expect(back).toHaveAttribute('href', '/');

    await userEvent.click(back);

    expect(screen.getByTestId('pathname')).toHaveTextContent('/');
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });

  it('relie chaque marché depuis la section Nos marchés', () => {
    renderAPropos();

    expect(screen.getByRole('link', { name: "Côte d'Ivoire" })).toHaveAttribute('href', '/ci');
    expect(screen.getByRole('link', { name: 'Bénin' })).toHaveAttribute('href', '/bj');
  });

  it('relie les mentions légales et la politique de confidentialité', () => {
    renderAPropos();

    expect(
      screen.getByRole('link', { name: 'mentions légales' }),
    ).toHaveAttribute('href', '/ci/mentions-legales');
    expect(
      screen.getByRole('link', { name: 'Politique de confidentialité' }),
    ).toHaveAttribute('href', '/ci/politique-de-confidentialite');
  });

  it("affiche le contact et la mission de la plateforme", () => {
    renderAPropos();

    expect(screen.getByText('bonjour@linkhoo.com')).toBeInTheDocument();
    expect(screen.getByText(/Connecter directement locataires/)).toBeInTheDocument();
  });

  it('relie le formulaire de contact depuis la section Contact', () => {
    renderAPropos();

    expect(
      screen.getByRole('link', { name: 'formulaire de contact' }),
    ).toHaveAttribute('href', '/contact');
  });
});
