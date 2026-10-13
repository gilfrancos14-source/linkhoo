import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import type { EscapadeCard } from '../data/escapades';
import EscapadeSection from './EscapadeSection';

const mocks = vi.hoisted(() => ({
  fetchEscapades: vi.fn(),
}));

vi.mock('../data/escapades', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/escapades')>();
  return { ...actual, fetchEscapadesByMarket: mocks.fetchEscapades };
});

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
  mocks.fetchEscapades.mockReset();
  mocks.fetchEscapades.mockImplementation((market: string) =>
    Promise.resolve(market === 'BJ' ? BJ_ESCAPADES : CI_ESCAPADES),
  );
});

afterEach(() => {
  cleanup();
});

const BJ_ESCAPADES: EscapadeCard[] = [
  { id: 'esc-bj-ouidah', lieu: 'Ouidah', text: "Plages, musée d'histoire et balades en famille.", cover: '/images/ouidah.jpg', images: ['/images/ouidah.jpg'] },
  { id: 'esc-bj-ganvie', lieu: 'Ganvié', text: 'Pirogue sur le lac, marchés flottants et découvertes.', cover: '/images/pexels-artbovich-7045712.jpg', images: ['/images/pexels-artbovich-7045712.jpg', '/images/tori.jpg'] },
  { id: 'esc-bj-grand-popo', lieu: 'Grand Popo', text: "Lagune, plage sauvage et pique-nique au bord de l'eau.", cover: '/images/pexels-artbovich-7214173.jpg', images: ['/images/pexels-artbovich-7214173.jpg'] },
  { id: 'esc-bj-abomey', lieu: 'Abomey', text: 'Palais royaux, art et histoire du Dahomey.', cover: '/images/pexels-artbovich-6283961.jpg', images: ['/images/pexels-artbovich-6283961.jpg'] },
  { id: 'esc-bj-tori-bossito', lieu: 'Tori Bossito', text: 'Nature, randonnée et villages authentiques.', cover: '/images/tori.jpg', images: ['/images/tori.jpg'] },
];

const CI_ESCAPADES: EscapadeCard[] = [
  { id: 'esc-ci-assinie', lieu: 'Assinie', text: 'Plages, lagunes et balades entre cocotiers.', cover: '/images/pexels-fotoaibe-1571460.jpg', images: ['/images/pexels-fotoaibe-1571460.jpg'] },
  { id: 'esc-ci-grand-bassam', lieu: 'Grand-Bassam', text: 'Front de mer, musées et patrimoine classé à l’UNESCO.', cover: '/images/pexels-artbovich-7214173.jpg', images: ['/images/pexels-artbovich-7214173.jpg'] },
  { id: 'esc-ci-yamoussoukro', lieu: 'Yamoussoukro', text: 'Basilique de la Paix, jardins et grands axes.', cover: '/images/pexels-artbovich-6283961.jpg', images: ['/images/pexels-artbovich-6283961.jpg'] },
  { id: 'esc-ci-korhogo', lieu: 'Korhogo', text: 'Savanes du nord, tissages et villages authentiques.', cover: '/images/ouidah.jpg', images: ['/images/ouidah.jpg'] },
  { id: 'esc-ci-parc-comoe', lieu: 'Parc de la Comoé', text: 'Nature, randonnée et réserve de biosphère.', cover: '/images/tori.jpg', images: ['/images/tori.jpg'] },
];

