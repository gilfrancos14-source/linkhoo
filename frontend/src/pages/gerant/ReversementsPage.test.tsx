import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import ReversementsPage from './ReversementsPage';
import type { PayoutData, PayoutSettingsData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn<() => Promise<PayoutSettingsData>>(),
  saveSettings: vi.fn<(data: unknown) => Promise<PayoutSettingsData>>(),
  listMine: vi.fn<() => Promise<PayoutData[]>>(),
  getBalance: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('../../lib/api', () => ({
  apiPayouts: {
    getSettings: mocks.getSettings,
    saveSettings: mocks.saveSettings,
    listMine: mocks.listMine,
    getBalance: mocks.getBalance,
  },
  apiReservations: {
    list: vi.fn().mockResolvedValue([]),
  },
  apiMessages: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

// La sidebar gérant partagée (GerantSidebar) rappelle useGerantChrome :
// on la neutralise pour éviter des appels réseau parasite dans les tests.
vi.mock('../../hooks/useGerantChrome', () => ({
  useGerantChrome: () => ({
    gerant: null,
    displayName: 'Gérant',
    initials: 'G',
    reservationsCount: 0,
    messagesUnread: 0,
    isLoading: false,
    error: null,
  }),
}));

function makeSettings(overrides: Partial<PayoutSettingsData> = {}): PayoutSettingsData {
  return {
    method: 'mobile_money',
    phone: '+2250700000000',
    provider: 'orange',
    bank_code: null,
    bank_name: null,
    account_number: null,
    holder_name: 'Awa Kouassi',
    verified: true,
    verified_at: '2026-10-05T10:00:00.000Z',
    missing_fields: [],
    providers: [],
    ...overrides,
  };
}

function makePayout(overrides: Partial<PayoutData> = {}): PayoutData {
  return {
    id: 'payout-1',
    reference: 'OUT-ABC123',
    reservation_id: 'res-1',
    kind: 'reservation',
    gross_amount: 150000,
    commission_amount: 0,
    refunded_amount: 0,
    net_amount: 150000,
    currency: 'XOF',
    status: 'paid',
    scheduled_for: '2026-10-06T10:00:00.000Z',
    paid_at: '2026-10-06T11:00:00.000Z',
    failure_code: null,
    requested_at: null,
    created_at: '2026-10-05T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSettings.mockResolvedValue(makeSettings());
  mocks.listMine.mockResolvedValue([makePayout()]);
  mocks.saveSettings.mockImplementation((data) =>
    Promise.resolve(
      makeSettings({
        ...(data as Partial<PayoutSettingsData>),
        verified: false,
        verified_at: null,
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
});

/** La sidebar gérant partagée a besoin du contexte marché et du routeur. */
function renderPage() {
  return render(
    <MemoryRouter>
      <MarketProvider>
        <ReversementsPage />
      </MarketProvider>
    </MemoryRouter>,
  );
}

describe('ReversementsPage', () => {
  it('affiche les coordonnées vérifiées et l’historique des versements', async () => {
    renderPage();

    expect(
      await screen.findByText(/Coordonnées mobile money prêtes à recevoir vos retraits/),
    ).toBeInTheDocument();
    // Le solde du portefeuille et l'historique affichent tous deux le net.
    expect(
      screen.getAllByText('150 000 XOF').length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Réf. OUT-ABC123')).toBeInTheDocument();
    expect(screen.getByText('Versé')).toBeInTheDocument();
  });

  it('signale les coordonnées incomplètes et les versements bloqués', async () => {
    mocks.getSettings.mockResolvedValue(
      makeSettings({ verified: false, verified_at: null, missing_fields: ['phone'] }),
    );
    mocks.listMine.mockResolvedValue([
      makePayout({
        status: 'scheduled',
        paid_at: null,
        failure_code: 'payout_details_missing',
      }),
    ]);

    renderPage();

    expect(await screen.findByText(/Coordonnées incomplètes/)).toBeInTheDocument();
    expect(screen.getByText('Coordonnées à compléter')).toBeInTheDocument();
  });

  it('enregistre les coordonnées mobile money et demande une nouvelle vérification', async () => {
    const user = userEvent.setup();
    renderPage();

    const holder = await screen.findByLabelText('Titulaire du compte');
    fireEvent.change(holder, { target: { value: 'Awa Koné' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes coordonnées' }));

    await waitFor(() =>
      expect(mocks.saveSettings).toHaveBeenCalledWith({
        method: 'mobile_money',
        holder_name: 'Awa Koné',
        phone: '+2250700000000',
        provider: 'ORANGE',
        bank_code: null,
        bank_name: null,
        account_number: null,
      }),
    );
    expect(
      await screen.findByText(/Coordonnées enregistrées/),
    ).toBeInTheDocument();
  });

  it('valide le numéro mobile money requis avant l’enregistrement', async () => {
    const user = userEvent.setup();
    renderPage();

    const holder = await screen.findByLabelText('Titulaire du compte');
    const phone = screen.getByLabelText('Numéro mobile money');
    fireEvent.change(holder, { target: { value: 'Awa Koné' } });
    fireEvent.change(phone, { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes coordonnées' }));

    expect(
      screen.getByText('Renseignez le numéro mobile money.'),
    ).toBeInTheDocument();
    expect(mocks.saveSettings).not.toHaveBeenCalled();
  });
});
