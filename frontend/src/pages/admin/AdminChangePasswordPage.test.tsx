import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminChangePasswordPage from './AdminChangePasswordPage';

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn<(currentPassword: string, newPassword: string) => Promise<{ message: string }>>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: { changePassword: mocks.changePassword },
}));

function renderPage() {
  return render(<AdminChangePasswordPage />);
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  current: string,
  next: string,
  confirm: string,
) {
  await user.type(screen.getByLabelText('Mot de passe actuel'), current);
  await user.type(screen.getByLabelText('Nouveau mot de passe'), next);
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.changePassword.mockResolvedValue({ message: 'ok' });
});

afterEach(() => {
  cleanup();
});

describe('AdminChangePasswordPage', () => {
  it('affiche le titre, la description et les trois champs de mot de passe', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Changer le mot de passe' })).toBeInTheDocument();
    expect(screen.getByText('Modifiez votre mot de passe de connexion admin')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Confirmer le mot de passe')).toHaveAttribute('type', 'password');
  });

  it("exige les trois champs et précise l'accessibilité des mots de passe", () => {
    renderPage();

    expect(screen.getByLabelText('Mot de passe actuel')).toBeRequired();
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeRequired();
    expect(screen.getByLabelText('Confirmer le mot de passe')).toBeRequired();
    expect(screen.getByPlaceholderText('Minimum 6 caractères')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier le mot de passe' })).toBeEnabled();
  });

  it('refuse une confirmation qui ne correspond pas sans appeler l’API', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillForm(user, 'secret-1', 'nouveau-1', 'nouveau-2');
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(
      await screen.findByText('Les mots de passe ne correspondent pas'),
    ).toBeInTheDocument();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe de moins de 6 caractères sans appeler l’API', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillForm(user, 'secret-1', 'abc', 'abc');
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(
      await screen.findByText('Le mot de passe doit contenir au moins 6 caractères'),
    ).toBeInTheDocument();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it('envoie les deux mots de passe à l’API puis vide les champs', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillForm(user, 'ancien-mdp', 'nouveau-mdp', 'nouveau-mdp');
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(await screen.findByText('Mot de passe modifié avec succès')).toBeInTheDocument();
    expect(mocks.changePassword).toHaveBeenCalledTimes(1);
    expect(mocks.changePassword).toHaveBeenCalledWith('ancien-mdp', 'nouveau-mdp');

    expect(screen.getByLabelText('Mot de passe actuel')).toHaveValue('');
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveValue('');
    expect(screen.getByLabelText('Confirmer le mot de passe')).toHaveValue('');
  });

  it("bloque le bouton et affiche l'état d'enregistrement pendant la requête", async () => {
    let resolveCall: (value: { message: string }) => void = () => {};
    mocks.changePassword.mockImplementation(
      () =>
        new Promise<{ message: string }>((resolve) => {
          resolveCall = resolve;
        }),
    );

    const user = userEvent.setup();
    renderPage();

    await fillForm(user, 'ancien-mdp', 'nouveau-mdp', 'nouveau-mdp');
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    const busy = await screen.findByRole('button', { name: 'Enregistrement...' });
    expect(busy).toBeDisabled();

    resolveCall({ message: 'ok' });
    expect(await screen.findByRole('button', { name: 'Modifier le mot de passe' })).toBeEnabled();
  });

  it("remonte l'erreur renvoyée par l'API et réactive le bouton", async () => {
    mocks.changePassword.mockRejectedValue(new Error('Mot de passe actuel incorrect'));

    const user = userEvent.setup();
    renderPage();

    await fillForm(user, 'faux', 'nouveau-mdp', 'nouveau-mdp');
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(await screen.findByText('Mot de passe actuel incorrect')).toBeInTheDocument();
    expect(screen.queryByText('Mot de passe modifié avec succès')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier le mot de passe' })).toBeEnabled();
  });

  it("affiche un message générique quand le rejet n'a pas de message", async () => {
    mocks.changePassword.mockRejectedValue('panne brute');

    const user = userEvent.setup();
    renderPage();

    await fillForm(user, 'ancien-mdp', 'nouveau-mdp', 'nouveau-mdp');
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(await screen.findByText('Erreur lors de la modification')).toBeInTheDocument();
  });

  it('efface une erreur précédente dès la soumission suivante', async () => {
    mocks.changePassword.mockRejectedValueOnce(new Error('Token expiré'));

    const user = userEvent.setup();
    renderPage();

    await fillForm(user, 'ancien-mdp', 'nouveau-mdp', 'nouveau-mdp');
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));
    expect(await screen.findByText('Token expiré')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    await waitFor(() => {
      expect(screen.queryByText('Token expiré')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Mot de passe modifié avec succès')).toBeInTheDocument();
    expect(mocks.changePassword).toHaveBeenCalledTimes(2);
  });

  it("remplace l'erreur de validation par le succès après correction", async () => {
    const user = userEvent.setup();
    renderPage();

    await fillForm(user, 'ancien-mdp', 'nouveau-mdp', 'autre-mdp');
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));
    expect(
      await screen.findByText('Les mots de passe ne correspondent pas'),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Confirmer le mot de passe'));
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'nouveau-mdp');
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(await screen.findByText('Mot de passe modifié avec succès')).toBeInTheDocument();
    expect(
      screen.queryByText('Les mots de passe ne correspondent pas'),
    ).not.toBeInTheDocument();
    expect(mocks.changePassword).toHaveBeenCalledTimes(1);
  });

  it("ne déclenche aucune requête tant que le formulaire n'est pas soumis", async () => {
    const user = userEvent.setup();
    renderPage();

    await fillForm(user, 'ancien-mdp', 'nouveau-mdp', 'nouveau-mdp');

    expect(mocks.changePassword).not.toHaveBeenCalled();
    expect(screen.queryByText('Mot de passe modifié avec succès')).not.toBeInTheDocument();
  });
});
