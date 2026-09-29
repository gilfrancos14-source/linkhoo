import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import NotFoundPage from './NotFoundPage';

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function renderNotFound(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <LocationProbe />
        <Routes>
          <Route path="/:market" element={<div>Accueil du marché</div>} />
          <Route path="/:market/*" element={<NotFoundPage />} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

function renderNotFoundStandalone(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <LocationProbe />
        <NotFoundPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('NotFoundPage', () => {
  it('affiche le code 404 et le titre de la page', () => {
    renderNotFound('/ci/page-inconnue');

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeInTheDocument();
  });

  it("explique que la page demandée n'existe pas", () => {
    renderNotFound('/ci/page-inconnue');

    expect(
      screen.getByText("La page que vous recherchez n'existe pas ou a été déplacée."),
    ).toBeInTheDocument();
  });

  it("encapsule le message dans le conteneur d'erreur principal", () => {
    renderNotFound('/ci/page-inconnue');

    const main = screen.getByRole('main');
    expect(main).toHaveClass('error-page');
    expect(main.querySelector('.error-page__code')).toHaveTextContent('404');
  });

  it("propose un lien de retour à l'accueil calqué sur le marché de l'URL", () => {
    renderNotFound('/bj/introuvable/quoi');

    const link = screen.getByRole('link', { name: "Retour à l'accueil" });
    expect(link).toHaveAttribute('href', '/bj');
  });

  it("navigue vers l'accueil du marché au clic sur le lien de retour", async () => {
    renderNotFound('/bj/introuvable/quoi');

    await userEvent.click(screen.getByRole('link', { name: "Retour à l'accueil" }));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/bj');
    expect(screen.getByText('Accueil du marché')).toBeInTheDocument();
    expect(screen.queryByText('404')).not.toBeInTheDocument();
  });

  it("retombe sur le marché CI quand l'URL ne porte pas de segment de marché", () => {
    renderNotFoundStandalone('/introuvable');

    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/ci');
  });
});
