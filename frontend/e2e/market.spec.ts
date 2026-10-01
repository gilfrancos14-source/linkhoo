import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

test.describe('marché Bénin', () => {
  test('affiche laccueil du marché BJ', async ({ page }) => {
    await mockApi(page);

    await page.goto('/bj');

    await expect(page.locator('html')).toHaveAttribute('data-market', 'BJ');
    await expect(page.locator('h1.hero__tagline')).toContainText('Trouvez le lieu idéal');
    await expect(page.locator('#categories .cat-card__title')).toHaveText([
      'Appartements moins chers',
      'Hôtels',
    ]);
  });

  test('préfixe les liens de la page par /bj', async ({ page }) => {
    await mockApi(page);

    await page.goto('/bj');

    await expect(page.locator('.stay-card__link').first()).toHaveAttribute(
      'href',
      /^\/bj\/chambre\//,
    );
    await expect(page.locator('.logo').first()).toHaveAttribute('href', '/bj');
  });

  test('bascule de CI vers BJ avec le sélecteur de marché', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');
    await expect(page.locator('html')).toHaveAttribute('data-market', 'CI');

    await page.getByRole('button', { name: 'Choisir le marché' }).click();
    const listbox = page.getByRole('listbox', { name: 'Choisir le marché' });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option', { name: "Côte d'Ivoire" })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await listbox.getByRole('option', { name: 'Bénin' }).click();

    await expect(page).toHaveURL(/\/bj$/);
    await expect(page.locator('html')).toHaveAttribute('data-market', 'BJ');
    await expect(page.locator('.market-selector .header-btn__label')).toHaveText('BJ');
  });
});
