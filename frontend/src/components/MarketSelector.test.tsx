import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import { MARKET_CODES } from '../config/markets';
import MarketSelector from './MarketSelector';

function PathProbe() {
  const { pathname } = useLocation();
  return <p data-testid="path">{pathname}</p>;
}

function renderSelector(entry: string, options: { withOutside?: boolean } = {}) {
  const pane = (
    <MarketProvider>
      <MarketSelector />
      <PathProbe />
    </MarketProvider>
  );
  return render(
    <>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/" element={pane} />
          <Route path="/:market" element={pane} />
          <Route path="/:market/*" element={pane} />
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

describe('MarketSelector — pages de marché', () => {
  it("n'affiche que le drapeau sur /ci : pas de sélecteur", () => {
    renderSelector('/ci');

    expect(screen.queryByRole('button', { name: 'Choisir le marché' })).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(
      screen.getByRole('img', { name: "Marché Côte d'Ivoire" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/ci');
  });

  it("n'affiche que le drapeau sur /bj", () => {
    renderSelector('/bj');

    expect(screen.queryByRole('button', { name: 'Choisir le marché' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Marché Bénin' })).toBeInTheDocument();
  });

  it('reste statique sur une page profonde de marché', () => {
    renderSelector('/ci/chambre/12');

    expect(screen.queryByRole('button', { name: 'Choisir le marché' })).toBeNull();
    expect(
      screen.getByRole('img', { name: "Marché Côte d'Ivoire" }),
    ).toBeInTheDocument();
  });
});

describe('MarketSelector — page d’accueil', () => {
  it("garde le sélecteur sur les pages racine /contact et /a-propos", () => {
    renderSelector('/contact');

    expect(screen.getByRole('button', { name: 'Choisir le marché' })).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/contact');
  });

  it("affiche l'état neutre (aucun marché) et annonce la liste", () => {
    renderSelector('/');

    const trigger = triggerButton();
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Marché')).toBeInTheDocument();
    expect(screen.queryByText('CI')).toBeNull();
    expect(screen.getByTestId('path')).toHaveTextContent('/');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ouvre la liste des marchés au clic sur le déclencheur', async () => {
    renderSelector('/');

    await userEvent.click(triggerButton());

    expect(triggerButton()).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Choisir le marché' });
    expect(listbox).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(MARKET_CODES.length);
    expect(MARKET_CODES.length).toBe(12);
    expect(screen.getByRole('option', { name: "Côte d'Ivoire" })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('option', { name: 'Bénin' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('option', { name: 'Sénégal' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('option', { name: 'RDC' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('bascule vers le marché Bénin : URL puis drapeau statique', async () => {
    renderSelector('/');

    await userEvent.click(triggerButton());
    await userEvent.click(screen.getByRole('button', { name: 'Bénin' }));

    expect(screen.getByTestId('path')).toHaveTextContent('/bj');
    expect(screen.queryByRole('button', { name: 'Choisir le marché' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Marché Bénin' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it("choisit Côte d'Ivoire : navigation vers /ci puis drapeau statique", async () => {
    renderSelector('/');

    await userEvent.click(triggerButton());
    await userEvent.click(screen.getByRole('button', { name: "Côte d'Ivoire" }));

    expect(screen.getByTestId('path')).toHaveTextContent('/ci');
    expect(screen.queryByRole('button', { name: 'Choisir le marché' })).toBeNull();
    expect(
      screen.getByRole('img', { name: "Marché Côte d'Ivoire" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('referme la liste avec la touche Échap', async () => {
    renderSelector('/');

    await userEvent.click(triggerButton());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('referme la liste quand on clique à l’extérieur', async () => {
    renderSelector('/', { withOutside: true });

    await userEvent.click(triggerButton());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bouton extérieur' }));

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ne referme pas la liste sur un mousedown à l’intérieur du sélecteur', async () => {
    renderSelector('/', { withOutside: true });

    await userEvent.click(triggerButton());
    const listbox = screen.getByRole('listbox');

    fireEvent.mouseDown(listbox);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('referme la liste sur un mousedown extérieur même sans clic complet', async () => {
    renderSelector('/', { withOutside: true });

    await userEvent.click(triggerButton());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Bouton extérieur' }));

    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
