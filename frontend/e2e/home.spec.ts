import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

test.describe('accueil du marché CI', () => {
  test('affiche len-tête et la section des biens les plus demandés', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');

    await expect(page.getByRole('link', { name: /Linkhoo/ }).first()).toBeVisible();
    await expect(page.locator('h2.section-title').first()).toContainText('plus demand');
    await expect(page.locator('p.eyebrow').first()).toBeVisible();
  });

  test('la section catégories affiche les catégories du marché', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');

    await expect(page.locator('#categories .cat-card__title')).toHaveText([
      'Chambres moins chères',
      'Appartements',
    ]);
  });
});
