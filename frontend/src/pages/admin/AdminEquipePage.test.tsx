import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminEquipePage from './AdminEquipePage';
import type {
  AdminData,
  AdminPermissionDef,
  AdminTeamCreatePayload,
  AdminTeamMember,
  AdminTeamUpdatePayload,
} from '../../lib/adminApi';

const mocks = vi.hoisted(() => ({
  getMe: vi.fn<() => Promise<AdminData>>(),
  listTeam: vi.fn<() => Promise<AdminTeamMember[]>>(),
  getPermissionCatalog: vi.fn<() => Promise<AdminPermissionDef[]>>(),
  createTeamMember: vi.fn<(payload: AdminTeamCreatePayload) => Promise<AdminTeamMember>>(),
  updateTeamMember: vi.fn<
    (id: string, payload: AdminTeamUpdatePayload) => Promise<AdminTeamMember>
  >(),
  deleteTeamMember: vi.fn<(id: string) => Promise<void>>(),
}));

vi.mock('../../lib/adminApi', () => ({
  apiAdmin: {
    getMe: mocks.getMe,
    listTeam: mocks.listTeam,
    getPermissionCatalog: mocks.getPermissionCatalog,
    createTeamMember: mocks.createTeamMember,
    updateTeamMember: mocks.updateTeamMember,
    deleteTeamMember: mocks.deleteTeamMember,
  },
}));

const catalog: AdminPermissionDef[] = [
  { key: 'gerants', label: 'Gérants', description: 'Vérifier et gérer les gérants' },
  { key: 'reservations', label: 'Réservations', description: 'Consulter et traiter les réservations' },
  { key: 'bannieres', label: 'Bannières', description: 'Gérer les bannières' },
  { key: 'evenements', label: 'Événements', description: 'Gérer les événements' },
  { key: 'destinations', label: 'Destinations', description: 'Gérer les destinations' },
  { key: 'promotions', label: 'Promotions', description: 'Gérer les promotions' },
  { key: 'boosts', label: 'Booster', description: 'Gérer les boosts de visibilité' },
  { key: 'stats', label: 'Tableau de bord', description: 'Consulter les statistiques' },
];

function makeMe(overrides: Partial<AdminData> = {}): AdminData {
  return {
    id: 'adm-1',
    email: 'root@ilehya.ci',
    nom: 'Bar',
    prenom: 'Awa',
    is_superadmin: true,
    permissions: [],
    ...overrides,
  };
}

