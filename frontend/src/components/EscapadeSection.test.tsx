import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EscapadeSection from './EscapadeSection';

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

const escapades: { title: string; text: string; img: string }[] = [
  { title: 'Ouidah', text: "Plages, musée d'histoire et balades en famille.", img: '/images/ouidah.jpg' },
  { title: 'Ganvié', text: 'Pirogue sur le lac, marchés flottants et découvertes.', img: '/images/pexels-artbovich-7045712.jpg' },
  { title: 'Grand Popo', text: "Lagune, plage sauvage et pique-nique au bord de l'eau.", img: '/images/pexels-artbovich-7214173.jpg' },
  { title: 'Abomey', text: 'Palais royaux, art et histoire du Dahomey.', img: '/images/pexels-artbovich-6283961.jpg' },
  { title: 'Tori Bossito', text: 'Nature, randonnée et villages authentiques.', img: '/images/tori.jpg' },
];

describe('EscapadeSection', () => {
  it("affiche le titre de la section et son introduction", () => {
    render(<EscapadeSection />);

    expect(screen.getByText('Escapade weekend')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Où aller en famille ?' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Des idées de sorties et découvertes pour profiter ensemble du meilleur du Bénin.",
      ),
    ).toBeInTheDocument();
  });

  it('affiche les cinq destinations avec leur description et leur image', () => {
    render(<EscapadeSection />);

    for (const item of escapades) {
      expect(screen.getByRole('heading', { level: 3, name: item.title })).toBeInTheDocument();
      expect(screen.getByText(item.text)).toBeInTheDocument();
      const img = screen.getByAltText(item.title);
      expect(img).toHaveAttribute('src', item.img);
    }
  });

  it('présente chaque destination sous forme de bouton non soumis', () => {
    const { container } = render(<EscapadeSection />);

    const buttons = container.querySelectorAll('.escapade__card');
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button');
    }
  });

  it("remonte vers la section accueil au clic sur une destination", async () => {
    render(<EscapadeSection />);

    await userEvent.click(screen.getByRole('button', { name: /Ganvié/ }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it("ne fait rien quand la section #accueil est absente du DOM", async () => {
    document.getElementById('accueil')?.remove();
    render(<EscapadeSection />);

    await userEvent.click(screen.getByRole('button', { name: /Ouidah/ }));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
