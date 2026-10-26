import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

test.describe('accueil du marché CI', () => {
  test("affiche l'en-tête et la section des biens les plus demandés", async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');

    await expect(page.getByRole('link', { name: /Linkhoo/ }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /plus demandés/ })).toBeVisible();
    await expect(
      page.locator('[data-purpose="popular-listings"]').getByText('Studio Cocody Riviera'),
    ).toBeVisible();
  });

  test('la section catégories affiche les catégories du marché', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');

    const categories = page.locator('[data-purpose="categories-section"]');
    await expect(categories.getByText('Chambres moins chères')).toBeVisible();
    await expect(categories.getByText('Appartements')).toBeVisible();
  });

  test('affiche les bannières configurées dans les en-têtes de section', async ({ page }) => {
    await mockApi(page, {
      banners: [
        {
          id: 'bn-popular',
          section: 'popular',
          market: 'CI',
          img: '/images/pexels-artbovich-6283961.jpg',
          alt: 'Bannière populaire',
          link: '/ci',
          order: 0,
        },
        {
          id: 'bn-promos',
          section: 'promos',
          market: 'CI',
          img: '/images/pexels-artbovich-6283961.jpg',
          alt: 'Bannière promotions',
          link: 'https://example.com/promos',
          order: 0,
        },
        {
          id: 'bn-categories',
          section: 'categories',
          market: 'CI',
          img: '/images/pexels-artbovich-6283961.jpg',
          alt: 'Bannière catégories',
          link: '/ci',
          order: 0,
        },
        {
          id: 'bn-events',
          section: 'events',
          market: 'CI',
          img: '/images/pexels-artbovich-6283961.jpg',
          alt: 'Bannière événements',
          link: '/ci',
          order: 0,
        },
      ],
    });

    await page.goto('/ci');

    for (const purpose of [
      'popular-listings',
      'promotional-offers',
      'categories-section',
      'events-section',
    ]) {
      await expect(
        page
          .locator(`[data-purpose="${purpose}"]`)
          .getByRole('region', { name: 'Bannières promotionnelles' }),
      ).toBeVisible();
    }
  });

  test('la recherche de l’accueil ouvre les résultats du marché', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');
    await page.getByLabel('Où voulez-vous aller ?').fill('Cocody');
    await page.getByLabel('Où voulez-vous aller ?').press('Enter');

    await expect(page).toHaveURL(/\/ci\/recherche\?q=Cocody$/);
  });
});
