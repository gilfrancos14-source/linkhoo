import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

test.describe('connexion admin', () => {
  test('affiche le formulaire de connexion', async ({ page }) => {
    await mockApi(page);

    await page.goto('/admin/login');

    await expect(page.locator('h1.admin-login__brand-title')).toHaveText('Linkhoo');
    await expect(page.locator('.admin-login__brand-subtitle')).toHaveText(
      "Gérez votre espace Côte d'Ivoire",
    );
    await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });

  test('annonce les identifiants invalides renvoyés par lapi', async ({ page }) => {
    await mockApi(page, { adminLoginFails: true });

    await page.goto('/admin/login');
    await page.fill('#email', 'admin@linkhoo.com');
    await page.fill('#password', 'mauvais');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.locator('.admin-login__error')).toContainText('Identifiants invalides');
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect(await page.evaluate(() => window.localStorage.getItem('admin_token'))).toBeNull();
  });

  test('connecte un administrateur valide', async ({ page }) => {
    await mockApi(page);

    await page.goto('/admin/login');
    await page.fill('#email', 'admin@linkhoo.com');
    await page.fill('#password', 'secret123');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('h1', { hasText: 'Tableau de bord' })).toBeVisible();
    const token = await page.evaluate(() => window.localStorage.getItem('admin_token'));
    expect(token).toBe('e2e-admin-token');
  });

  test('affiche le miroir du marché Bénin', async ({ page }) => {
    await mockApi(page);

    await page.goto('/bj/admin/login');

    await expect(page.locator('.admin-login__brand-subtitle')).toHaveText(
      'Gérez votre espace Bénin',
    );
  });
});

test.describe('gardes du back-office', () => {
  test('renvoie à la connexion sans jeton', async ({ page }) => {
    await mockApi(page);

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
  });

  test('renvoie à la connexion du marché sans jeton', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/admin/gerants');

    await expect(page).toHaveURL(/\/ci\/admin\/login$/);
    await expect(page.locator('.admin-login__brand-subtitle')).toHaveText(
      "Gérez votre espace Côte d'Ivoire",
    );
  });

  test('renvoie à la connexion quand le jeton est refusé', async ({ page }) => {
    await mockApi(page, { adminMeUnauthorized: true });
    await page.addInitScript(() => {
      window.localStorage.setItem('admin_token', 'e2e-expired');
    });

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
  });
});
