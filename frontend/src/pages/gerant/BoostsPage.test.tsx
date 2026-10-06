import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import BoostsPage from './BoostsPage';
import type { BoostData, GerantData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  userId: 'user_clerk_1' as string | null,
  getMe: vi.fn<() => Promise<GerantData>>(),
  mine: vi.fn<() => Promise<{ items: BoostData[] }>>(),
  updateSchedule: vi.fn<
    (id: string, data: { starts_at: string; ends_at: string }) => Promise<{ boost: BoostData }>
  >(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: mocks.userId }),
}));

vi.mock('../../lib/api', () => ({
  apiGerants: { getMe: mocks.getMe },
  apiBoosts: { mine: mocks.mine, updateSchedule: mocks.updateSchedule },
}));

function makeGerant(overrides: Partial<GerantData> = {}): GerantData {
  return {
    id: 'gerant-1',
    clerk_user_id: 'clerk_1',
    email: 'awa@ilehya.ci',
    nom: 'Kouassi',
    prenom: 'Awa',
    phone: '+225 07 00 00 00',
    market: 'CI',
    is_verified: true,
    verified_at: '2026-01-05T10:00:00.000Z',
    verification_requested_at: null,
    verification_status: 'approved',
    verification_rejection_reason: null,
    verification_submitted_at: null,
    verification_reviewed_at: null,
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    is_premium: false,
    premium_expires_at: null,
    created_at: '2025-11-01T09:00:00.000Z',
    ...overrides,
  };
}

function makeBoost(overrides: Partial<BoostData> = {}): BoostData {
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const later = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: 'boost-1',
    market: 'CI',
    room_id: 'room-1',
    mode: 'cpc',
    status: 'active',
    display_status: 'live',
    budget_total: 3000,
    spent: 500,
    remaining: 2500,
    starts_at: future,
    ends_at: later,
    activated_at: future,
    created_at: future,
    room: {
      id: 'room-1',
      title: 'Suite Plateau',
      price: '45 000 FCFA',
      price_num: 45000,
      img: null,
      ville: 'Abidjan',
      quartier: 'Plateau',
      market: 'CI',
      disponible: true,
    },
    ...overrides,
  };
}

function renderBoosts(entry = '/ci/gerant/boosts') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <BoostsPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'user_clerk_1';
  mocks.getMe.mockResolvedValue(makeGerant());
  mocks.mine.mockResolvedValue({ items: [makeBoost()] });
  mocks.updateSchedule.mockImplementation((_id, data) =>
    Promise.resolve({ boost: makeBoost({ starts_at: data.starts_at, ends_at: data.ends_at }) }),
  );
});

afterEach(() => {
  cleanup();
});

