import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

test.describe('fiche chambre', () => {
  test('affiche la chambre demandée', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-2');

    await expect(page.locator('h1.room-detail__title')).toHaveText('Appartement Plateau Vue Mer');
    await expect(page.getByText('45 000', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Demande de réservation' })).toBeVisible();
  });

  test('signale les champs obligatoires à la soumission vide', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-1');

    await page.getByRole('button', { name: 'Envoyer la demande' }).click();

    await expect(page.locator('#rd-name-error')).toHaveText('Veuillez renseigner votre nom.');
    await expect(page.locator('#rd-email-error')).toHaveText('Veuillez renseigner votre email.');
    await expect(page.locator('#rd-phone-error')).toHaveText('Veuillez renseigner votre téléphone.');
    await expect(page.locator('#rd-date-debut-error')).toHaveText('Veuillez choisir une date de début.');
    await expect(page.locator('.room-detail__success')).toHaveCount(0);
  });

  test('envoie une demande de réservation valide', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-1');

    await page.fill('#rd-name', 'Aya Koné');
    await page.fill('#rd-email', 'aya@example.ci');
    await page.fill('#rd-phone', '0707070707');
    await page.fill('#rd-date-debut', '2026-11-01');
    await page.fill('#rd-duree', '2');

    await expect(page.locator('#rd-date-fin')).toHaveValue('2026-11-03');

    await page.getByRole('button', { name: 'Envoyer la demande' }).click();

    await expect(page.locator('.room-detail__success')).toBeVisible();
    await expect(page.locator('.room-detail__success')).toContainText('Votre demande a bien été envoyée !');
    await expect(page.locator('.room-detail__track-link')).toBeVisible();
  });

  test('renvoie linvisible quand linidentifiant nexiste pas', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-999');

    await expect(page.getByText('Chambre introuvable.')).toBeVisible();
  });
});
