import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientSidebar from './ClientSidebar';

vi.mock('../../hooks/useHomePath', () => ({ useHomePath: () => '/ci' }));
vi.mock('../../hooks/useClientUnread', () => ({ useClientUnread: () => 0 }));
vi.mock('../../lib/clientSidebarStore', () => ({
  useClientSidebar: () => ({ open: false, collapsed: false }),
  clientSidebarStore: { close: vi.fn(), toggleCollapsed: vi.fn(), toggle: vi.fn() },
}));

describe('ClientSidebar — en-tête', () => {
  it("n'affiche ni la croix ni la flèche de réduction", () => {
    render(
      <MemoryRouter>
        <ClientSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('img', { name: 'Logo Linkhoo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fermer la navigation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réduire la navigation' })).not.toBeInTheDocument();
    expect(document.querySelector('.client-sidebar__close')).toBeNull();
    expect(document.querySelector('.client-sidebar__toggle')).toBeNull();
  });

  it('conserve les liens de navigation', () => {
    render(
      <MemoryRouter>
        <ClientSidebar />
      </MemoryRouter>,
    );

    const sidebar = document.querySelector<HTMLElement>('aside.client-sidebar');
    if (!sidebar) throw new Error('Sidebar introuvable');
    const nav = within(sidebar);
    expect(nav.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/ci/compte');
    expect(nav.getByRole('link', { name: 'Mes séjours' })).toHaveAttribute(
      'href',
      '/ci/compte?view=stays',
    );
  });

  it("n'affiche pas le lien Paramètres et garde la carte d'aide en bas", () => {
    render(
      <MemoryRouter>
        <ClientSidebar />
      </MemoryRouter>,
    );

    const sidebar = document.querySelector<HTMLElement>('aside.client-sidebar');
    if (!sidebar) throw new Error('Sidebar introuvable');
    const nav = within(sidebar);

    expect(nav.queryByRole('link', { name: 'Paramètres' })).not.toBeInTheDocument();
    const helpCard = nav.getByText("Besoin d'aide ?").closest('[class*="mt-auto"]');
    expect(helpCard).not.toBeNull();

    const children = Array.from(sidebar.children);
    const helpIndex = children.findIndex((el) => el.textContent?.includes("Besoin d'aide ?"));
    const navIndex = children.findIndex((el) => el.tagName === 'NAV');
    expect(helpIndex).toBeGreaterThan(navIndex);
  });
});
