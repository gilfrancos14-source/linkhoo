import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  })),
}));

vi.mock('../data/categories', () => ({
  fetchCategoriesByMarket: vi.fn(async () => [
    { id: 'cat-1', title: 'Logement entier', img: '', alt: '', market: 'CI' },
  ]),
}));

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
    expect(screen.getByRole('button', { name: 'Réserver' })).toBeInTheDocument();
    expect(screen.getByText(/Aucun montant ne vous sera débité/)).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
