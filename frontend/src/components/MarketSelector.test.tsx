import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import MarketSelector from './MarketSelector';

function PathProbe() {
  const { pathname } = useLocation();
  return <p data-testid="path">{pathname}</p>;
}

function renderSelector(entry: string, options: { withOutside?: boolean } = {}) {
  return render(
    <>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/:market"
            element={
              <MarketProvider>
                <MarketSelector />
                <PathProbe />
              </MarketProvider>
            }
          />
        </Routes>
      </MemoryRouter>
      {options.withOutside && (
        <button type="button">Bouton extérieur</button>
      )}
    </>,
  );
}

function triggerButton() {
  return screen.getByRole('button', { name: 'Choisir le marché' });
}

afterEach(() => {
  cleanup();
});

describe('MarketSelector', () => {
  it('affiche le code du marché courant et annonce la liste', () => {
    renderSelector('/ci');

    const trigger = triggerButton();
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/ci');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ouvre la liste des marchés au clic sur le déclencheur', async () => {
    renderSelector('/ci');

    await userEvent.click(triggerButton());

    expect(triggerButton()).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Choisir le marché' });
    expect(listbox).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(screen.getByRole('option', { name: "Côte d'Ivoire" })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: 'Bénin' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('bascule vers le marché Bénin : URL, libellé et fermeture', async () => {
    renderSelector('/ci');

    await userEvent.click(triggerButton());
    await userEvent.click(screen.getByRole('button', { name: 'Bénin' }));

    expect(screen.getByTestId('path')).toHaveTextContent('/bj');
    expect(screen.getByText('BJ')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(triggerButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('bascule vers le marché Côte d’Ivoire depuis /bj', async () => {
    renderSelector('/bj');

    expect(screen.getByText('BJ')).toBeInTheDocument();

    await userEvent.click(triggerButton());
    await userEvent.click(screen.getByRole('button', { name: "Côte d'Ivoire" }));

    expect(screen.getByTestId('path')).toHaveTextContent('/ci');
    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('referme la liste sans naviguer quand on clique le marché déjà actif', async () => {
    renderSelector('/ci');

    await userEvent.click(triggerButton());
    await userEvent.click(
      screen.getByRole('button', { name: "Côte d'Ivoire" }),
    );

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByTestId('path')).toHaveTextContent('/ci');
  });

  it('referme la liste avec la touche Échap', async () => {
    renderSelector('/ci');

    await userEvent.click(triggerButton());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('referme la liste quand on clique à l’extérieur', async () => {
    renderSelector('/ci', { withOutside: true });

    await userEvent.click(triggerButton());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bouton extérieur' }));

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ne referme pas la liste sur un mousedown à l’intérieur du sélecteur', async () => {
    renderSelector('/ci', { withOutside: true });

    await userEvent.click(triggerButton());
    const listbox = screen.getByRole('listbox');

    fireEvent.mouseDown(listbox);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('referme la liste sur un mousedown extérieur même sans clic complet', async () => {
    renderSelector('/ci', { withOutside: true });

    await userEvent.click(triggerButton());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Bouton extérieur' }));

    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
