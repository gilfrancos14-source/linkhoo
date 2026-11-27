import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminAjouterChambrePage from './AdminAjouterChambrePage';

const mocks = vi.hoisted(() => ({
  createRoom: vi.fn(),
  uploadFile: vi.fn(),
  formProps: vi.fn(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    createRoom: mocks.createRoom,
    uploadFile: mocks.uploadFile,
  },
}));

vi.mock('../gerant/ChambreFormMaq3', () => ({
  default: (props: {
    extraFields?: ReactNode;
    marketOverride?: string;
    saveRoom: (room: Record<string, unknown>) => Promise<void>;
  }) => {
    mocks.formProps(props);
    return <div data-testid="chambre-form" />;
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ci/admin/chambres/ajouter']}>
      <AdminAjouterChambrePage />
    </MemoryRouter>,
  );
}

describe('AdminAjouterChambrePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRoom.mockResolvedValue({ id: 'room-1' });
  });

  afterEach(() => {
    cleanup();
  });

  it('ne propose aucun sélecteur de gérant', async () => {
    renderPage();

    expect(await screen.findByTestId('chambre-form')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(/vérifiée et fiable d'office/)).toBeInTheDocument();

    const props = mocks.formProps.mock.calls[0]?.[0];
    expect(props?.marketOverride).toBeUndefined();
    expect(props?.extraFields).toBeUndefined();
  });

  it('crée la chambre sans gerantId : le backend l’attribue à l’admin', async () => {
    renderPage();
    await screen.findByTestId('chambre-form');

    const props = mocks.formProps.mock.calls[0]?.[0];
    await props.saveRoom({ title: 'Studio', market: 'BJ' });

    await waitFor(() => expect(mocks.createRoom).toHaveBeenCalledTimes(1));
    expect(mocks.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Studio', market: 'BJ' }),
    );
    expect(mocks.createRoom.mock.calls[0][0]).not.toHaveProperty('gerantId');
  });
});
