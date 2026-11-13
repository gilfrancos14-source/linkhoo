import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures';

/**
 * Parcours de réservation avec une session client simulée.
 *
 * La fiche chambre n'ouvre la réservation qu'aux clients connectés : les
 * scénarios de soumission vivent donc ici, avec la doublure Clerk
 * (`vite.auth.config.ts`) et les API interceptées. La suite publique
 * (`e2e/room-detail.spec.ts`) ne vérifie que l'invitation à se connecter.
 */
async function signIn(page: Page, role: 'client' | 'gerant'): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('e2e:auth', JSON.stringify({ signedIn: true, role: value }));
  }, role);
}

test.describe('réservation — client connecté', () => {
  test('signale une date de début manquante', async ({ page }) => {
    await signIn(page, 'client');
    await mockApi(page, { role: 'client' });

    await page.goto('/ci/chambre/rm-1');
    await page.getByRole('button', { name: 'Réserver maintenant' }).click();

    // Nom et email sont pré-remplis depuis le compte : seule la date manque.
    await expect(page.getByRole('alert').filter({ hasText: 'date de début' })).toHaveText(
      'Veuillez choisir une date de début.',
    );
    await expect(page.getByRole('heading', { name: 'Demande envoyée !' })).toHaveCount(0);
  });

  test('réserve puis mène au suivi de la demande', async ({ page }) => {
    await signIn(page, 'client');
    await mockApi(page, { role: 'client' });

    await page.goto('/ci/chambre/rm-1');

    // Les coordonnées sont pré-remplies depuis le compte client.
    await page.getByText('Vos coordonnées').click();
    await expect(page.locator('#room-name')).toHaveValue('Client Test');
    await expect(page.locator('#room-email')).toHaveValue('client@e2e.test');

    await page.fill('#room-start', '2026-11-01');
    await page.fill('#room-duration', '2');

    // Date de fin calculée et affichée au format français.
    await expect(page.locator('#room-end')).toHaveValue('03/11/2026');

    await page.getByRole('button', { name: 'Réserver maintenant' }).click();

    await expect(page.getByRole('heading', { name: 'Demande envoyée !' })).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Votre demande a bien été transmise' }),
    ).toBeVisible();

    const track = page.getByRole('link', { name: 'Suivre ma réservation' });
    await expect(track).toHaveAttribute('href', '/ci/suivi-reservation');

    // Connecté, le suivi redirige vers l'espace client (le suivi public est
    // réservé aux visiteurs sans session).
    await track.click();
    await expect(page).toHaveURL(/\/ci\/compte$/);
    await expect(page.getByRole('link', { name: 'Mes séjours' })).toBeVisible();
  });
});
