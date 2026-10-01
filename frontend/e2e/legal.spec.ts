import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

test.describe('pages légales', () => {
  test('affiche les mentions légales', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/mentions-legales');

    await expect(page.locator('h1.page-legal__title')).toHaveText('Mentions légales');
    await expect(page.locator('.page-legal__section').first()).toContainText('1. Éditeur du site');
    await expect(page.locator('.page-legal__back')).toBeVisible();
  });

  test('affiche la politique de confidentialité', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/politique-de-confidentialite');

    await expect(page.locator('h1.page-legal__title')).toHaveText(
      'Politique de confidentialité',
    );
    await expect(page.locator('.page-legal__section').first()).toContainText(
      '1. Responsable du traitement',
    );
  });

  test('ouvre les mentions légales depuis le pied de page', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');
    const legalNav = page.locator('nav[aria-label="Informations légales"]');
    await legalNav.scrollIntoViewIfNeeded();

    await legalNav.getByRole('link', { name: 'Mentions légales' }).click();

    await expect(page).toHaveURL(/\/ci\/mentions-legales$/);
    await expect(page.locator('h1.page-legal__title')).toHaveText('Mentions légales');
  });

  test('retourne à léaccueil depuis les mentions légales', async ({ page }) => {
    await mockApi(page);

    await page.goto('/bj/mentions-legales');
    await page.locator('.page-legal__back').click();

    await expect(page).toHaveURL(/\/bj$/);
    await expect(page.locator('h1.hero__tagline')).toBeVisible();
  });
});
