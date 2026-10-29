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

  test('signale les champs obligatoires à la soumission vide', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-1');

    await page.getByRole('button', { name: 'Réserver maintenant' }).click();

    // Les coordonnées sont dans un <details> refermé : la soumission l'ouvre.
    const nameField = page.locator('#room-name');
    await expect(nameField).toBeVisible();
    await expect(nameField.locator('..').getByRole('alert')).toHaveText(
      'Veuillez renseigner votre nom.',
    );
    await expect(page.locator('#room-email').locator('..').getByRole('alert')).toHaveText(
      'Veuillez renseigner votre email.',
    );
    await expect(page.getByRole('alert').filter({ hasText: 'date de début' })).toHaveText(
      'Veuillez choisir une date de début.',
    );
    // Le téléphone est explicitement facultatif.
    await expect(page.getByText('(optionnel)')).toBeVisible();
    await expect(page.locator('#room-phone').locator('..').getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Demande envoyée !' })).toHaveCount(0);
  });

  test('envoie une demande de réservation valide', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-1');

    await page.getByText('Vos coordonnées').click();
    await page.fill('#room-name', 'Aya Koné');
    await page.fill('#room-email', 'aya@example.ci');
    await page.fill('#room-phone', '0707070707');
    await page.fill('#room-start', '2026-11-01');
    await page.fill('#room-duration', '2');

    // Date de fin calculée et affichée au format français.
    await expect(page.locator('#room-end')).toHaveValue('03/11/2026');

    await page.getByRole('button', { name: 'Réserver maintenant' }).click();

    await expect(page.getByRole('heading', { name: 'Demande envoyée !' })).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Votre demande a bien été transmise' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Suivre ma réservation' })).toBeVisible();
  });

  test('renvoie linvisible quand linidentifiant nexiste pas', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-999');

    await expect(page.getByText('Chambre introuvable', { exact: true })).toBeVisible();
  });
});
