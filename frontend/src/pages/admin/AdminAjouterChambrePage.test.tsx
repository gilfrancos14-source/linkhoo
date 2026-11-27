import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminAjouterChambrePage from './AdminAjouterChambrePage';

const mocks = vi.hoisted(() => ({
  listRoomGerants: vi.fn(),
  createRoom: vi.fn(),
  uploadFile: vi.fn(),
  formProps: vi.fn(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    listRoomGerants: mocks.listRoomGerants,
    createRoom: mocks.createRoom,
    uploadFile: mocks.uploadFile,
  },
}));

vi.mock('../gerant/ChambreFormMaq3', () => ({
  default: (props: { extraFields: ReactNode }) => {
    mocks.formProps(props);
    return <div data-testid="chambre-form">{props.extraFields}</div>;
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
    mocks.listRoomGerants.mockResolvedValue([
      {
        id: 'gerant-1',
        nom: 'Koné',
        prenom: 'Aya',
        email: 'aya@test.ci',
        market: 'BJ',
      },
    ]);
    mocks.createRoom.mockResolvedValue({ id: 'room-1' });
  });

  it('crée la chambre au nom du gérant sélectionné avec son marché', async () => {
    const { unmount } = renderPage();

    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'gerant-1' } });

    await waitFor(() =>
      expect(mocks.formProps).toHaveBeenCalledWith(
        expect.objectContaining({ marketOverride: 'BJ' }),
      ),
    );

    const props = mocks.formProps.mock.calls.at(-1)?.[0];
    await props.saveRoom({ title: 'Studio', market: 'BJ' });

    expect(mocks.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ gerantId: 'gerant-1', market: 'BJ', title: 'Studio' }),
    );
    unmount();
    cleanup();
  });

  it('refuse de sauvegarder sans gérant choisi', async () => {
    renderPage();
    await screen.findByRole('combobox');

    const props = mocks.formProps.mock.calls[0]?.[0];
    await expect(props.saveRoom({ title: 'Studio', market: 'CI' })).rejects.toThrow(
      'Choisissez un gérant propriétaire.',
    );
    expect(mocks.createRoom).not.toHaveBeenCalled();
  });
});
