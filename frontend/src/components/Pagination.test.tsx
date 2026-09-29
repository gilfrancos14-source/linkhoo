import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';

/** Harness piloté par l'état : reproduit l'usage réel (parent qui avance la page). */
function PaginationHarness({
  totalPages,
  initial = 1,
  className,
}: {
  totalPages: number;
  initial?: number;
  className?: string;
}) {
  const [page, setPage] = useState(initial);
  return (
    <Pagination
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      className={className}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe('Pagination', () => {
  it('ne rend rien avec une seule page', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    );

    expect(container.querySelector('nav')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });

  it('ne rend rien avec zéro page', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />,
    );

    expect(container.querySelector('nav')).toBeNull();
  });

  it('expose la navigation « Pagination » avec tous les numéros de pages', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toBeInTheDocument();

    for (const page of ['1', '2', '3', '4', '5']) {
      expect(within(nav).getByRole('button', { name: page })).toBeInTheDocument();
    }
    expect(within(nav).getAllByRole('button')).toHaveLength(7);
  });

  it('marque la page courante avec la classe is-active', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} className="pg" />);

    const current = screen.getByRole('button', { name: '3' });
    expect(current.className).toContain('pg__btn is-active');

    const other = screen.getByRole('button', { name: '4' });
    expect(other.className).not.toContain('is-active');
  });

  it('désactive « Préc » sur la première page et « Suiv » sur la dernière', () => {
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: '← Préc' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Suiv →' })).toBeEnabled();

    rerender(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '← Préc' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Suiv →' })).toBeDisabled();
  });

  it('avance la page courante au clic sur « Suiv »', async () => {
    render(<PaginationHarness totalPages={5} className="pg" />);

    await userEvent.click(screen.getByRole('button', { name: 'Suiv →' }));

    expect(screen.getByRole('button', { name: '2' }).className).toContain('is-active');
    expect(screen.getByRole('button', { name: '1' }).className).not.toContain('is-active');
    expect(screen.getByRole('button', { name: '← Préc' })).toBeEnabled();
  });

  it('revient à la page précédente au clic sur « Préc »', async () => {
    render(<PaginationHarness totalPages={5} initial={3} />);

    await userEvent.click(screen.getByRole('button', { name: '← Préc' }));

    expect(screen.getByRole('button', { name: '2' }).className).toContain('is-active');
  });

  it('va directement à la page cliquée', async () => {
    render(<PaginationHarness totalPages={5} />);

    await userEvent.click(screen.getByRole('button', { name: '4' }));

    expect(screen.getByRole('button', { name: '4' }).className).toContain('is-active');
  });

  it('appelle onPageChange avec le numéro de page ciblé', async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Suiv →' }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);

    await userEvent.click(screen.getByRole('button', { name: '← Préc' }));
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);

    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onPageChange).toHaveBeenNthCalledWith(3, 5);
  });

  it('n’appelle pas onPageChange quand le bouton est désactivé', async () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
    );

    await userEvent.click(screen.getByRole('button', { name: '← Préc' }));
    expect(onPageChange).not.toHaveBeenCalled();

    rerender(<Pagination currentPage={3} totalPages={3} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Suiv →' }));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('applique la prop className aux boutons', () => {
    render(
      <Pagination currentPage={1} totalPages={2} onPageChange={vi.fn()} className="pager" />,
    );

    const prev = screen.getByRole('button', { name: '← Préc' });
    expect(prev.className).toBe('pager__btn');
    expect(screen.getByRole('button', { name: '2' }).className).toBe('pager__btn');
  });
});
