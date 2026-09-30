import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

const DATES = 'arrivee=2026-11-01&depart=2026-11-05';

test.describe('page de recherche', () => {
  test('exige les deux dates avant dafficher les résultats', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/recherche');

    await expect(page.locator('h1.search-page__dates-title')).toBeVisible();
    await page.getByRole('button', { name: 'Voir les disponibilités' }).click();
    await expect(page.locator('p.search-page__dates-error')).toHaveText(
      'Veuillez renseigner les deux dates.',
    );

    await page.fill('#sp-arrivee', '2026-11-01');
    await page.fill('#sp-depart', '2026-11-05');
    await page.getByRole('button', { name: 'Voir les disponibilités' }).click();

    await expect(page.locator('h1.search-page__title')).toContainText('Résultats');
    await expect(page.locator('.stay-card')).toHaveCount(3);
  });

  test('filtre les biens par ville', async ({ page }) => {
    await mockApi(page);

    await page.goto(`/ci/recherche?${DATES}`);

    await expect(page.locator('.stay-card')).toHaveCount(3);
    await expect(page.locator('.search-page__count')).toContainText('3 biens');

    await page.selectOption('#sp-ville', 'Abidjan');
    await expect(page.locator('.stay-card')).toHaveCount(2);
    await expect(page.locator('.search-page__count')).toContainText('2 biens');

    await page.selectOption('#sp-ville', 'Bouaké');
    await expect(page.locator('.stay-card')).toHaveCount(1);
    await expect(page.locator('.stay-card__title')).toHaveText('Chambre Bouaké Centre');
  });

  test('affiche Aucun résultat quand la requête ne matche rien', async ({ page }) => {
    await mockApi(page);

    await page.goto(`/ci/recherche?q=zzzz&${DATES}`);

    await expect(page.locator('.search-page__empty-title')).toHaveText(
      'Aucune disponibilité pour ces dates',
    );
    await expect(page.locator('.stay-card')).toHaveCount(0);
  });
});
