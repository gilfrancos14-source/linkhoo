import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import RoomDetailMaq7 from './RoomDetailMaq7';

vi.mock('../lib/api', () => ({
  apiReviews: {
    listByRoom: vi.fn(async () => ({
      reviews: [
        { id: 'rv1', client_name: 'Kevin', note_appartement: 5, commentaire: 'Très bon séjour, hôte réactif.', created_at: '2026-10-14T00:00:00Z' },
        { id: 'rv2', client_name: 'Junior', note_appartement: 5, commentaire: 'Tout était parfait.', created_at: '2026-10-10T00:00:00Z' },
        { id: 'rv3', client_name: 'Abdalah', note_appartement: 5, commentaire: 'Appartement très bien entretenu.', created_at: '2026-09-20T00:00:00Z' },
        { id: 'rv4', client_name: 'Etessollim-Ella', note_appartement: 5, commentaire: 'Hôte très accueillant.', created_at: '2026-09-12T00:00:00Z' },
        { id: 'rv5', client_name: 'Komi Moderan', note_appartement: 5, commentaire: 'Séjour calme et reposant.', created_at: '2026-09-02T00:00:00Z' },
      ],
      room_avg: 4.85,
      room_count: 13,
      room_distribution: [
        { note: 5, count: 9 },
        { note: 4, count: 3 },
        { note: 3, count: 1 },
      ],
      gerant_avg: 4.85,
      gerant_count: 13,
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
    capacity: '',
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
    equipments: ['wifi', 'parking'],
    restauration: 'restaurant',
    isGuestFavourite: true,
    hostResponseRate: 100,
    hostResponseAnswered: 12,
    hostResponseTotal: 12,
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
  it('affiche les équipements et la restauration de l’annonce', async () => {
    renderPage();

    expect(await screen.findByText('Wi-Fi gratuit')).toBeInTheDocument();
    expect(screen.getByText('Parking')).toBeInTheDocument();
    expect(screen.getByText('Restaurant sur place')).toBeInTheDocument();
  });

  it('affiche le titre, la galerie, les actions et le pied de page', async () => {
    const view = renderPage();

    expect(await screen.findByRole('heading', { name: 'Suite vue mer' })).toBeInTheDocument();
    // Aucune donnée « voyageur » en base : la ligne de faits n'en invente pas.
    expect(view.container.querySelector('.m7-hero__facts')?.textContent).not.toMatch(/voyageur/i);
    expect(screen.getByRole('button', { name: /Partager/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Afficher toutes les photos/ })).toBeInTheDocument();
    expect(view.container.querySelector('.m7-book__guests')).toBeNull();
    // Le formulaire est replié par défaut, un dropdown le déplie.
    const toggle = screen.getByRole('button', { name: 'Vos informations' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Prénoms')).toBeInTheDocument();
    expect(screen.getByLabelText('Téléphone')).toBeInTheDocument();
    expect(screen.getAllByText('Coup de cœur voyageurs').length).toBeGreaterThan(0);
    expect(screen.getByText(/Dans le quartier de Cocody à Abidjan/)).toBeInTheDocument();
    expect(screen.getByText(/Aya Kouassi est un hôte exceptionnel/)).toBeInTheDocument();
    expect(screen.getByText(/Superhôte · 8 mois d’expérience/)).toBeInTheDocument();
    expect(screen.getAllByText(/Taux de réponse : 100 %/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Les voyageurs en parlent' })).toBeInTheDocument();
    expect((await screen.findAllByText(/étoiles/)).length).toBeGreaterThan(0);
    expect(
      await screen.findByRole('button', { name: /Afficher les 13 commentaires/ }),
    ).toBeInTheDocument();
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
    const { container } = renderPage();
    const rating = within(container.querySelector('.m7-rating')!);

    expect(await rating.findByText('4,85')).toBeInTheDocument();
    expect(rating.getByText('Coup de cœur voyageurs')).toBeInTheDocument();
    expect(rating.getByText(/Ce logement fait partie des Coup de cœur voyageurs/)).toBeInTheDocument();
    for (const label of ['Évaluation globale', 'Propreté', 'Précision', 'Arrivée', 'Communication', 'Emplacement', 'Qualité-prix']) {
      expect(rating.getByText(label)).toBeInTheDocument();
    }
    expect(rating.getAllByRole('img', { name: /Évaluation globale/ })).toHaveLength(5);
  });

  it('affiche la présentation de l’hôte', async () => {
    const { container } = renderPage();
    const host = within(container.querySelector('.m7-host')!);

    expect(await host.findByRole('heading', { name: 'Faites connaissance avec votre hôte' })).toBeInTheDocument();
    expect(host.getByText('Aya Kouassi')).toBeInTheDocument();
    expect(await host.findByText('Aya Kouassi est Superhôte')).toBeInTheDocument();
    expect(await host.findByText(/Taux de réponse : 100 %/)).toBeInTheDocument();
    expect(await host.findByText(/Répond dans l'heure/)).toBeInTheDocument();
    expect(await host.findByText('Langues parlées : Anglais et Français')).toBeInTheDocument();
    expect(host.getByRole('button', { name: "Envoyer un message à l'hôte" })).toBeInTheDocument();
    expect(host.getByText(/Afin de protéger votre paiement/)).toBeInTheDocument();
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
