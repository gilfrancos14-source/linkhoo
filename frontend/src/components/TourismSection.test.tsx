import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TourismSection from './TourismSection';

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  document.body.insertAdjacentHTML('beforeend', '<div id="accueil"></div>');
});

afterEach(() => {
  cleanup();
  document.getElementById('accueil')?.remove();
});

describe('TourismSection', () => {
  it("affiche le badge, le titre et l'introduction touristique", () => {
    render(<TourismSection />);

    expect(screen.getByText('Nouvelle destination')).toBeInTheDocument();
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent('Découvrez le Bénin,');
    expect(title).toHaveTextContent('votre prochaine adresse touristique');
    expect(screen.getByText(/le Bénin vous attend pour un séjour inoubliable/)).toBeInTheDocument();
  });

  it("affiche les deux grandes cartes Ouidah et Grand Popo", () => {
    render(<TourismSection />);

    expect(screen.getByRole('heading', { level: 3, name: 'Ouidah' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Grand Popo' })).toBeInTheDocument();
    expect(screen.getByAltText("Plage d'Ouidah")).toHaveAttribute('src', '/images/ouidah.jpg');
    expect(screen.getByAltText('Plage de Grand Popo')).toHaveAttribute('src', '/images/tori.jpg');
  });

  it('affiche les quatre petites cartes de destinations', () => {
    render(<TourismSection />);

    for (const city of ['Nikki', 'Ganvié', 'Porto-Novo', 'Abomey']) {
      expect(screen.getByRole('heading', { level: 3, name: city })).toBeInTheDocument();
    }
    expect(screen.getByText("Venise de l'Afrique, marchés flottants et traditions.")).toBeInTheDocument();
  });

  it('propose uniquement des boutons (aucun lien) dans les cartes', () => {
    const { container } = render(<TourismSection />);

    const buttons = container.querySelectorAll('.tourism__big-card, .tourism__small-card');
    expect(buttons).toHaveLength(6);
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button');
      expect(button.tagName).toBe('BUTTON');
    }
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it("remonte vers la section accueil au clic sur une carte", async () => {
    render(<TourismSection />);

    await userEvent.click(screen.getByRole('button', { name: /Plage d'Ouidah/ }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('déclenche le même retour vers accueil depuis une petite carte', async () => {
    render(<TourismSection />);

    await userEvent.click(screen.getByRole('button', { name: /Porto-Novo/ }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
