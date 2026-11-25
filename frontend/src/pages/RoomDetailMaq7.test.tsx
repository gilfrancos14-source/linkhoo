import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import RoomDetailMaq7 from './RoomDetailMaq7';

vi.mock('../lib/api', () => ({
  apiReviews: {
    listByRoom: vi.fn(async () => ({
      reviews: [],
      room_avg: 4.85,
      room_count: 13,
      room_distribution: [],
      gerant_avg: null,
      gerant_count: 0,
    })),
  },
  apiNewsletter: { subscribe: vi.fn() },
  cachedGet: vi.fn().mockResolvedValue([]),
  request: vi.fn().mockResolvedValue({}),
}));

vi.mock('../data/rooms', () => ({
  fetchRoomById: vi.fn(async () => ({
    id: 'r1',
    title: 'Suite vue mer',
    subtitle: '',
    info: '',
    price: '25 000',
    priceNum: 25000,
    priceUnit: '/ nuit',
    img: '/images/room.jpg',
    alt: 'Suite',
    images: ['/images/room2.jpg', '/images/room3.jpg', '/images/room4.jpg', '/images/room5.jpg'],
    description: '',
    capacity: '2 personnes',
    category: 'cat-1',
    market: 'CI',
    pays: 'Côte d\'Ivoire',
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 1,
    douches: 1,
    disponible: true,
    dateDispo: '',
    conditions: '',
    categoryTitle: 'Logement entier',
    isGuestFavourite: true,
    gerant: {
      nom: 'Kouassi',
      prenom: 'Aya',
      phone: null,
      is_verified: true,
      is_premium: true,
      created_at: '2026-01-01T00:00:00Z',
      experience_months: 8,
      is_superhost: true,
    },
  })),
}));

vi.mock('../data/categories', () => ({
  fetchCategoriesByMarket: vi.fn(async () => [
    { id: 'cat-1', title: 'Logement entier', img: '', alt: '', market: 'CI' },
  ]),
}));

afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ci/chambre/r1']}>
      <MarketProvider>
        <Routes>
          <Route path="/:market/chambre/:id" element={<RoomDetailMaq7 />} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

describe('RoomDetailMaq7 — première section', () => {
  it('affiche le titre, la galerie, les actions et le pied de page', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Suite vue mer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Partager/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Afficher toutes les photos/ })).toBeInTheDocument();
    expect(screen.getByText('Coup de cœur voyageurs')).toBeInTheDocument();
    expect(screen.getByText(/Dans le quartier de Cocody à Abidjan/)).toBeInTheDocument();
    expect(screen.getByText(/Aya Kouassi est un hôte exceptionnel/)).toBeInTheDocument();
    expect(screen.getByText(/Superhôte · 8 mois d’expérience/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réserver' })).toBeInTheDocument();
    expect(screen.getByText(/Aucun montant ne vous sera débité/)).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('affiche le calendrier et synchronise les dates avec le formulaire', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: "Sélectionnez la date d'arrivée" })).toBeInTheDocument();
    expect(screen.getByText(/Durée minimale du séjour : 2 nuits/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Effacer les dates' })).toBeInTheDocument();

    const dates = screen.getAllByRole('button', { name: /^\d{2}\/\d{2}\/\d{4}$/ }) as HTMLButtonElement[];
    const available = dates.find((button) => !button.disabled);
    expect(available).toBeDefined();
    fireEvent.click(available!);

    const arrival = screen.getByLabelText('Arrivée') as HTMLInputElement;
    expect(arrival.value).not.toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Effacer les dates' }));
    expect(arrival.value).toBe('');
  });

  it('affiche la note globale et le détail des évaluations', async () => {
    renderPage();

    expect(await screen.findByText('4,85')).toBeInTheDocument();
    expect(screen.getAllByText('Coup de cœur voyageurs').length).toBeGreaterThan(0);
    expect(screen.getByText(/Ce logement fait partie des Coup de cœur voyageurs/)).toBeInTheDocument();
    for (const label of ['Évaluation globale', 'Propreté', 'Précision', 'Arrivée', 'Communication', 'Emplacement', 'Qualité-prix']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('img', { name: /Évaluation globale/ })).toHaveLength(5);
  });

  it('permet de parcourir les mois du calendrier', async () => {
    const { container } = renderPage();
    await screen.findByRole('heading', { name: "Sélectionnez la date d'arrivée" });

    const before = container.querySelectorAll('.m7-calendar__month')[0].textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(container.querySelectorAll('.m7-calendar__month')[0].textContent).not.toBe(before);

    fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }));
    expect(container.querySelectorAll('.m7-calendar__month')[0].textContent).toBe(before);
  });
});
