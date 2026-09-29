import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CardSkeleton from './CardSkeleton';

afterEach(() => {
  cleanup();
});

describe('CardSkeleton', () => {
  it('rend 4 cartes fantômes par défaut', () => {
    const { container } = render(<CardSkeleton />);

    expect(container.querySelectorAll('.card-skeleton')).toHaveLength(4);
  });

  it('respecte la prop count', () => {
    const { container, rerender } = render(<CardSkeleton count={1} />);
    expect(container.querySelectorAll('.card-skeleton')).toHaveLength(1);

    rerender(<CardSkeleton count={7} />);
    expect(container.querySelectorAll('.card-skeleton')).toHaveLength(7);
  });

  it('masque les cartes fantômes des technologies d’assistance', () => {
    const { container } = render(<CardSkeleton count={2} />);

    const skeletons = container.querySelectorAll('.card-skeleton');
    skeletons.forEach((skeleton) => {
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('affiche la structure média / corps / lignes de chaque carte', () => {
    const { container } = render(<CardSkeleton count={1} />);

    const skeleton = container.querySelector('.card-skeleton');
    expect(skeleton).not.toBeNull();
    expect(skeleton!.querySelector('.card-skeleton__media')).not.toBeNull();

    const lines = skeleton!.querySelectorAll<HTMLSpanElement>('.card-skeleton__line');
    expect(lines).toHaveLength(2);
    expect(lines[0].style.width).toBe('72%');
    expect(lines[1].style.width).toBe('46%');
    expect(lines[1].className).toContain('card-skeleton__line--sm');
  });

  it('ne rend rien quand count vaut 0', () => {
    const { container } = render(<CardSkeleton count={0} />);

    expect(container.querySelector('.card-skeleton')).toBeNull();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
