import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

test.describe('navigation', () => {
  test('affiche la page 404 pour une route inconnue du marché', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/page-inexistante');

    await expect(page.locator('h1.error-page__title')).toHaveText('Page introuvable');
    await expect(page.getByText('404', { exact: true })).toBeVisible();
  });

  test('retourne à laccueil depuis la page 404', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/page-inexistante');
    await page.locator('.error-page__link').click();

    await expect(page.locator('h2.section-title').first()).toContainText('plus demand');
    expect(page.url()).toContain('/ci');
  });
});
