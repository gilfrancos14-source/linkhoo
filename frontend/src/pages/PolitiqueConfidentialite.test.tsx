import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import PolitiqueConfidentialite from './PolitiqueConfidentialite';

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function renderPolitique(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <LocationProbe />
        <Routes>
          <Route path="/:market" element={<div>Accueil du marché</div>} />
          <Route path="/:market/*" element={<PolitiqueConfidentialite />} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

const sectionTitles = [
  '1. Responsable du traitement',
  '2. Données collectées',
  '3. Finalités du traitement',
  '4. Base légale du traitement',
  '5. Durée de conservation',
  '6. Destinataires des données',
  '7. Vos droits',
  '8. Sécurité',
  '9. Cookies',
  '10. Réclamation',
  '11. Modifications',
];

afterEach(() => {
  cleanup();
});

describe('PolitiqueConfidentialite', () => {
  it("affiche le titre de la page et sa date de mise à jour", () => {
    renderPolitique('/ci/politique-de-confidentialite');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Politique de confidentialité' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dernière mise à jour : 9 septembre 2026')).toBeInTheDocument();
  });

  it('contient les onze sections légales dans l’ordre', () => {
    renderPolitique('/ci/politique-de-confidentialite');

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(11);
    expect(headings.map((h) => h.textContent)).toEqual(sectionTitles);
  });

  it('détaille le responsable du traitement', () => {
    renderPolitique('/ci/politique-de-confidentialite');

    const responsable = screen
      .getAllByRole('list')
      .find((list) => within(list).queryByText('Linkhoo SAS'));
    expect(responsable).toBeDefined();
    const box = within(responsable as HTMLElement);
    expect(box.getByText('12 Avenue des Artisans, 75010 Paris')).toBeInTheDocument();
    expect(box.getByText('bonjour@linkhoo.com')).toBeInTheDocument();
    expect(box.getByText('+33 1 23 45 67 89')).toBeInTheDocument();
  });

  it('liste les trois familles de données collectées', () => {
    renderPolitique('/ci/politique-de-confidentialite');

    const families = screen
      .getAllByRole('list')
      .find((list) => within(list).queryByText("Données d'identification :"));
    expect(families).toBeDefined();
    const box = within(families as HTMLElement);
    expect(box.getAllByRole('listitem')).toHaveLength(3);
    expect(box.getByText('Données de navigation :')).toBeInTheDocument();
    expect(box.getByText('Données de transaction :')).toBeInTheDocument();
  });

  it('précise les durées de conservation', () => {
    renderPolitique('/ci/politique-de-confidentialite');

    const retention = screen
      .getAllByRole('list')
      .find((list) => within(list).queryByText(/13 mois maximum/));
    expect(retention).toBeDefined();
    expect(within(retention as HTMLElement).getByText(/5 ans \(obligation comptable\)/)).toBeInTheDocument();
    expect(within(retention as HTMLElement).getByText(/pendant la durée de la relation commerciale \+ 3 ans/)).toBeInTheDocument();
  });

  it('énumère les six droits RGPD de l’utilisateur', () => {
    renderPolitique('/ci/politique-de-confidentialite');

    const rights = screen
      .getAllByRole('list')
      .find((list) => within(list).queryByText("Droit d'accès :"));
    expect(rights).toBeDefined();
    const items = within(rights as HTMLElement).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(within(rights as HTMLElement).getByText('Droit à la portabilité :')).toBeInTheDocument();
    expect(within(rights as HTMLElement).getByText("Droit d'opposition :")).toBeInTheDocument();
  });

  it('engage la responsabilité sur la sécurité des données', () => {
    renderPolitique('/ci/politique-de-confidentialite');

    expect(screen.getByRole('heading', { level: 2, name: '8. Sécurité' })).toBeInTheDocument();
    expect(screen.getByText('Chiffrement TLS/SSL pour les données en transit')).toBeInTheDocument();
    expect(screen.getByText('Sauvegardes régulières')).toBeInTheDocument();
  });

  it("indique comment introduire une réclamation auprès de la CNIL", () => {
    renderPolitique('/ci/politique-de-confidentialite');

    expect(screen.getByRole('heading', { level: 2, name: '10. Réclamation' })).toBeInTheDocument();
    expect(screen.getByText('www.cnil.fr')).toBeInTheDocument();
    expect(screen.getByText(/3 Place de Fontenoy/)).toBeInTheDocument();
  });

  it('interdit la vente des données à des tiers', () => {
    renderPolitique('/ci/politique-de-confidentialite');

    expect(screen.getByText('Nous ne vendons jamais vos données à des tiers.')).toBeInTheDocument();
  });

  it("propose un retour à l'accueil calqué sur le marché de l’URL", async () => {
    renderPolitique('/bj/politique-de-confidentialite');

    const back = screen.getByRole('link', { name: "← Retour à l'accueil" });
    expect(back).toHaveAttribute('href', '/bj');

    await userEvent.click(back);

    expect(screen.getByTestId('pathname')).toHaveTextContent('/bj');
    expect(screen.getByText('Accueil du marché')).toBeInTheDocument();
  });
});
