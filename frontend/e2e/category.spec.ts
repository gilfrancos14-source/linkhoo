import { expect, test } from '@playwright/test';
import { makeRoom, mockApi } from './fixtures';

test.describe('page catégorie', () => {
  test('affiche le titre de la catégorie et son nombre de résultats', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/categorie/ci-appartements');

    await expect(page.locator('h1.cat-page__title')).toHaveText('Appartements');
    await expect(page.locator('.cat-page__count')).toHaveText('1 résultat');
    await expect(page.locator('.cat-page__grid .stay-card')).toHaveCount(1);
    await expect(page.locator('.cat-page__breadcrumb')).toContainText('Appartements');
  });

  test('compte les biens de la catégorie avant filtrage', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/categorie/ci-chambres-moins-cheres');

    await expect(page.locator('.cat-page__count')).toHaveText('2 résultats');
    await expect(page.locator('.cat-page__grid .stay-card')).toHaveCount(2);
  });

  test('filtre les biens par ville puis réinitialise', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/categorie/ci-chambres-moins-cheres');
    await expect(page.locator('.cat-page__count')).toHaveText('2 résultats');

    await page.selectOption('#filter-ville', 'Abidjan');
    await expect(page.locator('.cat-page__count')).toHaveText('1 résultat');
    await expect(page.locator('.stay-card__title')).toHaveText('Studio Cocody Riviera');

    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(page.locator('.cat-page__count')).toHaveText('2 résultats');
    await expect(page.locator('#filter-ville')).toHaveValue('');
  });

  test('affiche letat vide quand les filtres ne matchent rien', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/categorie/ci-appartements');
    await page.selectOption('#filter-quartier', 'Cocody');

    await expect(page.locator('.cat-page__empty-state')).toContainText(
      'Aucun résultat ne correspond à vos filtres.',
    );
    await expect(page.locator('.cat-page__grid .stay-card')).toHaveCount(0);

    await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
    await expect(page.locator('.cat-page__grid .stay-card')).toHaveCount(1);
    await expect(page.locator('#filter-quartier')).toHaveValue('');
  });

  test('affiche le repli quand la catégorie nexiste pas', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/categorie/categorie-inconnue');

    await expect(page.locator('p.cat-page__empty')).toHaveText('Catégorie introuvable.');
    await expect(page.locator('.cat-page__back')).toHaveText("← Retour à l'accueil");

    await page.locator('.cat-page__back').click();
    await expect(page).toHaveURL(/\/ci$/);
    await expect(page.locator('h1.hero__tagline')).toBeVisible();
  });

  test('pagine les biens au-delà de six résultats', async ({ page }) => {
    const manyRooms = Array.from({ length: 8 }, (_, i) =>
      makeRoom({
        id: `rm-${i + 1}`,
        title: `Chambre ${i + 1}`,
        category: 'ci-chambres-moins-cheres',
        ville: 'Abidjan',
        quartier: 'Cocody',
      }),
    );
    await mockApi(page, { rooms: manyRooms });

    await page.goto('/ci/categorie/ci-chambres-moins-cheres');

    await expect(page.locator('.cat-page__count')).toHaveText('8 résultats');
    await expect(page.locator('.cat-page__grid .stay-card')).toHaveCount(6);

    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    await expect(pagination).toBeVisible();
    await pagination.getByRole('button', { name: 'Suiv →' }).click();

    await expect(page.locator('.cat-page__grid .stay-card')).toHaveCount(2);
    await expect(page.locator('.cat-page__grid .stay-card__title')).toHaveText([
      'Chambre 7',
      'Chambre 8',
    ]);
  });
});