describe('EscapadeSection', () => {
  it("affiche le titre de la section et son introduction", async () => {
    renderEscapade();

    expect(screen.getByText('Escapade weekend')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Où aller en famille ?' })).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Des idées de sorties et découvertes pour profiter ensemble du meilleur du Bénin.",
      ),
    ).toBeInTheDocument();
  });

  it('affiche les cinq destinations avec leur description et leur image', async () => {
    renderEscapade();

    await screen.findByRole('heading', { level: 3, name: 'Ouidah' });

    for (const item of BJ_ESCAPADES) {
      expect(screen.getByRole('heading', { level: 3, name: item.lieu })).toBeInTheDocument();
      expect(screen.getByText(item.text)).toBeInTheDocument();
      expect(screen.getByAltText(item.lieu)).toHaveAttribute('src', item.cover);
    }
  });

  it('présente chaque destination sous forme de bouton non soumis', async () => {
    const { container } = renderEscapade();

    await screen.findByRole('heading', { level: 3, name: 'Ouidah' });

    const buttons = container.querySelectorAll('.escapade__card');
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button).toHaveAttribute('role', 'button');
    }
  });

  it('ouvre le panneau de détail au clic sur une carte', async () => {
    const { container } = renderEscapade();

    await screen.findByRole('heading', { level: 3, name: 'Ganvié' });
    await userEvent.click(screen.getByRole('button', { name: /Ganvié/ }));

    const detail = container.querySelector('.escapade-detail');
    expect(detail).toHaveClass('is-open');
    expect(detail).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByAltText('Ganvié — image 1')).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('referme le panneau au re-clic (toggle)', async () => {
    const { container } = renderEscapade();

    await screen.findByRole('heading', { level: 3, name: 'Ouidah' });
    const card = screen.getByRole('button', { name: /Ouidah/ });

    await userEvent.click(card);
    expect(container.querySelector('.escapade-detail')).toHaveClass('is-open');

    await userEvent.click(card);
    expect(container.querySelector('.escapade-detail')).not.toHaveClass('is-open');
  });

  it('affiche le bouton fermer et ferme le panneau', async () => {
    const { container } = renderEscapade();

    await screen.findByRole('heading', { level: 3, name: 'Ouidah' });
    await userEvent.click(screen.getByRole('button', { name: /Ouidah/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(container.querySelector('.escapade-detail')).not.toHaveClass('is-open');
  });

  it('affiche un carrousel avec flèches et puces quand plusieurs images', async () => {
    const { container } = renderEscapade();

    await screen.findByRole('heading', { level: 3, name: 'Ganvié' });
    await userEvent.click(screen.getByRole('button', { name: /Ganvié/ }));

    expect(screen.getByRole('button', { name: 'Image suivante' })).toBeInTheDocument();
    expect(container.querySelectorAll('.escapade-detail__dot')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Image suivante' }));
    expect(screen.getByAltText('Ganvié — image 2')).toBeInTheDocument();
  });

  it("ne cite pas la Côte d'Ivoire depuis la route /bj", async () => {
    renderEscapade('/bj');

    await screen.findByRole('heading', { level: 3, name: 'Ouidah' });

    expect(screen.queryByText(/Côte d'Ivoire/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Assinie' })).not.toBeInTheDocument();
  });

  it('masque la section quand la liste est vide (sans fallback)', async () => {
    mocks.fetchEscapades.mockResolvedValue([]);
    const { container } = renderEscapade();

    await waitFor(() => expect(container.querySelector('.escapade')).not.toBeInTheDocument());
  });

  it('masque la section quand le fetch échoue (sans fallback)', async () => {
    mocks.fetchEscapades.mockRejectedValue(new Error('boom'));
    const { container } = renderEscapade();

    await waitFor(() => expect(container.querySelector('.escapade')).not.toBeInTheDocument());
  });
});

describe('EscapadeSection — marché Côte d’Ivoire (/ci)', () => {
  it("parle de la Côte d'Ivoire dans l'introduction", async () => {
    renderEscapade('/ci');

    expect(
      await screen.findByText(
        "Des idées de sorties et découvertes pour profiter ensemble du meilleur de la Côte d'Ivoire.",
      ),
    ).toBeInTheDocument();
  });

  it('affiche les cinq escapades ivoiriennes', async () => {
    renderEscapade('/ci');

    await screen.findByRole('heading', { level: 3, name: 'Assinie' });

    for (const item of CI_ESCAPADES) {
      expect(screen.getByRole('heading', { level: 3, name: item.lieu })).toBeInTheDocument();
      expect(screen.getByText(item.text)).toBeInTheDocument();
      expect(screen.getByAltText(item.lieu)).toHaveAttribute('src', item.cover);
    }
  });

  it('ne cite pas le Bénin depuis la route /ci', async () => {
    renderEscapade('/ci');

    await screen.findByRole('heading', { level: 3, name: 'Assinie' });

    expect(screen.queryByText(/Bénin/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dahomey/)).not.toBeInTheDocument();
    for (const lieu of ['Ouidah', 'Ganvié', 'Grand Popo', 'Abomey', 'Tori Bossito']) {
      expect(screen.queryByRole('heading', { level: 3, name: lieu })).not.toBeInTheDocument();
    }
  });

  it('filtre par marché au changement de route', async () => {
    renderEscapade('/bj');
    await screen.findByRole('heading', { level: 3, name: 'Ouidah' });

    cleanup();
    renderEscapade('/ci');

    await screen.findByRole('heading', { level: 3, name: 'Assinie' });
    expect(mocks.fetchEscapades).toHaveBeenLastCalledWith('CI');
  });
});