describe('BoostsPage', () => {
  it('affiche l’état de chargement tant que la liste n’est pas résolue', () => {
    mocks.mine.mockImplementation(() => new Promise(() => {}));

    renderBoosts();

    expect(screen.getByRole('heading', { level: 1, name: 'Booster' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('liste les campagnes avec statut, mode, budget et progression', async () => {
    renderBoosts();

    expect(await screen.findByText('Suite Plateau')).toBeInTheDocument();
    expect(screen.getByText('En ligne')).toBeInTheDocument();
    expect(screen.getByText('Par clic')).toBeInTheDocument();
    expect(screen.getByText('Reste 2 500 F sur 3 000 F')).toBeInTheDocument();
    expect(screen.getByText('500 F consommés')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '17');
  });

  it('propose « Nouvelle campagne » à un gérant vérifié', async () => {
    renderBoosts();

    const cta = await screen.findByRole('link', { name: /Nouvelle campagne/ });
    expect(cta).toHaveAttribute('href', '/ci/gerant/boosts/new');
    expect(screen.queryByText('Vérification requise')).not.toBeInTheDocument();
  });

  it('bloque un gérant non vérifié derrière la vérification', async () => {
    mocks.getMe.mockResolvedValue(makeGerant({ is_verified: false }));

    renderBoosts();

    expect(await screen.findByText('Vérification requise')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vérifier mon compte' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    expect(screen.queryByRole('link', { name: /Nouvelle campagne/ })).not.toBeInTheDocument();
  });

  it('affiche l’état vide avec un lien de démarrage quand tout est vérifié', async () => {
    mocks.mine.mockResolvedValue({ items: [] });

    renderBoosts();

    expect(await screen.findByRole('heading', { name: 'Aucune campagne' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Commencer' })).toHaveAttribute(
      'href',
      '/ci/gerant/boosts/new',
    );
  });

  it('signale l’échec du chargement puis permet de réessayer', async () => {
    mocks.mine.mockRejectedValueOnce(new Error('Réseau indisponible'));
    renderBoosts();

    expect(await screen.findByText(/Impossible de charger vos campagnes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Suite Plateau')).toBeInTheDocument();
    expect(screen.queryByText(/Impossible de charger vos campagnes/)).not.toBeInTheDocument();
  });

  it('reprogramme les dates d’une campagne en ligne', async () => {
    renderBoosts();
    await screen.findByText('Suite Plateau');

    fireEvent.click(screen.getByRole('button', { name: 'Modifier les dates' }));

    const start = screen.getByLabelText('Début');
    const end = screen.getByLabelText('Fin');
    expect(start).toHaveAttribute('type', 'date');
    expect(String((start as HTMLInputElement).value)).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    fireEvent.change(start, { target: { value: iso(today) } });
    fireEvent.change(end, { target: { value: iso(nextMonth) } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.updateSchedule).toHaveBeenCalledTimes(1));
    const [id, payload] = mocks.updateSchedule.mock.calls[0];
    expect(id).toBe('boost-1');
    expect(Number.isFinite(new Date(payload.starts_at).getTime())).toBe(true);
    expect(new Date(payload.ends_at).getTime()).toBeGreaterThan(new Date(payload.starts_at).getTime());
    expect(await screen.findByText('Suite Plateau')).toBeInTheDocument();
  });

  it("refuse la reprogrammation d'un paiement en attente", async () => {
    mocks.mine.mockResolvedValue({ items: [makeBoost({ display_status: 'pending' })] });

    renderBoosts();
    await screen.findByText('Suite Plateau');

    expect(screen.queryByRole('button', { name: 'Modifier les dates' })).not.toBeInTheDocument();
    expect(screen.getByText('Paiement en attente')).toBeInTheDocument();
  });

  it("n'offre pas la reprogrammation d'une campagne annulée ni épuisée", async () => {
    mocks.mine.mockResolvedValue({
      items: [
        makeBoost({
          id: 'b-cancel',
          display_status: 'canceled',
          room: { ...makeBoost().room!, title: 'Chambre Annulée' },
        }),
        makeBoost({
          id: 'b-exhausted',
          display_status: 'exhausted',
          room: { ...makeBoost().room!, title: 'Chambre Épuisée' },
        }),
      ],
    });

    renderBoosts();
    await screen.findByText('Chambre Annulée');

    expect(screen.queryByRole('button', { name: 'Modifier les dates' })).not.toBeInTheDocument();
    expect(screen.getByText('Annulée')).toBeInTheDocument();
    expect(screen.getByText('Budget épuisé')).toBeInTheDocument();
  });

  it("affiche l'erreur serveur quand la reprogrammation échoue", async () => {
    mocks.updateSchedule.mockRejectedValue(new Error('Budget épuisé : créez une nouvelle campagne.'));
    renderBoosts();
    await screen.findByText('Suite Plateau');

    fireEvent.click(screen.getByRole('button', { name: 'Modifier les dates' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('Budget épuisé : créez une nouvelle campagne.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  it('construit les liens depuis le marché de l’URL', async () => {
    renderBoosts('/bj/gerant/boosts');

    const cta = await screen.findByRole('link', { name: /Nouvelle campagne/ });
    expect(cta).toHaveAttribute('href', '/bj/gerant/boosts/new');
  });
});
