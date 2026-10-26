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

  test('drapeau seul sur la page de marché, sélection du pays depuis l’accueil', async ({ page }) => {
    await mockApi(page);

    // Page de marché : uniquement le drapeau, pas de changement possible.
    await page.goto('/ci');
    await expect(page.locator('html')).toHaveAttribute('data-market', 'CI');
    await expect(page.locator('.market-selector--static')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choisir le marché' })).toHaveCount(0);

    // Accueil : la Côte d'Ivoire est sélectionnée par défaut.
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    const ciCard = page.locator('.acc-country-card', { hasText: "Côte d'Ivoire" });
    await expect(ciCard).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: "Pays : Côte d'Ivoire" })).toBeVisible();

    // La sélection reste locale à la landing : pas de changement de route.
    await page.locator('.acc-country-card', { hasText: 'Bénin' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.acc-country-card', { hasText: 'Bénin' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Pays : Bénin' })).toBeVisible();

    await expect(page.locator('.acc-hero')).toBeVisible();
  });
});

test.describe('nouveaux marchés', () => {
  test("ouvre laccueil du marché SN avec thème et liens préfixés", async ({ page }) => {
    await mockApi(page);

    await page.goto('/sn');

    await expect(page.locator('html')).toHaveAttribute('data-market', 'SN');
    await expect(page.locator('h1.hero__tagline')).toContainText('Trouvez le lieu idéal');
    await expect(page.locator('.logo').first()).toHaveAttribute('href', '/sn');
    await expect(page.locator('.stay-card__link').first()).toHaveAttribute(
      'href',
      /^\/sn\/chambre\//,
    );
  });

  test('la grille de la landing propose les 12 marchés du registre', async ({ page }) => {
    await mockApi(page);

    await page.goto('/');

    const cards = page.locator('.acc-country-grid > button');
    await expect(cards).toHaveCount(12);
    await expect(cards.filter({ hasText: 'Sénégal' })).toBeVisible();
    await expect(cards.filter({ hasText: 'Cap-Vert' })).toBeVisible();
  });
});
