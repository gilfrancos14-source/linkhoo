import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

test.describe('fiche chambre', () => {
  test('affiche la chambre demandée', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-2');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Appartement Plateau Vue Mer',
    );
    await expect(page.getByText('45 000', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Réservation' })).toBeVisible();
  });

  test('invite à se connecter pour réserver', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-1');

    // Sans session, la réservation n'est pas ouverte : la fiche propose la
    // connexion (le parcours de réservation est couvert par `e2e/auth`).
    const cta = page.getByRole('button', { name: 'Connectez-vous pour réserver' });
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page).toHaveURL(/\/ci\/login$/);
  });

  test('renvoie linvisible quand linidentifiant nexiste pas', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-999');

    await expect(page.getByText('Chambre introuvable', { exact: true })).toBeVisible();
  });
});