function makeMember(overrides: Partial<AdminTeamMember> = {}): AdminTeamMember {
  return {
    id: 'adm-2',
    email: 'limite@ilehya.ci',
    nom: 'Konan',
    prenom: 'Yao',
    is_superadmin: false,
    permissions: ['reservations', 'bannieres'],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return render(<AdminEquipePage />);
}

function user() {
  return userEvent.setup({ delay: null, pointerEventsCheck: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMe.mockResolvedValue(makeMe());
  mocks.listTeam.mockResolvedValue([
    makeMember({
      id: 'adm-1',
      email: 'root@ilehya.ci',
      nom: 'Bar',
      prenom: 'Awa',
      is_superadmin: true,
      permissions: [],
    }),
    makeMember(),
  ]);
  mocks.getPermissionCatalog.mockResolvedValue(catalog);
  mocks.createTeamMember.mockResolvedValue(makeMember({ id: 'adm-3', email: 'nouveau@ilehya.ci' }));
  mocks.updateTeamMember.mockResolvedValue(makeMember());
  mocks.deleteTeamMember.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('AdminEquipePage — chargement', () => {
  it("affiche le titre, la description et le bouton d'ajout", async () => {
    renderPage();

    expect(
      await screen.findByText('Créer et gérer les comptes administrateurs et leur périmètre'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Équipe' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ajouter un administrateur' }),
    ).toBeInTheDocument();
  });

  it("liste les comptes avec rôle, email, section « Vous » et libellés de périmètre", async () => {
    renderPage();

    expect(await screen.findByText('Awa Bar')).toBeInTheDocument();
    expect(screen.getByText('root@ilehya.ci')).toBeInTheDocument();
    expect(screen.getByText('Superadmin')).toBeInTheDocument();
    expect(screen.getByText('Vous')).toBeInTheDocument();
    expect(screen.getByText('Toutes les sections')).toBeInTheDocument();

    expect(screen.getByText('Yao Konan')).toBeInTheDocument();
    expect(screen.getByText('limite@ilehya.ci')).toBeInTheDocument();
    expect(screen.getByText('Réservations')).toBeInTheDocument();
    expect(screen.getByText('Bannières')).toBeInTheDocument();
    const yaoCard = screen.getByText('Yao Konan').closest('.panel') as HTMLElement;
    expect(within(yaoCard).queryByText('Superadmin')).toBeNull();

    expect(mocks.getMe).toHaveBeenCalledTimes(1);
    expect(mocks.listTeam).toHaveBeenCalledTimes(1);
    expect(mocks.getPermissionCatalog).toHaveBeenCalledTimes(1);
  });

  it("affiche l'état vide sans compte", async () => {
    mocks.listTeam.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Aucun compte administrateur.')).toBeInTheDocument();
  });

  it("affiche le message réservé au superadministrateur sur Permission refusée", async () => {
    mocks.listTeam.mockRejectedValue(new Error('Permission refusée'));

    renderPage();

    expect(
      await screen.findByText(/La gestion de l'équipe est réservée au superadministrateur\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter un administrateur' })).toBeNull();
  });

  it("affiche l'erreur générique quand le chargement échoue", async () => {
    mocks.listTeam.mockRejectedValue(new Error('réseau coupé'));

    renderPage();

    expect(await screen.findByText('réseau coupé')).toBeInTheDocument();
    expect(screen.queryByText('Aucun compte administrateur.')).toBeNull();
  });
});

describe('AdminEquipePage — création', () => {
  it("ouvre et ferme le formulaire sans appel API", async () => {
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    await u.click(screen.getByRole('button', { name: 'Ajouter un administrateur' }));
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sections autorisées' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(mocks.createTeamMember).not.toHaveBeenCalled();
  });

  it("refuse un mot de passe de moins de 6 caractères sans appel API", async () => {
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    await u.click(screen.getByRole('button', { name: 'Ajouter un administrateur' }));
    await u.type(screen.getByLabelText('Email'), 'nouveau@ilehya.ci');
    await u.type(screen.getByLabelText('Prénom'), 'Aya');
    await u.type(screen.getByLabelText('Nom'), 'Diabaté');
    await u.type(screen.getByLabelText('Mot de passe provisoire'), 'abc');
    await u.click(screen.getByRole('button', { name: 'Créer le compte' }));

    expect(
      await screen.findByText('Le mot de passe doit contenir au moins 6 caractères'),
    ).toBeInTheDocument();
    expect(mocks.createTeamMember).not.toHaveBeenCalled();
  });

  it('crée un compte avec le périmètre sélectionné puis recharge la liste', async () => {
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    await u.click(screen.getByRole('button', { name: 'Ajouter un administrateur' }));
    await u.type(screen.getByLabelText('Email'), 'nouveau@ilehya.ci');
    await u.type(screen.getByLabelText('Prénom'), 'Aya');
    await u.type(screen.getByLabelText('Nom'), 'Diabaté');
    await u.type(screen.getByLabelText('Mot de passe provisoire'), 'secret-1');
    await u.click(screen.getByRole('checkbox', { name: /Gérants/ }));
    await u.click(screen.getByRole('button', { name: 'Créer le compte' }));

    expect(mocks.createTeamMember).toHaveBeenCalledTimes(1);
    expect(mocks.createTeamMember).toHaveBeenCalledWith({
      email: 'nouveau@ilehya.ci',
      password: 'secret-1',
      nom: 'Diabaté',
      prenom: 'Aya',
      permissions: ['gerants'],
    });
    expect(
      await screen.findByText(
        'Compte créé pour nouveau@ilehya.ci — transmettez-lui le mot de passe hors plateforme.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(mocks.listTeam).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it("remonte l'erreur de l'API (email déjà utilisé)", async () => {
    mocks.createTeamMember.mockRejectedValue(
      new Error('Un compte existe déjà avec cet email'),
    );
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    await u.click(screen.getByRole('button', { name: 'Ajouter un administrateur' }));
    await u.type(screen.getByLabelText('Email'), 'limite@ilehya.ci');
    await u.type(screen.getByLabelText('Prénom'), 'Aya');
    await u.type(screen.getByLabelText('Nom'), 'Diabaté');
    await u.type(screen.getByLabelText('Mot de passe provisoire'), 'secret-1');
    await u.click(screen.getByRole('button', { name: 'Créer le compte' }));

    expect(
      await screen.findByText('Un compte existe déjà avec cet email'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('limite@ilehya.ci');
  });
});

describe('AdminEquipePage — modification du périmètre', () => {
  it("ouvre l'édition pré-cochée puis enregistre le périmètre", async () => {
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    const card = screen.getByText('Yao Konan').closest('.panel') as HTMLElement;
    await u.click(within(card).getByRole('button', { name: 'Modifier' }));

    expect(within(card).getByRole('checkbox', { name: 'Réservations' })).toBeChecked();
    expect(within(card).getByRole('checkbox', { name: 'Bannières' })).toBeChecked();
    expect(within(card).getByRole('checkbox', { name: 'Gérants' })).not.toBeChecked();
    expect(
      within(card).getByRole('checkbox', { name: /Super administrateur/ }),
    ).not.toBeChecked();

    await u.click(within(card).getByRole('checkbox', { name: 'Gérants' }));
    await u.click(within(card).getByRole('button', { name: 'Enregistrer le périmètre' }));

    expect(mocks.updateTeamMember).toHaveBeenCalledTimes(1);
    expect(mocks.updateTeamMember).toHaveBeenCalledWith('adm-2', {
      permissions: ['reservations', 'bannieres', 'gerants'],
      is_superadmin: false,
    });
    expect(await screen.findByText('Périmètre mis à jour')).toBeInTheDocument();
    await waitFor(() => expect(mocks.listTeam).toHaveBeenCalledTimes(2));
  });

  it("masque les cases de sections quand le compte est promu superadmin", async () => {
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    const card = screen.getByText('Yao Konan').closest('.panel') as HTMLElement;
    await u.click(within(card).getByRole('button', { name: 'Modifier' }));
    await u.click(within(card).getByRole('checkbox', { name: /Super administrateur/ }));

    expect(within(card).queryByRole('checkbox', { name: 'Réservations' })).toBeNull();
    expect(within(card).queryByRole('checkbox', { name: 'Gérants' })).toBeNull();
  });

  it("annule l'édition sans appel API", async () => {
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    const card = screen.getByText('Yao Konan').closest('.panel') as HTMLElement;
    await u.click(within(card).getByRole('button', { name: 'Modifier' }));
    expect(within(card).getByRole('checkbox', { name: 'Réservations' })).toBeInTheDocument();

    await u.click(within(card).getByRole('button', { name: 'Annuler' }));
    expect(within(card).queryByRole('checkbox', { name: 'Réservations' })).toBeNull();
    expect(mocks.updateTeamMember).not.toHaveBeenCalled();
  });
});

describe('AdminEquipePage — réinitialisation du mot de passe', () => {
  it("refuse un mot de passe trop court sans appel API", async () => {
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    const card = screen.getByText('Yao Konan').closest('.panel') as HTMLElement;
    await u.click(within(card).getByRole('button', { name: 'Mot de passe' }));
    await u.type(within(card).getByLabelText('Nouveau mot de passe'), 'abc');
    await u.click(within(card).getByRole('button', { name: 'Réinitialiser' }));

    expect(
      await screen.findByText('Le mot de passe doit contenir au moins 6 caractères'),
    ).toBeInTheDocument();
    expect(mocks.updateTeamMember).not.toHaveBeenCalled();
  });

  it("réinitialise le mot de passe du compte", async () => {
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    const card = screen.getByText('Yao Konan').closest('.panel') as HTMLElement;
    await u.click(within(card).getByRole('button', { name: 'Mot de passe' }));
    await u.type(within(card).getByLabelText('Nouveau mot de passe'), 'secret-2');
    await u.click(within(card).getByRole('button', { name: 'Réinitialiser' }));

    expect(mocks.updateTeamMember).toHaveBeenCalledTimes(1);
    expect(mocks.updateTeamMember).toHaveBeenCalledWith('adm-2', { password: 'secret-2' });
    expect(
      await screen.findByText('Mot de passe réinitialisé — transmettez-le hors plateforme.'),
    ).toBeInTheDocument();
  });
});

describe('AdminEquipePage — suppression', () => {
  it("ne supprime rien quand l'confirmation est refusée", async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    const card = screen.getByText('Yao Konan').closest('.panel') as HTMLElement;
    await u.click(within(card).getByRole('button', { name: 'Supprimer' }));

    expect(confirmSpy).toHaveBeenCalledWith('Supprimer le compte de limite@ilehya.ci ?');
    expect(mocks.deleteTeamMember).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("supprime le compte confirmé puis recharge la liste", async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    const card = screen.getByText('Yao Konan').closest('.panel') as HTMLElement;
    await u.click(within(card).getByRole('button', { name: 'Supprimer' }));

    expect(mocks.deleteTeamMember).toHaveBeenCalledTimes(1);
    expect(mocks.deleteTeamMember).toHaveBeenCalledWith('adm-2');
    expect(await screen.findByText('Compte supprimé')).toBeInTheDocument();
    await waitFor(() => expect(mocks.listTeam).toHaveBeenCalledTimes(2));
    confirmSpy.mockRestore();
  });

  it("n'affiche pas le bouton Supprimer sur son propre compte", async () => {
    renderPage();
    await screen.findByText('Awa Bar');

    const card = screen.getByText('Awa Bar').closest('.panel') as HTMLElement;
    expect(within(card).queryByRole('button', { name: 'Supprimer' })).toBeNull();
    expect(within(card).getByText('Vous')).toBeInTheDocument();
  });

  it("affiche l'erreur de suppression renvoyée par l'API", async () => {
    mocks.deleteTeamMember.mockRejectedValue(new Error('Impossible de supprimer le dernier superadministrateur'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const u = user();
    renderPage();
    await screen.findByText('Yao Konan');

    const card = screen.getByText('Yao Konan').closest('.panel') as HTMLElement;
    await u.click(within(card).getByRole('button', { name: 'Supprimer' }));

    expect(
      await screen.findByText('Impossible de supprimer le dernier superadministrateur'),
    ).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
