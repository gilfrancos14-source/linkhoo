import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import Hero from './Hero';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderHero(entry = '/ci') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Hero />
        <LocationProbe />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function setDate(label: 'Date d\'arrivée' | 'Date de départ', value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  cleanup();
});

describe('Hero', () => {
  it("affiche le tagline et le formulaire de recherche du séjour", () => {
    renderHero();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Trouvez le lieu idéal pour votre prochain séjour' }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Où voulez-vous aller ?')).toBeInTheDocument();
    expect(screen.getByLabelText('Rechercher un lieu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechercher' })).toBeEnabled();
    expect(screen.getByLabelText("Date d'arrivée")).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('Date de départ')).toHaveAttribute('aria-required', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("bascule sur l'onglet voiture : message d'attente et recherche désactivée", async () => {
    renderHero();

    await userEvent.click(screen.getByRole('button', { name: /Voiture de location/ }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Louez une voiture au meilleur prix' }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Où allez-vous ?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechercher' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cette fonctionnalité sera bientôt disponible.',
    );
  });

  it("revient à l'onglet séjour et retire le message d'attente", async () => {
    renderHero();

    await userEvent.click(screen.getByRole('button', { name: /Voiture de location/ }));
    await userEvent.click(screen.getByRole('button', { name: /Séjour/ }));

    expect(screen.getByPlaceholderText('Où voulez-vous aller ?')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechercher' })).toBeEnabled();
  });

  it("n'envoie rien quand on soumet le formulaire voiture", () => {
    renderHero();
    fireEvent.click(screen.getByRole('button', { name: /Voiture de location/ }));

    const form = document.querySelector('form');
    if (!form) throw new Error('formulaire introuvable');
    fireEvent.submit(form);

    expect(screen.getByTestId('location').textContent).toBe('/ci');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("demande les dates d'arrivée et de départ quand elles manquent", async () => {
    renderHero();

    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Veuillez renseigner les dates d'arrivée et de départ.",
    );
    expect(screen.getByTestId('location').textContent).toBe('/ci');
  });

  it("refuse un départ antérieur ou égal à l'arrivée", async () => {
    renderHero();

    setDate("Date d'arrivée", '2026-10-05');
    setDate('Date de départ', '2026-10-05');
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      "La date de départ doit être ultérieure à la date d'arrivée.",
    );
    expect(screen.getByTestId('location').textContent).toBe('/ci');
  });

  it("efface l'erreur dès qu'une date est saisie", async () => {
    renderHero();

    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    setDate("Date d'arrivée", '2026-10-01');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText("Date d'arrivée")).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText("Date d'arrivée")).toHaveAttribute('aria-invalid', 'false');
  });

  it('recherche avec la requête libres et les dates renseignées', async () => {
    renderHero();

    await userEvent.type(screen.getByLabelText('Rechercher un lieu'), 'Grand-Bassam');
    setDate("Date d'arrivée", '2026-10-01');
    setDate('Date de départ', '2026-10-05');
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(screen.getByTestId('location').textContent).toBe(
      '/ci/recherche?q=Grand-Bassam&arrivee=2026-10-01&depart=2026-10-05',
    );
  });

  it("n'ajoute pas le paramètre q quand la recherche est vide", async () => {
    renderHero();

    setDate("Date d'arrivée", '2026-11-01');
    setDate('Date de départ', '2026-11-04');
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(screen.getByTestId('location').textContent).toBe(
      '/ci/recherche?arrivee=2026-11-01&depart=2026-11-04',
    );
  });

  it('construit la recherche dans le marché courant', async () => {
    renderHero('/bj');

    setDate("Date d'arrivée", '2026-12-24');
    setDate('Date de départ', '2026-12-28');
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(screen.getByTestId('location').textContent).toBe(
      '/bj/recherche?arrivee=2026-12-24&depart=2026-12-28',
    );
  });
});
