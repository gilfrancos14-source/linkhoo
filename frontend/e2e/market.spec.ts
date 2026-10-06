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

  test('drapeau seul sur la page de marché, choix du marché depuis l’accueil', async ({ page }) => {
    await mockApi(page);

    // Page de marché : uniquement le drapeau, pas de changement possible.
    await page.goto('/ci');
    await expect(page.locator('html')).toHaveAttribute('data-market', 'CI');
    await expect(page.locator('.market-selector--static')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choisir le marché' })).toHaveCount(0);

    // Accueil : aucun marché de sélectionné par défaut, le sélecteur
    // permet de basculer vers le Bénin.
    await page.goto('/');
    await expect(page.locator('.market-selector__flag--none')).toBeVisible();
    await page.getByRole('button', { name: 'Choisir le marché' }).click();
    const listbox = page.getByRole('listbox', { name: 'Choisir le marché' });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option', { name: "Côte d'Ivoire" })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    await listbox.getByRole('option', { name: 'Bénin' }).click();

    await expect(page).toHaveURL(/\/bj$/);
    await expect(page.locator('html')).toHaveAttribute('data-market', 'BJ');
    await expect(page.locator('.market-selector--static')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choisir le marché' })).toHaveCount(0);

    // Le retour du navigateur doit revenir sur l'accueil, pas sur une
    // page visitée avant.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.landing-hero')).toBeVisible();
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

  test('le sélecteur de la landing propose les 12 marchés du registre', async ({ page }) => {
    await mockApi(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Choisir le marché' }).click();

    const listbox = page.getByRole('listbox', { name: 'Choisir le marché' });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option')).toHaveCount(12);
    await expect(listbox.getByRole('option', { name: 'Sénégal' })).toBeVisible();
    await expect(listbox.getByRole('option', { name: 'RDC' })).toBeVisible();
  });
});
