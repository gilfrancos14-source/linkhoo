import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminTranslationsPage from './AdminTranslationsPage';

const mocks = vi.hoisted(() => ({
  listTranslationReview: vi.fn(),
  correctTranslation: vi.fn(),
  listGlossary: vi.fn(),
  saveGlossaryTerm: vi.fn(),
}));

vi.mock('../../lib/adminApi', () => ({ apiAdmin: mocks }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTranslationReview.mockResolvedValue([
    {
      entity_type: 'room',
      entity_id: 'r1',
      locale: 'en',
      field: 'title',
      value: 'Bad translation',
      status: 'auto',
      source_hash: 'x',
      updated_at: '2026-11-23T00:00:00Z',
    },
  ]);
  mocks.listGlossary.mockResolvedValue([{ source_term: 'FCFA', target_term: 'FCFA' }]);
  mocks.correctTranslation.mockResolvedValue(undefined);
  mocks.saveGlossaryTerm.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminTranslationsPage />
    </MemoryRouter>,
  );
}

describe('AdminTranslationsPage', () => {
  it('affiche les traductions à revoir et permet de corriger', async () => {
    renderPage();

    expect(await screen.findByText('Bad translation')).toBeInTheDocument();

    const textarea = screen.getByLabelText('Traduire title de r1');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Good translation');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));

    await waitFor(() =>
      expect(mocks.correctTranslation).toHaveBeenCalledWith({
        entityType: 'room',
        entityId: 'r1',
        locale: 'en',
        field: 'title',
        value: 'Good translation',
      }),
    );
  });

  it('permet d’ajouter un terme au glossaire', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Terme français'), 'Cocody');
    await userEvent.type(screen.getByLabelText('Traduction en'), 'Cocody');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() =>
      expect(mocks.saveGlossaryTerm).toHaveBeenCalledWith({
        sourceTerm: 'Cocody',
        locale: 'en',
        targetTerm: 'Cocody',
      }),
    );
  });
});
