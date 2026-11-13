import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures';

/**
 * Tiroir de navigation de l'espace client.
 *
 * Sur mobile, la sidebar est un tiroir hors écran : elle s'ouvre au bouton
 * hamburger de la topbar, se ferme par la croix ou par le fond assombri, et
 * se referme toute seule au changement de page.
 *
 * Sur ordinateur, elle peut être réduite à un rail (état mémorisé dans
 * localStorage).
 */
async function signIn(page: Page, role: 'client' | 'gerant'): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('e2e:auth', JSON.stringify({ signedIn: true, role: value }));
  }, role);
}

test.describe('espace client — navigation', () => {
  test('le tiroir s’ouvre au hamburger et se ferme à la croix', async ({ page }) => {
    await signIn(page, 'client');
    await mockApi(page, { role: 'client' });
    await page.setViewportSize({ width: 360, height: 780 });

    await page.goto('/ci/compte');

    const sidebar = page.locator('aside.client-sidebar');
    // Fermé : la sidebar est hors de l'écran.
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -247, 0)');

    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await expect(page.getByRole('link', { name: 'Mes séjours' })).toBeVisible();
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

    await page.getByRole('button', { name: 'Fermer la navigation' }).click();
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -247, 0)');
  });

  test('le tiroir se referme au changement de page', async ({ page }) => {
    await signIn(page, 'client');
    await mockApi(page, { role: 'client' });
    await page.setViewportSize({ width: 360, height: 780 });

    await page.goto('/ci/compte');
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.getByRole('link', { name: 'Mes séjours' }).click();

    await expect(page).toHaveURL(/view=stays/);
    const sidebar = page.locator('aside.client-sidebar');
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -247, 0)');
  });

  test('sur ordinateur, la sidebar se réduit et l’état est mémorisé', async ({ page }) => {
    await signIn(page, 'client');
    await mockApi(page, { role: 'client' });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto('/ci/compte');
    await page.getByRole('button', { name: 'Réduire le menu' }).click();

    const sidebar = page.locator('aside.client-sidebar');
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -247, 0)');
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('client-sidebar')))
      .toBe('true');

    // Le contenu occupe toute la largeur une fois la sidebar rangée.
    const margin = await page
      .locator('.client-main')
      .first()
      .evaluate((el) => getComputedStyle(el).marginLeft);
    expect(margin).toBe('0px');
  });
});
