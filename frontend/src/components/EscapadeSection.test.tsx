import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import EscapadeSection from './EscapadeSection';

const scrollIntoView = vi.fn();

function renderEscapade(entry = '/bj') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <EscapadeSection />
      </MarketProvider>
    </MemoryRouter>,
  );
}

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
    renderEscapade();

    expect(screen.getByText('Escapade weekend')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Où aller en famille ?' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Des idées de sorties et découvertes pour profiter ensemble du meilleur du Bénin.",
      ),
    ).toBeInTheDocument();
  });

  it('affiche les cinq destinations avec leur description et leur image', () => {
    renderEscapade();

    for (const item of escapades) {
      expect(screen.getByRole('heading', { level: 3, name: item.title })).toBeInTheDocument();
      expect(screen.getByText(item.text)).toBeInTheDocument();
      const img = screen.getByAltText(item.title);
      expect(img).toHaveAttribute('src', item.img);
    }
  });

  it('présente chaque destination sous forme de bouton non soumis', () => {
    const { container } = renderEscapade();

    const buttons = container.querySelectorAll('.escapade__card');
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button');
    }
  });

  it("remonte vers la section accueil au clic sur une destination", async () => {
    renderEscapade();

    await userEvent.click(screen.getByRole('button', { name: /Ganvié/ }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it("ne fait rien quand la section #accueil est absente du DOM", async () => {
    document.getElementById('accueil')?.remove();
    renderEscapade();

    await userEvent.click(screen.getByRole('button', { name: /Ouidah/ }));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("ne cite pas la Côte d'Ivoire depuis la route /bj", () => {
    renderEscapade('/bj');

    expect(screen.queryByText(/Côte d'Ivoire/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Assinie' })).not.toBeInTheDocument();
  });
});

describe('EscapadeSection — marché Côte d’Ivoire (/ci)', () => {
  it("parle de la Côte d'Ivoire dans l'introduction", () => {
    renderEscapade('/ci');

    expect(
      screen.getByText(
        "Des idées de sorties et découvertes pour profiter ensemble du meilleur de la Côte d'Ivoire.",
      ),
    ).toBeInTheDocument();
  });

  it('affiche les cinq escapades ivoiriennes', () => {
    renderEscapade('/ci');

    const attendues = [
      { title: 'Assinie', text: 'Plages, lagunes et balades entre cocotiers.', img: '/images/pexels-fotoaibe-1571460.jpg' },
      { title: 'Grand-Bassam', text: 'Front de mer, musées et patrimoine classé à l’UNESCO.', img: '/images/pexels-artbovich-7214173.jpg' },
      { title: 'Yamoussoukro', text: 'Basilique de la Paix, jardins et grands axes.', img: '/images/pexels-artbovich-6283961.jpg' },
      { title: 'Korhogo', text: 'Savanes du nord, tissages et villages authentiques.', img: '/images/ouidah.jpg' },
      { title: 'Parc de la Comoé', text: 'Nature, randonnée et réserve de biosphère.', img: '/images/tori.jpg' },
    ];

    for (const item of attendues) {
      expect(screen.getByRole('heading', { level: 3, name: item.title })).toBeInTheDocument();
      expect(screen.getByText(item.text)).toBeInTheDocument();
      expect(screen.getByAltText(item.title)).toHaveAttribute('src', item.img);
    }
  });

  it('ne cite pas le Bénin depuis la route /ci', () => {
    renderEscapade('/ci');

    expect(screen.queryByText(/Bénin/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dahomey/)).not.toBeInTheDocument();
    for (const city of ['Ouidah', 'Ganvié', 'Grand Popo', 'Abomey', 'Tori Bossito']) {
      expect(screen.queryByRole('heading', { level: 3, name: city })).not.toBeInTheDocument();
    }
  });

  it('reste à cinq cartes cliquables', async () => {
    const { container } = renderEscapade('/ci');

    const buttons = container.querySelectorAll('.escapade__card');
    expect(buttons).toHaveLength(5);

    await userEvent.click(screen.getByRole('button', { name: /Assinie/ }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
