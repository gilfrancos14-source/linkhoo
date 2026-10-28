import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReversementsPage from './ReversementsPage';
import type { PayoutData, PayoutSettingsData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn<() => Promise<PayoutSettingsData>>(),
  saveSettings: vi.fn<(data: unknown) => Promise<PayoutSettingsData>>(),
  listMine: vi.fn<() => Promise<PayoutData[]>>(),
}));

vi.mock('../../lib/api', () => ({
  apiPayouts: {
    getSettings: mocks.getSettings,
    saveSettings: mocks.saveSettings,
    listMine: mocks.listMine,
  },
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
    ...overrides,
  };
}

function makePayout(overrides: Partial<PayoutData> = {}): PayoutData {
  return {
    id: 'payout-1',
    reference: 'OUT-ABC123',
    reservation_id: 'res-1',
    gross_amount: 150000,
    commission_amount: 0,
    refunded_amount: 0,
    net_amount: 150000,
    currency: 'XOF',
    status: 'paid',
    scheduled_for: '2026-10-06T10:00:00.000Z',
    paid_at: '2026-10-06T11:00:00.000Z',
    failure_code: null,
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

describe('ReversementsPage', () => {
  it('affiche les coordonnées vérifiées et l’historique des versements', async () => {
    render(<ReversementsPage />);

    expect(await screen.findByText(/Coordonnées vérifiées le 05\/10\/2026/)).toBeInTheDocument();
    expect(screen.getAllByText('150 000 XOF')).toHaveLength(2);
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

    render(<ReversementsPage />);

    expect(await screen.findByText(/Coordonnées incomplètes/)).toBeInTheDocument();
    expect(screen.getByText('Coordonnées à compléter')).toBeInTheDocument();
  });

  it('enregistre les coordonnées mobile money et demande une nouvelle vérification', async () => {
    const user = userEvent.setup();
    render(<ReversementsPage />);

    const holder = await screen.findByLabelText('Titulaire du compte');
    fireEvent.change(holder, { target: { value: 'Awa Koné' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes coordonnées' }));

    await waitFor(() =>
      expect(mocks.saveSettings).toHaveBeenCalledWith({
        method: 'mobile_money',
        holder_name: 'Awa Koné',
        phone: '+2250700000000',
        provider: 'orange',
        bank_code: null,
        bank_name: null,
        account_number: null,
      }),
    );
    expect(
      await screen.findByText(/Coordonnées enregistrées/),
    ).toBeInTheDocument();
  });

  it('bascule en virement bancaire et valide les champs requis', async () => {
    const user = userEvent.setup();
    render(<ReversementsPage />);

    await screen.findByLabelText('Titulaire du compte');
    await user.click(screen.getByRole('button', { name: 'Virement bancaire' }));

    expect(screen.getByLabelText('Banque')).toBeInTheDocument();
    expect(screen.getByLabelText('Code banque')).toBeInTheDocument();
    expect(screen.getByLabelText('Numéro de compte')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Banque'), { target: { value: 'Ecobank' } });
    fireEvent.change(screen.getByLabelText('Code banque'), { target: { value: 'CI001' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes coordonnées' }));

    expect(
      screen.getByText('Renseignez le numéro de compte.'),
    ).toBeInTheDocument();
    expect(mocks.saveSettings).not.toHaveBeenCalled();
  });
});
