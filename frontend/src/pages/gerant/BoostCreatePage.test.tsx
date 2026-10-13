import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import BoostCreatePage from './BoostCreatePage';
import { isoDay } from '../../lib/boosts';
import type { BoostConfig, GerantData } from '../../lib/api';
import type { Room } from '../../data/rooms';

const mocks = vi.hoisted(() => ({
  userId: 'user_clerk_1' as string | null,
  getMe: vi.fn<() => Promise<GerantData>>(),
  fetchMyRooms: vi.fn<() => Promise<Room[]>>(),
  config: vi.fn<() => Promise<BoostConfig>>(),
  initiate: vi.fn<
    (payload: {
      room_id: string;
      mode: string;
      budget_total: number;
      starts_at: string;
      ends_at: string;
    }) => Promise<{ payment_url: string }>
  >(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: mocks.userId }),
}));

vi.mock('../../lib/api', () => ({
  apiGerants: { getMe: mocks.getMe },
  apiBoosts: { config: mocks.config, initiate: mocks.initiate },
}));

vi.mock('../../data/rooms', () => ({
  fetchMyRooms: mocks.fetchMyRooms,
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

const makeConfig = (): BoostConfig => ({
  currency: 'XOF',
  price_cpc: 50,
  price_cpi: 5,
  budget_min: 3000,
  budget_max: 100000,
  max_duration_days: 90,
});

const makeRooms = (): Room[] =>
  [
    { id: 'room-1', title: 'Suite Plateau', disponible: true },
    { id: 'room-2', title: 'Chambre Vue Mer', disponible: false },
  ] as unknown as Room[];

function renderCreate(entry = '/ci/gerant/boosts/new') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <BoostCreatePage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 'user_clerk_1';
  mocks.getMe.mockResolvedValue(makeGerant());
  mocks.fetchMyRooms.mockResolvedValue(makeRooms());
  mocks.config.mockResolvedValue(makeConfig());
  mocks.initiate.mockResolvedValue({ payment_url: 'https://fedapay.test/checkout/boost-1' });
});

afterEach(() => {
  cleanup();
});

describe('BoostCreatePage', () => {
  it("affiche l'état de chargement tant que la configuration n'est pas résolue", () => {
    mocks.config.mockImplementation(() => new Promise<BoostConfig>(() => {}));

    renderCreate();

    expect(screen.getByRole('heading', { level: 1, name: 'Nouvelle campagne' })).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByLabelText('Chambre')).not.toBeInTheDocument();
  });

  it("n'interroge rien sans userId Clerk", () => {
    mocks.userId = null;

    renderCreate();

    expect(mocks.getMe).not.toHaveBeenCalled();
    expect(mocks.fetchMyRooms).not.toHaveBeenCalled();
    expect(mocks.config).not.toHaveBeenCalled();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('bloque un gérant non vérifié derrière la vérification', async () => {
    mocks.getMe.mockResolvedValue(makeGerant({ is_verified: false }));

    renderCreate();

    expect(await screen.findByText('Vérification requise')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Compléter la vérification' }),
    ).toHaveAttribute('href', '/ci/gerant/verification');
    expect(screen.queryByLabelText('Chambre')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Mes campagnes' })).toHaveAttribute(
      'href',
      '/ci/gerant/boosts',
    );
  });

  it("guide vers l'ajout d'une chambre quand aucune n'est disponible", async () => {
    mocks.fetchMyRooms.mockResolvedValue([
      { id: 'room-2', title: 'Chambre Vue Mer', disponible: false },
    ] as unknown as Room[]);

    renderCreate();

    expect(await screen.findByRole('heading', { name: 'Aucune chambre disponible' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ajouter une chambre' })).toHaveAttribute(
      'href',
      '/ci/gerant/chambres/ajouter',
    );
    expect(mocks.initiate).not.toHaveBeenCalled();
  });

  it('signale la perte de tarifs quand la config échoue', async () => {
    mocks.config.mockRejectedValue(new Error('réseau'));

    renderCreate();

    expect(
      await screen.findByText('Tarifs indisponibles pour le moment. Réessayez plus tard.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Chambre')).not.toBeInTheDocument();
  });

  it('présente le formulaire complet avec les tarifs et la chambre disponible', async () => {
    renderCreate();

    expect(await screen.findByRole('heading', { name: '1. Chambre à booster' })).toBeInTheDocument();

    const roomSelect = screen.getByLabelText('Chambre') as HTMLSelectElement;
    expect(roomSelect.value).toBe('room-1');
    expect(screen.getByRole('option', { name: 'Suite Plateau' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Chambre Vue Mer' })).not.toBeInTheDocument();

    const cpc = screen.getByRole('button', { name: /Par clic — 50 F/ });
    expect(cpc).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Par impression — 5 F/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    const budgetInput = screen.getByLabelText('Budget (FCFA)') as HTMLInputElement;
    expect(budgetInput.value).toBe('3000');
    expect(budgetInput).toHaveAttribute('min', '3000');
    expect(budgetInput).toHaveAttribute('max', '100000');
    expect(screen.getByText(/De 3 000 F à 100 000 F/)).toBeInTheDocument();

    expect(screen.getByText('Chambre : Suite Plateau')).toBeInTheDocument();
    expect(screen.getByText('Mode : Par clic (50 F / clic)')).toBeInTheDocument();
    expect(screen.getByText('Budget : 3 000 F — ≈ 60 clics')).toBeInTheDocument();

    const start = screen.getByLabelText('Début') as HTMLInputElement;
    const end = screen.getByLabelText('Fin') as HTMLInputElement;
    expect(start.value).toBe(isoDay(new Date()));
    expect(end.value).toBe(isoDay(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
    expect(screen.getByText(`Du ${start.value} au ${end.value}`)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /^Payer\s3\s000\sF$/ })).toBeEnabled();
  });

  it('accepte un budget libre saisi par le gérant', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: '3. Budget' });

    const budgetInput = screen.getByLabelText('Budget (FCFA)') as HTMLInputElement;
    fireEvent.change(budgetInput, { target: { value: '7500' } });

    expect(screen.getByText('Budget : 7 500 F — ≈ 150 clics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Payer\s7\s500\sF$/ })).toBeEnabled();
  });

  it('refuse un budget sous le minimum serveur', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: '3. Budget' });

    fireEvent.change(screen.getByLabelText('Budget (FCFA)'), { target: { value: '1500' } });

    expect(await screen.findByText('Le budget minimum est de 3 000 F.')).toBeInTheDocument();
    expect(screen.getByText('Budget : —')).toBeInTheDocument();

    const pay = screen.getByRole('button', { name: 'Payer' });
    expect(pay).toBeDisabled();
    fireEvent.click(pay);
    expect(mocks.initiate).not.toHaveBeenCalled();
  });

  it('refuse un budget au-dessus du plafond serveur', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: '3. Budget' });

    fireEvent.change(screen.getByLabelText('Budget (FCFA)'), { target: { value: '150000' } });

    expect(await screen.findByText('Le budget maximum est de 100 000 F.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Payer' })).toBeDisabled();
  });

  it('refuse un budget non entier', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: '3. Budget' });

    fireEvent.change(screen.getByLabelText('Budget (FCFA)'), { target: { value: '3500.5' } });

    expect(await screen.findByText('Le budget doit être un nombre entier.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Payer' })).toBeDisabled();
  });

  it('refuse un budget qui n\'est pas multiple du pas de facturation', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: '3. Budget' });

    // Mode clic par défaut : le pas est de 50 F.
    fireEvent.change(screen.getByLabelText('Budget (FCFA)'), { target: { value: '3010' } });

    expect(
      await screen.findByText('Le budget doit être un multiple de 50 F (un clic).'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Payer' })).toBeDisabled();
  });

  it('recalcule le mode de facturation et les estimations en par impression', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: '2. Mode de facturation' });

    fireEvent.click(screen.getByRole('button', { name: /Par impression — 5 F/ }));

    expect(screen.getByRole('button', { name: /Par impression — 5 F/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Par clic — 50 F/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('Mode : Par impression (5 F / impression)')).toBeInTheDocument();
    expect(screen.getByText('Budget : 3 000 F — ≈ 600 impressions')).toBeInTheDocument();
  });

  it('refuse la soumission avec une fenêtre de dates invalide', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: '4. Dates' });

    const end = screen.getByLabelText('Fin') as HTMLInputElement;
    // m11 : une fin le même jour que le début est désormais valide (12:00 →
    // 23:59:59) — l'invalidité se construit avec une fin antérieure.
    fireEvent.change(end, { target: { value: isoDay(new Date(Date.now() - 24 * 60 * 60 * 1000)) } });

    expect(
      screen.getByText('La date de fin doit être postérieure à la date de début'),
    ).toBeInTheDocument();

    const pay = screen.getByRole('button', { name: /^Payer\s3\s000\sF$/ });
    expect(pay).toBeDisabled();
    fireEvent.click(pay);
    expect(mocks.initiate).not.toHaveBeenCalled();
  });

  it('initie le paiement avec les valeurs du formulaire', async () => {
    renderCreate();
    await screen.findByRole('button', { name: /^Payer\s3\s000\sF$/ });

    fireEvent.change(screen.getByLabelText('Budget (FCFA)'), { target: { value: '12500' } });
    fireEvent.click(screen.getByRole('button', { name: /^Payer\s12\s500\sF$/ }));

    expect(mocks.initiate).toHaveBeenCalledTimes(1);
    const payload = mocks.initiate.mock.calls[0][0];
    expect(payload.room_id).toBe('room-1');
    expect(payload.mode).toBe('cpc');
    expect(payload.budget_total).toBe(12500);
    expect(payload.starts_at).toBe(new Date(`${isoDay(new Date())}T12:00:00`).toISOString());
    // m11 : fin de journée, plus de demi-journée non livrée.
    expect(payload.ends_at).toBe(
      new Date(`${isoDay(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}T23:59:59`).toISOString(),
    );
    expect(screen.getByRole('button', { name: 'Redirection...' })).toBeDisabled();
  });

  it("affiche l'erreur serveur et débloque le bouton après un échec d'initiation", async () => {
    mocks.initiate.mockRejectedValue(new Error('Budget épuisé : session expirée'));
    renderCreate();
    await screen.findByRole('button', { name: /^Payer\s3\s000\sF$/ });

    fireEvent.click(screen.getByRole('button', { name: /^Payer\s3\s000\sF$/ }));

    expect(await screen.findByText('Budget épuisé : session expirée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Payer\s3\s000\sF$/ })).toBeEnabled();
    expect(mocks.initiate).toHaveBeenCalledTimes(1);
  });

  it('construit le lien « ← Mes campagnes » depuis le segment /bj', async () => {
    renderCreate('/bj/gerant/boosts/new');

    expect(await screen.findByRole('link', { name: '← Mes campagnes' })).toHaveAttribute(
      'href',
      '/bj/gerant/boosts',
    );
  });
});
