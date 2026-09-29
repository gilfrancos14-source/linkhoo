import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import MentionsLegales from './MentionsLegales';

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function renderMentions(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <LocationProbe />
        <Routes>
          <Route path="/:market" element={<div>Accueil du marché</div>} />
          <Route path="/:market/*" element={<MentionsLegales />} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

const sectionTitles = [
  '1. Éditeur du site',
  '2. Hébergeur',
  '3. Propriété intellectuelle',
  '4. Données personnelles',
  '5. Cookies',
  '6. Limitation de responsabilité',
  '7. Liens hypertextes',
  '8. Droit applicable',
];

afterEach(() => {
  cleanup();
});

describe('MentionsLegales', () => {
  it("affiche le titre de la page et sa date de mise à jour", () => {
    renderMentions('/ci/mentions-legales');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Mentions légales' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dernière mise à jour : 9 septembre 2026')).toBeInTheDocument();
  });

  it('contient les huit sections légales dans l’ordre', () => {
    renderMentions('/ci/mentions-legales');

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(8);
    expect(headings.map((h) => h.textContent)).toEqual(sectionTitles);
  });

  it('détaille l’éditeur et ses coordonnées', () => {
    renderMentions('/ci/mentions-legales');

    expect(screen.getByText('linkhoo.com')).toBeInTheDocument();
    expect(screen.getByText('Directeur de la publication :')).toBeInTheDocument();
    expect(screen.getByText('M. Alassan H.')).toBeInTheDocument();
    // L'adresse email apparaît deux fois : coordonnées de l'éditeur et contact RGPD.
    expect(screen.getAllByText('bonjour@linkhoo.com')).toHaveLength(2);
    expect(screen.getByText('+33 1 23 45 67 89')).toBeInTheDocument();
  });

  it('indique l’hébergeur du site', () => {
    renderMentions('/ci/mentions-legales');

    expect(screen.getByRole('heading', { level: 2, name: '2. Hébergeur' })).toBeInTheDocument();
    expect(screen.getByText(/Vercel Inc\./)).toBeInTheDocument();
  });

  it("propose un retour à l'accueil calqué sur le marché de l’URL", async () => {
    renderMentions('/bj/mentions-legales');

    const back = screen.getByRole('link', { name: "← Retour à l'accueil" });
    expect(back).toHaveAttribute('href', '/bj');

    await userEvent.click(back);

    expect(screen.getByTestId('pathname')).toHaveTextContent('/bj');
    expect(screen.getByText('Accueil du marché')).toBeInTheDocument();
  });

  it('relie la politique de confidentialité depuis la section données personnelles', () => {
    renderMentions('/bj/mentions-legales');

    const link = screen.getByRole('link', { name: 'Politique de confidentialité' });
    expect(link).toHaveAttribute('href', '/bj/politique-de-confidentialite');
  });

  it('annonce les droits RGPD et le contact pour les données personnelles', () => {
    renderMentions('/ci/mentions-legales');

    expect(screen.getByText(/Règlement Général sur la Protection des Données/)).toBeInTheDocument();
    expect(
      screen.getByText(/nous contacter à l'adresse/),
    ).toBeInTheDocument();
  });

  it('avertit sur les cookies techniques sans consentement de tracking', () => {
    renderMentions('/ci/mentions-legales');

    expect(screen.getByRole('heading', { level: 2, name: '5. Cookies' })).toBeInTheDocument();
    expect(screen.getByText(/Aucun cookie de tracking/)).toBeInTheDocument();
  });
});
