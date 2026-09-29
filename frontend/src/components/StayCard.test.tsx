import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StayCard from './StayCard';

type StayCardProps = Parameters<typeof StayCard>[0];

const baseProps: StayCardProps = {
  image: '/images/suite.jpg',
  alt: 'Suite vue sur la mer',
  title: 'Villa Azur',
  description: 'À deux pas de la plage de Grand-Bassam',
  price: '15 000',
  priceUnit: 'FCFA / nuit',
  href: '/ci/chambre/1',
};

function renderCard(overrides: Partial<StayCardProps> = {}) {
  return render(
    <MemoryRouter initialEntries={['/ci']}>
      <Routes>
        <Route path="/ci/chambre/1" element={<div>Page de la chambre</div>} />
        <Route path="*" element={<StayCard {...baseProps} {...overrides} />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('StayCard', () => {
  it('affiche le titre, la description et le prix', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Villa Azur' })).toBeInTheDocument();
    expect(
      screen.getByText('À deux pas de la plage de Grand-Bassam'),
    ).toBeInTheDocument();
    const price = document.querySelector('.stay-card__price');
    expect(price).toHaveTextContent('dès');
    expect(price?.querySelector('strong')?.textContent).toBe('15 000\u00A0FCFA / nuit');
  });

  it('utilise le prix et le titre pour le libellé accessible du lien', () => {
    renderCard();

    expect(
      screen.getByRole('link', { name: 'Villa Azur, dès 15 000 FCFA / nuit' }),
    ).toBeInTheDocument();
  });

  it("honore l'ariaLabel personnalisé", () => {
    renderCard({ ariaLabel: 'Voir la Villa Azur' });

    expect(screen.getByRole('link', { name: 'Voir la Villa Azur' })).toBeInTheDocument();
  });

  it('affiche les caractéristiques dans une liste balisée', () => {
    renderCard({ meta: ['2 personnes', '1 chambre', 'Climatisation'] });

    const list = screen.getByRole('list', { name: 'Caractéristiques' });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Climatisation')).toBeInTheDocument();
  });

  it("n'affiche pas de liste de caractéristiques sans meta", () => {
    renderCard();

    expect(screen.queryByRole('list', { name: 'Caractéristiques' })).not.toBeInTheDocument();
    expect(document.querySelector('.stay-card__arrow')).not.toBeInTheDocument();
  });

  it('affiche le tag et le badge quand ils sont fournis', () => {
    renderCard({ tag: 'Nouveau', badge: 'Complet', badgeVariant: 'unavailable' });

    expect(screen.getByText('Nouveau')).toBeInTheDocument();
    const badge = screen.getByText('Complet');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('stay-card__badge--unavailable');
  });

  it("n'affiche ni tag ni badge s'ils sont absents", () => {
    renderCard();

    expect(document.querySelector('.stay-card__tag')).not.toBeInTheDocument();
    expect(document.querySelector('.stay-card__badge')).not.toBeInTheDocument();
  });

  it('affiche la notation de type localisation par défaut', () => {
    renderCard({ rating: '4,8' });

    const rating = screen.getByText('4,8');
    expect(rating.className).toContain('stay-card__rating--loc');
  });

  it("affiche la notation en étoiles quand ratingType est 'star'", () => {
    renderCard({ rating: '4,8', ratingType: 'star' });

    const rating = screen.getByText('4,8');
    expect(rating.className).not.toContain('stay-card__rating--loc');
  });

  it("n'affiche pas de notation sans rating", () => {
    renderCard();

    expect(document.querySelector('.stay-card__rating')).not.toBeInTheDocument();
  });

  it("navigue vers la chambre au clic sur la carte", async () => {
    renderCard();

    const link = screen.getByRole('link', { name: 'Villa Azur, dès 15 000 FCFA / nuit' });
    expect(link).toHaveAttribute('href', '/ci/chambre/1');

    await userEvent.click(link);

    expect(await screen.findByText('Page de la chambre')).toBeInTheDocument();
  });
});
