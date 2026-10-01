import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures';

test.describe('suivi de réservation', () => {
  test('affiche le message de connexion hors session', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/suivi-reservation');

    await expect(page.locator('h1', { hasText: 'Suivi de réservation' })).toBeVisible();
    await expect(page.locator('.client-reservation__header p')).toContainText(
      'Pour des raisons de sécurité, connectez-vous pour consulter vos réservations.',
    );
    await expect(page.locator('.client-reservation__empty')).toContainText(
      "Connectez-vous à votre espace pour voir l'état de vos demandes.",
    );
  });

  test('propose de se connecter ou de parcourir les biens', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/suivi-reservation');

    const login = page.locator('.client-reservation__link', { hasText: 'Se connecter' });
    const browse = page.locator('.client-reservation__link', {
      hasText: 'Parcourir les appartements',
    });
    await expect(login).toHaveAttribute('href', '/ci/login');
    await expect(browse).toHaveAttribute('href', '/ci');

    await browse.click();
    await expect(page).toHaveURL(/\/ci$/);
    await expect(page.locator('h1.hero__tagline')).toBeVisible();
  });

  test('affiche le fil dariane menant à laccueil', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/suivi-reservation');

    const breadcrumb = page.locator('.room-detail__breadcrumb');
    await expect(breadcrumb).toContainText('Accueil');
    await expect(breadcrumb.locator('a')).toHaveAttribute('href', '/ci');
    await expect(breadcrumb).toContainText('Suivi de réservation');
  });

  test('mène de la réservation envoyée vers le suivi', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci/chambre/rm-1');
    await page.fill('#rd-name', 'Aya Koné');
    await page.fill('#rd-email', 'aya@example.ci');
    await page.fill('#rd-phone', '0707070707');
    await page.fill('#rd-date-debut', '2026-11-01');
    await page.fill('#rd-duree', '2');
    await page.getByRole('button', { name: 'Envoyer la demande' }).click();

    const track = page.locator('.room-detail__track-link');
    await expect(track).toBeVisible();
    await expect(track).toHaveText('Suivre ma réservation');
    await expect(track).toHaveAttribute('href', '/ci/suivi-reservation');

    await track.click();
    await expect(page).toHaveURL(/\/ci\/suivi-reservation$/);
    await expect(page.locator('h1', { hasText: 'Suivi de réservation' })).toBeVisible();
  });
});

test.describe('newsletter', () => {
  test('signale un champ vide avant lenvoi', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');
    await page.locator('#newsletter-form').scrollIntoViewIfNeeded();

    await page.getByRole('button', { name: "S'abonner à la newsletter" }).click();

    await expect(page.locator('#newsletter-error')).toHaveText(
      'Veuillez entrer votre adresse email.',
    );
    await expect(page.locator('.newsletter__note')).toContainText('Nouveaux biens disponibles');
  });

  test('signale une adresse invalide', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');
    await page.locator('#newsletter-form').scrollIntoViewIfNeeded();

    await page.fill('#newsletter-email', 'pas-un-email');
    await page.getByRole('button', { name: "S'abonner à la newsletter" }).click();

    await expect(page.locator('#newsletter-error')).toHaveText('Adresse email invalide.');
  });

  test('inscrit une adresse valide à la newsletter', async ({ page }) => {
    await mockApi(page);

    await page.goto('/ci');
    await page.locator('#newsletter-form').scrollIntoViewIfNeeded();

    await page.fill('#newsletter-email', 'aya@example.ci');
    await page.getByRole('button', { name: "S'abonner à la newsletter" }).click();

    await expect(page.locator('.newsletter__note')).toHaveText(
      'Merci ! Vous recevrez nos prochaines offres.',
    );
    await expect(page.locator('#newsletter-email')).toHaveValue('');
    await expect(page.locator('#newsletter-error')).toHaveCount(0);
  });
});
