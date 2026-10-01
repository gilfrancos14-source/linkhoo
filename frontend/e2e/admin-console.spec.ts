import { expect, test } from '@playwright/test';
import { loginAdmin, mockApi } from './fixtures';

test.describe('console admin', () => {
  test('affiche le tableau de bord avec les statistiques', async ({ page }) => {
    await mockApi(page);
    await loginAdmin(page);

    await page.goto('/admin');

    await expect(page.locator('h1', { hasText: 'Tableau de bord' })).toBeVisible();
    await expect(page.locator('.dash-page-head')).toContainText(
      "Vue d'ensemble de la plateforme Linkhoo",
    );
    await expect(page.locator('.sidebar__user-role')).toHaveText('Administrateur');
    await expect(page.locator('.sidebar__user-name')).toHaveText('Awa');
    await expect(page.locator('.hero-kpi__value')).toHaveText('4');
    await expect(
      page.locator('nav.sidebar__nav').getByRole('link', { name: 'Tableau de bord' }),
    ).toHaveClass(/sidebar__link--active/);
  });

  test('navigue vers chaque page du back-office', async ({ page }) => {
    await mockApi(page);
    await loginAdmin(page);

    await page.goto('/admin');

    const nav = page.locator('nav.sidebar__nav');

    await nav.getByRole('link', { name: 'Réservations' }).click();
    await expect(page).toHaveURL(/\/admin\/reservations$/);
    await expect(page.locator('.admin-page__header h2')).toHaveText('Réservations');
    await expect(page.locator('.admin-table__empty')).toHaveText('Aucune réservation trouvée');

    await nav.getByRole('link', { name: 'Gérants' }).click();
    await expect(page).toHaveURL(/\/admin\/gerants$/);
    await expect(page.locator('h1', { hasText: 'Gérants' })).toBeVisible();
    await expect(page.getByText('Aucun gérant trouvé.')).toBeVisible();

    await nav.getByRole('link', { name: 'Bannières' }).click();
    await expect(page).toHaveURL(/\/admin\/banners$/);
    await expect(page.locator('h1', { hasText: 'Bannières' })).toBeVisible();
    await expect(page.getByText('Aucune bannière trouvée.')).toBeVisible();

    await nav.getByRole('link', { name: 'Événements' }).click();
    await expect(page).toHaveURL(/\/admin\/evenements$/);
    await expect(page.locator('h1', { hasText: 'Événements' })).toBeVisible();
    await expect(page.getByText('Aucun événement trouvé.')).toBeVisible();

    await nav.getByRole('link', { name: 'Promotions' }).click();
    await expect(page).toHaveURL(/\/admin\/promotions$/);
    await expect(page.locator('h1', { hasText: 'Promotions' })).toBeVisible();
    await expect(page.getByText('Aucune chambre assignée')).toBeVisible();

    await nav.getByRole('link', { name: 'Mot de passe' }).click();
    await expect(page).toHaveURL(/\/admin\/mot-de-passe$/);
    await expect(page.locator('h1', { hasText: 'Changer le mot de passe' })).toBeVisible();

    await nav.getByRole('link', { name: 'Tableau de bord' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('h1', { hasText: 'Tableau de bord' })).toBeVisible();
  });

  test('ouvre la liste des notifications vide', async ({ page }) => {
    await mockApi(page);
    await loginAdmin(page);

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Notifications' }).click();

    await expect(page.locator('.notif-dropdown')).toBeVisible();
    await expect(page.locator('.notif-dropdown__head')).toContainText('Notifications');
    await expect(page.locator('.notif-dropdown__empty')).toHaveText('Aucune notification');
  });

  test('valide le formulaire de changement de mot de passe', async ({ page }) => {
    await mockApi(page);
    await loginAdmin(page);

    await page.goto('/admin/mot-de-passe');
    await page.fill('#current-password', 'secret123');
    await page.fill('#new-password', 'nouveau1');
    await page.fill('#confirm-password', 'different');
    await page.getByRole('button', { name: 'Modifier le mot de passe' }).click();

    await expect(page.locator('.auth-error')).toHaveText('Les mots de passe ne correspondent pas');

    await page.fill('#confirm-password', 'nouveau1');
    await page.fill('#new-password', 'abc');
    await page.fill('#confirm-password', 'abc');
    await page.getByRole('button', { name: 'Modifier le mot de passe' }).click();

    await expect(page.locator('.auth-error')).toHaveText(
      'Le mot de passe doit contenir au moins 6 caractères',
    );
  });

  test('enregistre un nouveau mot de passe', async ({ page }) => {
    await mockApi(page);
    await loginAdmin(page);

    await page.goto('/admin/mot-de-passe');
    await page.fill('#current-password', 'secret123');
    await page.fill('#new-password', 'nouveau1');
    await page.fill('#confirm-password', 'nouveau1');
    await page.getByRole('button', { name: 'Modifier le mot de passe' }).click();

    await expect(page.getByText('Mot de passe modifié avec succès')).toBeVisible();
    await expect(page.locator('#new-password')).toHaveValue('');
  });

  test('déconnecte ladministrateur', async ({ page }) => {
    await mockApi(page);
    await loginAdmin(page);

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Déconnexion' }).click();

    await expect(page).toHaveURL(/\/admin\/login$/);
    expect(await page.evaluate(() => window.localStorage.getItem('admin_token'))).toBeNull();
  });

  test('marche aussi depuis le miroir du marché Bénin', async ({ page }) => {
    await mockApi(page);
    await loginAdmin(page);

    await page.goto('/bj/admin');

    await expect(page.locator('h1', { hasText: 'Tableau de bord' })).toBeVisible();
    await expect(
      page.locator('nav.sidebar__nav').getByRole('link', { name: 'Gérants' }),
    ).toHaveAttribute('href', '/bj/admin/gerants');
    await expect(page.locator('.admin-content')).toBeVisible();
  });
});
