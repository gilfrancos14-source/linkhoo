import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import AjouterChambreMaq3 from './AjouterChambreMaq3';
import type { Category } from '../../data/categories';
import type { GerantData } from '../../lib/api';
import type { Reservation } from '../../lib/reservations';

const stubs = vi.hoisted(() => {
  let seq = 0;
  const createObjectURL = vi.fn(() => {
    seq += 1;
    return `blob:preview-${seq}`;
  });
  const revokeObjectURL = vi.fn(() => undefined);
  if (typeof URL !== 'undefined') {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
  }
  return { createObjectURL, revokeObjectURL, reset: () => { seq = 0; } };
});

const mocks = vi.hoisted(() => ({
  createRoom: vi.fn<(room: Record<string, unknown>) => Promise<{ id: string }>>(),
  fetchCategoriesByMarket: vi.fn<(market: string) => Promise<Category[]>>(),
  villes: vi.fn<(market?: string) => Promise<string[]>>(),
  upload: vi.fn<(file: File, bucket?: string) => Promise<{ url: string; path: string }>>(),
  getMe: vi.fn<() => Promise<GerantData>>(),
  gerantUnread: vi.fn<() => Promise<{ count: number }>>(),
  getReservations: vi.fn<() => Promise<Reservation[]>>(),
}));

vi.mock('../../lib/api', () => ({
  apiRooms: { villes: mocks.villes },
  apiUpload: { upload: mocks.upload },
  apiGerants: { getMe: mocks.getMe },
  apiMessages: { gerantUnread: mocks.gerantUnread },
}));

vi.mock('../../lib/reservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/reservations')>();
  return {
    ...actual,
    getReservations: mocks.getReservations,
  };
});

vi.mock('../../data/rooms', () => ({
  createRoom: mocks.createRoom,
}));

vi.mock('../../data/categories', () => ({
  fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
}));

const categories: Category[] = [
  { id: 'cat-appart', title: 'Appartements', img: '/a.jpg', alt: 'A', market: 'CI' },
  { id: 'cat-hotel', title: 'Hôtels', img: '/h.jpg', alt: 'H', market: 'CI' },
];

const gerant: GerantData = {
  id: 'gerant-1',
  clerk_user_id: 'clerk_1',
  email: 'koffi@ilehya.ci',
  nom: 'Mensah',
  prenom: 'Koffi',
  phone: null,
  market: 'CI',
  is_verified: true,
  verified_at: '2026-01-05T12:00:00.000Z',
  verification_requested_at: null,
  verification_status: 'approved',
  verification_rejection_reason: null,
  verification_submitted_at: null,
  verification_reviewed_at: null,
  property_maps_url: null,
  property_lat: null,
  property_lng: null,
  is_premium: true,
  premium_expires_at: '2027-06-01T00:00:00.000Z',
  created_at: '2025-11-01T09:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ci/gerant/chambres/ajouter']}>
      <MarketProvider>
        <AjouterChambreMaq3 />
      </MarketProvider>
    </MemoryRouter>,
  );
}

function setText(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } });
}

async function fillStep1() {
  await screen.findByRole('option', { name: 'Appartements' });
  setText(screen.getByLabelText(/titre de votre chambre/i), 'Studio Belle');
  setText(screen.getByLabelText(/^ville/i), 'Cotonou');
  setText(screen.getByLabelText(/quartier/i), 'Haie Vive');
  setText(screen.getByLabelText(/description courte/i), 'Vue sur mer, calme absolu.');
  await userEvent.selectOptions(
    document.querySelector<HTMLSelectElement>('#maq3-category')!,
    'cat-appart',
  );
  await userEvent.click(screen.getByRole('button', { name: /suivant/i }));
}

async function fillStep2() {
  setText(screen.getByLabelText(/prix \(fcfa\)/i), '660');
  setText(screen.getByLabelText(/conditions/i), 'Caution 1 mois, durée min 6 mois.');
  await userEvent.click(screen.getByRole('button', { name: /suivant/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  stubs.reset();
  mocks.createRoom.mockResolvedValue({ id: 'new-room' });
  mocks.fetchCategoriesByMarket.mockResolvedValue(categories);
  mocks.villes.mockResolvedValue(['Cotonou', 'Abidjan', 'Lomé']);
  mocks.upload.mockImplementation(async (file: File) => ({
    url: `https://cdn.test/${file.name}`,
    path: `rooms/${file.name}`,
  }));
  mocks.getMe.mockResolvedValue(gerant);
  mocks.gerantUnread.mockResolvedValue({ count: 0 });
  mocks.getReservations.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('AjouterChambreMaq3', () => {
  it('reproduit la maquette maq3', () => {
    renderPage();

    expect(document.querySelector('.gerant-maq3')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Ajouter une chambre' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Identification de la chambre')).toBeInTheDocument();
    expect(screen.getByText('Aperçu de votre chambre')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour' })).toHaveAttribute(
      'href',
      '/ci/gerant/chambres',
    );
  });

  it('met à jour le compteur de description', async () => {
    const user = userEvent.setup();
    renderPage();

    const textarea = screen.getByLabelText(/description courte/i);
    await user.type(textarea, 'Test');

    expect(screen.getByText('4/200')).toBeInTheDocument();
  });

  it('bloque l’étape 1 tant que les champs requis sont vides', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /suivant/i }));

    expect(screen.getByText('Le titre est requis')).toBeInTheDocument();
    expect(screen.getByText('La ville est requise')).toBeInTheDocument();
    expect(screen.getByText('Le quartier est requis')).toBeInTheDocument();
    expect(screen.getByText('La description est requise')).toBeInTheDocument();
    expect(screen.getByText('Choisissez une catégorie')).toBeInTheDocument();
    expect(screen.queryByLabelText(/prix \(fcfa\)/i)).toBeNull();
  });

  it('charge les catégories et villes du marché courant', async () => {
    renderPage();

    expect(await screen.findByRole('option', { name: 'Appartements' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.villes).toHaveBeenCalledWith('CI'));
    expect(mocks.fetchCategoriesByMarket).toHaveBeenCalledWith('CI');
    expect(document.querySelectorAll('#maq3-city-options option')).toHaveLength(3);
  });

  it('enregistre une chambre avec les champs du projet', async () => {
    renderPage();
    await fillStep1();
    await fillStep2();

    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] },
    });
    await act(async () => {});

    await userEvent.click(screen.getByRole('button', { name: /enregistrer la chambre/i }));

    await waitFor(() => expect(mocks.createRoom).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Studio Belle',
        ville: 'Cotonou',
        quartier: 'Haie Vive',
        description: 'Vue sur mer, calme absolu.',
        subtitle: 'Vue sur mer, calme absolu.',
        category: 'cat-appart',
        priceNum: 660,
        price: '660',
        priceUnit: '/ mois',
        chambres: 1,
        douches: 1,
        market: 'CI',
        pays: "Côte d'Ivoire",
        disponible: true,
        isPopular: false,
        images: ['https://cdn.test/photo.jpg'],
        img: 'https://cdn.test/photo.jpg',
      }),
    );
    expect(await screen.findByText(/a été ajoutée avec succès/)).toBeInTheDocument();
  });
});
