import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import BannerCarousel from './BannerCarousel';
import type { Banner } from '../data/banners';

// jsdom n'implémente ni window.matchMedia ni Element.scrollTo :
// BannerCarousel lit matchMedia AU CHARGEMENT DU MODULE, le stub doit donc
// être posé avant l'évaluation des imports (d'où vi.hoisted).
const scrollToMock = vi.hoisted(() => {
  const fn = vi.fn();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollTo = fn as unknown as typeof Element.prototype.scrollTo;
  return fn;
});

const banners: Banner[] = [
  { id: 'b1', section: 'popular', img: '/images/1.jpg', alt: 'Bannière un', link: '/ci/chambres', market: 'CI', order: 1 },
  { id: 'b2', section: 'popular', img: '/images/2.jpg', alt: 'Bannière deux', link: '/ci/promos', market: 'CI', order: 2 },
  { id: 'b3', section: 'popular', img: '/images/3.jpg', alt: 'Bannière trois', link: '/ci/hotels', market: 'CI', order: 3 },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderCarousel(list: Banner[]) {
  return render(
    <MemoryRouter initialEntries={['/ci']}>
      <BannerCarousel banners={list} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function dots(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.banner-carousel__dot'));
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('BannerCarousel', () => {
  it("n'affiche rien quand la liste de bannières est vide", () => {
    const { container } = renderCarousel([]);

    expect(container.querySelector('.banner-carousel')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bannières promotionnelles' })).not.toBeInTheDocument();
  });

  it('affiche chaque bannière comme un lien vers sa destination', async () => {
    renderCarousel(banners.slice(0, 1));

    const region = screen.getByRole('region', { name: 'Bannières promotionnelles' });
    expect(region).toBeInTheDocument();

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/ci/chambres');
    expect(screen.getByAltText('Bannière un')).toHaveAttribute('src', '/images/1.jpg');

    await userEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent('/ci/chambres');
  });

  it("n'affiche pas de puces avec une seule bannière", () => {
    const { container } = renderCarousel(banners.slice(0, 1));

    expect(container.querySelector('.banner-carousel__dots')).not.toBeInTheDocument();
    expect(dots(container)).toHaveLength(0);
  });

  it('affiche une puce par bannière avec la première active', () => {
    const { container } = renderCarousel(banners);

    const all = dots(container);
    expect(all).toHaveLength(3);
    expect(all[0]).toHaveClass('is-active');
    expect(all[1]).not.toHaveClass('is-active');
    expect(screen.getByRole('tablist', { name: 'Diapositives' })).toBeInTheDocument();
    expect(all[2]).toHaveAttribute('aria-label', 'Bannière 3');
  });

  it('active la bannière correspondante au clic sur sa puce', async () => {
    const { container } = renderCarousel(banners);

    await userEvent.click(dots(container)[2]);

    expect(dots(container)[2]).toHaveClass('is-active');
    expect(dots(container)[0]).not.toHaveClass('is-active');
    expect(scrollToMock).toHaveBeenCalled();
  });

  it("masque l'image dont le chargement échoue", () => {
    renderCarousel(banners.slice(0, 1));

    const img = screen.getByAltText('Bannière un');
    fireEvent.error(img);

    expect(img).toHaveStyle({ display: 'none' });
  });

  it("avance automatiquement d'une bannière toutes les 5 secondes sur desktop", () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { container } = renderCarousel(banners);

    expect(dots(container)[0]).toHaveClass('is-active');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(dots(container)[1]).toHaveClass('is-active');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(dots(container)[2]).toHaveClass('is-active');
  });

  it("met en pause le défilement automatique au survol puis le reprend", () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { container } = renderCarousel(banners);
    const region = screen.getByRole('region', { name: 'Bannières promotionnelles' });

    fireEvent.mouseOver(region);
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(dots(container)[0]).toHaveClass('is-active');

    fireEvent.mouseOut(region);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(dots(container)[1]).toHaveClass('is-active');
  });
});
