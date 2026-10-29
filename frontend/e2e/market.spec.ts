import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockApi } from './fixtures';

/** Cartes de la section « Nos biens les plus demandés » (accueil maquette). */
function popularCards(page: Page) {
  return page.locator('[data-purpose="popular-listings"] article[role="link"]');
}

test.describe('marché Bénin', () => {
  test('affiche laccueil du marché BJ', async ({ page }) => {
    await mockApi(page);

    await page.goto('/bj');

    await expect(page.locator('html')).toHaveAttribute('data-market', 'BJ');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Trouvez le lieu idéal',
    );
    const categories = page.locator('[data-purpose="categories-section"]');
    await expect(categories).toContainText('Appartements moins chers');
    await expect(categories).toContainText('Hôtels');
  });

  test('préfixe les liens de la page par /bj', async ({ page }) => {
    await mockApi(page);

    await page.goto('/bj');

    await expect(page.locator('.acc-brand')).toHaveAttribute('href', '/bj');

    const firstCard = popularCards(page).first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page).toHaveURL(/\/bj\/chambre\//);
  });

  test('drapeau seul sur la page de marché, sélection du pays depuis l’accueil', async ({ page }) => {
    await mockApi(page);

    // Page de marché : uniquement le drapeau, pas de changement possible.
    await page.goto('/ci');
    await expect(page.locator('html')).toHaveAttribute('data-market', 'CI');
    await expect(page.getByRole('button', { name: "Pays : Côte d'Ivoire" })).toBeVisible();
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
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Trouvez le lieu idéal',
    );
    await expect(page.locator('.acc-brand')).toHaveAttribute('href', '/sn');

    const firstCard = popularCards(page).first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page).toHaveURL(/\/sn\/chambre\//);
  });

  test('la grille de la landing propose les 12 marchés du registre', async ({ page }) => {
    await mockApi(page);

    await page.goto('/');

    const cards = page.locator('.acc-country-grid > button');
    await expect(cards).toHaveCount(12);
    await expect(cards.filter({ hasText: 'Sénégal' })).toBeVisible();
    await expect(cards.filter({ hasText: 'RDC' })).toBeVisible();
  });
});
