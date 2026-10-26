import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AProposPage from './AProposPage';

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="pathname">{pathname}</span>;
}

function renderAPropos(entry = '/a-propos') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<div>Accueil</div>} />
        <Route path="/contact" element={<div>Contact</div>} />
        <Route path="/a-propos" element={<AProposPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AProposPage', () => {
  it('affiche le hero et son fil d’Ariane', () => {
    renderAPropos();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Notre mission : rendre la location plus simple, plus sûre et plus proche de vous.',
    );
    expect(screen.getByText('À propos de Linkhoo')).toBeInTheDocument();
    const homeLinks = screen.getAllByRole('link', { name: 'Accueil' });
    expect(homeLinks.length).toBeGreaterThan(0);
    expect(homeLinks[0]).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Découvrir nos marchés' })).toHaveAttribute(
      'href',
      '/#ou-louer',
    );
  });

  it('marque À propos comme page active dans la navigation', () => {
    renderAPropos();

    const active = screen
      .getAllByRole('link', { name: 'À propos' })
      .find((link) => link.getAttribute('aria-current') === 'page');
    expect(active).toBeDefined();
    expect(active).toHaveAttribute('href', '/a-propos');
    for (const link of screen.getAllByRole('link', { name: 'Contact' })) {
      expect(link).toHaveAttribute('href', '/contact');
    }
  });

  it('présente la mission, la vision et les valeurs', () => {
    renderAPropos();

    expect(screen.getByRole('heading', { level: 2, name: 'Notre mission' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Notre vision' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Nos valeurs' })).toBeInTheDocument();
    expect(screen.getByText('Impact local')).toBeInTheDocument();
  });

  it('affiche les chiffres clés de la plateforme', () => {
    renderAPropos();

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('+ 50 000')).toBeInTheDocument();
    expect(screen.getByText('+ 10 000')).toBeInTheDocument();
    expect(screen.getByText('99%')).toBeInTheDocument();
  });

  it('met en avant les quatre avantages de Linkhoo', () => {
    renderAPropos();

    expect(screen.getByRole('heading', { level: 3, name: 'Paiement sécurisé' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Réservation instantanée' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Service client réactif' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Ancrage local' })).toBeInTheDocument();
  });

  it('présente l’équipe et le bandeau d’appel à l’action', () => {
    renderAPropos();

    expect(
      screen.getByRole('heading', { level: 2, name: /Des passionnés derrière Linkhoo/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Prêt à trouver votre prochain séjour ?',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorer les annonces' })).toHaveAttribute(
      'href',
      '/ci',
    );
  });

  it('relie les marchés et les pages légales depuis le pied de page', () => {
    renderAPropos();

    expect(screen.getByRole('link', { name: 'Sénégal' })).toHaveAttribute('href', '/sn');
    expect(screen.getByRole('link', { name: "Côte d'Ivoire" })).toHaveAttribute('href', '/ci');
    expect(screen.getByRole('link', { name: 'Bénin' })).toHaveAttribute('href', '/bj');
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute(
      'href',
      '/ci/mentions-legales',
    );
    expect(screen.getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute(
      'href',
      '/ci/politique-de-confidentialite',
    );
  });

  it('ferme le bandeau promo et ouvre le menu mobile', async () => {
    renderAPropos();

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(
      screen.queryByText("Louer en toute confiance, partout en Afrique de l'Ouest !"),
    ).not.toBeInTheDocument();

    const menu = screen.getByRole('button', { name: 'Menu' });
    await userEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'À propos', current: 'page' })).toBeInTheDocument();
  });

  it('remonte en haut de page depuis le bouton flottant', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderAPropos();

    await userEvent.click(screen.getByRole('button', { name: 'Haut de page' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
