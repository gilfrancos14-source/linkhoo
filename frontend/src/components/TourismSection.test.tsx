import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import { FALLBACK_TOURISM } from '../data/tourism';
import TourismSection from './TourismSection';

const mocks = vi.hoisted(() => ({
  fetchDestinations: vi.fn(),
}));

vi.mock('../data/tourism', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/tourism')>();
  return { ...actual, fetchDestinationsByMarket: mocks.fetchDestinations };
});

const scrollIntoView = vi.fn();

function renderTourism(entry = '/bj') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <TourismSection />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function cardTitles(container: HTMLElement, selector: string): string[] {
  return [...container.querySelectorAll(`${selector} h3`)].map((el) => el.textContent ?? '');
}

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  document.body.insertAdjacentHTML('beforeend', '<div id="accueil"></div>');
  mocks.fetchDestinations.mockReset();
  mocks.fetchDestinations.mockImplementation((market: 'BJ' | 'CI') =>
    Promise.resolve(FALLBACK_TOURISM[market]),
  );
});

afterEach(() => {
  cleanup();
  document.getElementById('accueil')?.remove();
});

describe('TourismSection', () => {
  it("affiche le badge, le titre et l'introduction touristique", async () => {
    renderTourism();

    expect(screen.getByText('Nouvelle destination')).toBeInTheDocument();
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent('Découvrez le Bénin,');
    expect(title).toHaveTextContent('votre prochaine adresse touristique');
    expect(screen.getByText(/le Bénin vous attend pour un séjour inoubliable/)).toBeInTheDocument();
    await screen.findByRole('heading', { level: 3, name: 'Ouidah' });
  });

  it("affiche les deux grandes cartes Tori Bossito et Ouidah", async () => {
    const { container } = renderTourism();

    await screen.findByRole('heading', { level: 3, name: 'Tori Bossito' });

    expect(cardTitles(container, '.tourism__big-cards')).toEqual(['Tori Bossito', 'Ouidah']);
    expect(screen.getByAltText("Plage d'Ouidah")).toHaveAttribute('src', '/images/ouidah.jpg');
    expect(screen.getByAltText('Vallées de Tori Bossito')).toHaveAttribute('src', '/images/tori.jpg');
  });

  it('affiche les cinq petites cartes de destinations', async () => {
    const { container } = renderTourism();

    await screen.findByRole('heading', { level: 3, name: 'Abomey' });

    expect(cardTitles(container, '.tourism__small-cards')).toEqual([
      'Grand Popo',
      'Nikki',
      'Ganvié',
      'Porto-Novo',
      'Abomey',
    ]);
    expect(screen.getByText("Venise de l'Afrique, marchés flottants et traditions.")).toBeInTheDocument();
  });

  it('compte les destinations affichées dans le pied de section', async () => {
    renderTourism();

    expect(await screen.findByText('7 destinations, une seule émotion')).toBeInTheDocument();
  });

  it("ne cite pas la Côte d'Ivoire depuis la route /bj", async () => {
    renderTourism('/bj');

    await screen.findByText('7 destinations, une seule émotion');

    expect(screen.queryByText(/Côte d'Ivoire/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Grand-Bassam' })).not.toBeInTheDocument();
    expect(screen.getByText('Au cœur des traditions béninoises')).toBeInTheDocument();
  });

  it('propose uniquement des boutons (aucun lien) dans les cartes', async () => {
    const { container } = renderTourism();

    await screen.findByRole('heading', { level: 3, name: 'Ouidah' });

    const buttons = container.querySelectorAll('.tourism__big-card, .tourism__small-card');
    expect(buttons).toHaveLength(7);
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button');
      expect(button.tagName).toBe('BUTTON');
    }
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it("remonte vers la section accueil au clic sur une carte", async () => {
    renderTourism();

    await userEvent.click(await screen.findByRole('button', { name: /Plage d'Ouidah/ }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('déclenche le même retour vers accueil depuis une petite carte', async () => {
    renderTourism();

    await userEvent.click(await screen.findByRole('button', { name: /Porto-Novo/ }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('montre des cartes fantômes tant que la liste n’est pas servie', () => {
    mocks.fetchDestinations.mockImplementation(() => new Promise(() => {}));
    const { container } = renderTourism();

    expect(container.querySelectorAll('.card-skeleton').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.tourism__big-card, .tourism__small-card')).toHaveLength(0);
  });

  it('retombe sur les destinations de secours si l’API échoue', async () => {
    mocks.fetchDestinations.mockRejectedValue(new Error('réseau'));
    const { container } = renderTourism();

    await screen.findByRole('heading', { level: 3, name: 'Tori Bossito' });

    expect(cardTitles(container, '.tourism__big-cards')).toEqual(['Tori Bossito', 'Ouidah']);
  });

  it('change de cartes quand le marché change (aucune fuite de /bj sur /ci)', async () => {
    const { unmount } = renderTourism('/bj');
    await screen.findByRole('heading', { level: 3, name: 'Tori Bossito' });
    unmount();

    renderTourism('/ci');

    await screen.findByRole('heading', { level: 3, name: 'Bouaké' });
    expect(screen.queryByRole('heading', { level: 3, name: 'Tori Bossito' })).not.toBeInTheDocument();
  });
});

describe('TourismSection — marché Côte d’Ivoire (/ci)', () => {
  it("parle de la Côte d'Ivoire dans le titre et l'introduction", async () => {
    renderTourism('/ci');

    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent("Découvrez la Côte d'Ivoire,");
    expect(title).toHaveTextContent('votre prochaine adresse touristique');
    expect(
      screen.getByText(/la Côte d'Ivoire vous attend pour un séjour inoubliable/),
    ).toBeInTheDocument();
    expect(screen.getByText(/La Côte d'Ivoire/)).toBeInTheDocument();
    await screen.findByRole('heading', { level: 3, name: 'Bouaké' });
  });

  it('affiche les deux grandes cartes Abidjan et Bouaké (règle des 30 jours)', async () => {
    const { container } = renderTourism('/ci');

    await screen.findByRole('heading', { level: 3, name: 'Bouaké' });

    expect(cardTitles(container, '.tourism__big-cards')).toEqual(['Abidjan', 'Bouaké']);
    expect(screen.getByAltText('Abidjan vue depuis la ville')).toHaveAttribute(
      'src',
      '/images/pexels-artbovich-7214173.jpg',
    );
  });

  it('relègue Grand-Bassam en petite carte (aucun événement proche)', async () => {
    const { container } = renderTourism('/ci');

    await screen.findByRole('heading', { level: 3, name: 'Grand-Bassam' });

    expect(cardTitles(container, '.tourism__big-cards')).not.toContain('Grand-Bassam');
    expect(cardTitles(container, '.tourism__small-cards')).toEqual([
      'Grand-Bassam',
      'Assinie',
      'Yamoussoukro',
      'Korhogo',
      'San-Pédro',
    ]);
  });

  it('reste à sept cartes cliquables, toutes en bouton', async () => {
    const { container } = renderTourism('/ci');

    await screen.findByRole('heading', { level: 3, name: 'Bouaké' });

    const buttons = container.querySelectorAll('.tourism__big-card, .tourism__small-card');
    expect(buttons).toHaveLength(7);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(screen.getByText('7 destinations, une seule émotion')).toBeInTheDocument();
  });

  it('ne cite pas le Bénin depuis la route /ci', async () => {
    renderTourism('/ci');

    await screen.findByRole('heading', { level: 3, name: 'Bouaké' });

    expect(screen.queryByText(/Bénin/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Ouidah' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Ganvié' })).not.toBeInTheDocument();
    expect(screen.getByText('Au cœur des traditions ivoiriennes')).toBeInTheDocument();
  });

  it("remonte vers accueil depuis une carte ivoirienne", async () => {
    renderTourism('/ci');

    await userEvent.click(await screen.findByRole('button', { name: /Abidjan vue depuis la ville/ }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});
