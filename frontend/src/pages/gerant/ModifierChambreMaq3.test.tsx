import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import ModifierChambreMaq3 from './ModifierChambreMaq3';
import type { Room } from '../../data/rooms';
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
  fetchMyRooms: vi.fn<() => Promise<Room[]>>(),
  updateRoom: vi.fn<(id: string, patch: Partial<Room>) => Promise<void>>(),
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
  fetchMyRooms: mocks.fetchMyRooms,
  updateRoom: mocks.updateRoom,
  createRoom: mocks.createRoom,
}));

vi.mock('../../data/categories', () => ({
  fetchCategoriesByMarket: mocks.fetchCategoriesByMarket,
}));

const categories: Category[] = [
  { id: 'ci-appartements', title: 'Appartements', img: '/a.jpg', alt: 'A', market: 'CI' },
  { id: 'ci-chambres-premium', title: 'Chambres premium', img: '/p.jpg', alt: 'P', market: 'CI' },
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

const room: Room = {
  id: 'room-1',
  title: 'Studio Cocody Riviera',
  subtitle: 'Calme et lumineux',
  info: '2 ch. · 1 d.',
  price: '25000',
  priceNum: 25000,
  priceUnit: '/ nuit',
  img: 'https://cdn.test/main.jpg',
  alt: 'Studio Cocody Riviera',
  images: ['https://cdn.test/main.jpg', 'https://cdn.test/second.jpg'],
  description: 'Studio meublé proche des commerces.',
  category: 'ci-appartements',
  market: 'CI',
  pays: "Côte d'Ivoire",
  ville: 'Abidjan',
  quartier: 'Cocody',
  chambres: 2,
  douches: 1,
  disponible: false,
  dateDispo: '',
  conditions: 'Annulation gratuite 48 h avant l’arrivée',
  isPopular: true,
};

function renderPage(id = 'room-1') {
  return render(
    <MemoryRouter initialEntries={[`/ci/gerant/chambres/${id}/modifier`]}>
      <MarketProvider>
        <Routes>
          <Route path="/ci/gerant/chambres/:id/modifier" element={<ModifierChambreMaq3 />} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

async function goToPhotosStep() {
  await screen.findByRole('heading', { level: 1, name: 'Modifier la chambre' });
  await userEvent.click(await screen.findByRole('button', { name: /suivant/i }));
  await userEvent.click(await screen.findByRole('button', { name: /suivant/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  stubs.reset();
  mocks.fetchMyRooms.mockResolvedValue([room]);
  mocks.updateRoom.mockResolvedValue(undefined);
  mocks.createRoom.mockResolvedValue({ id: 'new-room' });
  mocks.fetchCategoriesByMarket.mockResolvedValue(categories);
  mocks.villes.mockResolvedValue(['Abidjan', 'Bouaké']);
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

describe('ModifierChambreMaq3', () => {
  it('préremplit le formulaire avec l’annonce existante', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Modifier la chambre' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/titre de votre chambre/i)).toHaveValue(room.title);
    expect(screen.getByLabelText(/^ville/i)).toHaveValue(room.ville);
    expect(screen.getByLabelText(/quartier/i)).toHaveValue(room.quartier);
    expect(screen.getByLabelText(/description courte/i)).toHaveValue(room.description);
    expect(mocks.fetchMyRooms).toHaveBeenCalledTimes(1);
  });

  it('enregistre les modifications sans re-téléverser les photos existantes', async () => {
    renderPage();
    await goToPhotosStep();

    expect(screen.getByAltText('Photo 1')).toHaveAttribute('src', room.img);
    expect(screen.getByAltText('Photo 2')).toHaveAttribute('src', room.images[1]);

    await userEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }));

    await waitFor(() => expect(mocks.updateRoom).toHaveBeenCalledTimes(1));
    const [id, patch] = mocks.updateRoom.mock.calls[0];
    expect(id).toBe('room-1');
    expect(patch).toEqual(
      expect.objectContaining({
        title: room.title,
        ville: room.ville,
        quartier: room.quartier,
        category: room.category,
        priceNum: room.priceNum,
        priceUnit: '/ nuit',
        images: room.images,
        img: room.img,
        isPopular: true,
      }),
    );
    // Une annonce occupée reste occupée : `disponible` n'est pas renvoyé.
    expect(patch).not.toHaveProperty('disponible');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.createRoom).not.toHaveBeenCalled();
    expect(await screen.findByText(/a été mise à jour avec succès/)).toBeInTheDocument();
  });

  it('téléverse uniquement la photo ajoutée et conserve les anciennes', async () => {
    renderPage();
    await goToPhotosStep();

    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [new File(['x'], 'nouvelle.jpg', { type: 'image/jpeg' })] },
    });
    await act(async () => {});

    await userEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }));

    await waitFor(() => expect(mocks.updateRoom).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.calls[0][0].name).toBe('nouvelle.jpg');
    const [, patch] = mocks.updateRoom.mock.calls[0];
    expect(patch.images).toEqual([
      'https://cdn.test/main.jpg',
      'https://cdn.test/second.jpg',
      'https://cdn.test/nouvelle.jpg',
    ]);
  });

  it('affiche une erreur quand l’annonce ne fait pas partie des chambres du gérant', async () => {
    mocks.fetchMyRooms.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Chambre introuvable ou ne vous appartient pas.');
    expect(screen.getByRole('link', { name: /retour à mes chambres/i })).toHaveAttribute(
      'href',
      '/ci/gerant/chambres',
    );
    expect(screen.queryByRole('button', { name: /suivant/i })).toBeNull();
  });

  it('affiche le message d’erreur du serveur quand l’enregistrement échoue', async () => {
    mocks.updateRoom.mockRejectedValue(new Error('Cette chambre ne vous appartient pas'));

    renderPage();
    await goToPhotosStep();

    await userEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette chambre ne vous appartient pas',
    );
    // On reste sur le formulaire pour corriger et réessayer.
    expect(screen.getByRole('button', { name: /enregistrer les modifications/i })).toBeEnabled();
  });
});
