import { expect, test } from '@playwright/test';
import { makeBoostFeatured, mockApi } from './fixtures';

const twoBoosts = [
  makeBoostFeatured({ id: 'boost-e2e-1', room_id: 'rm-1' }),
  makeBoostFeatured({
    id: 'boost-e2e-2',
    room_id: 'rm-2',
    title: 'Appartement Plateau Vue Mer',
    quartier: 'Plateau',
    price: '45 000',
    price_num: 45000,
    mode: 'cpi',
  }),
];

test.describe('annonces sponsorisées de la landing', () => {
  test('affiche la section entre les pays et le carrousel', async ({ page }) => {
    await mockApi(page, { boosts: twoBoosts });

    await page.goto('/');

    const section = page.locator('section.landing-boosts');
    await expect(section).toBeVisible();
    await expect(section.locator('h2')).toContainText('en vedette');
    await expect(section.locator('.landing-boosts__item')).toHaveCount(2);

    const orderOk = await page.evaluate(() => {
      const countries = document.querySelector('.landing-countries');
      const boosts = document.querySelector('.landing-boosts');
      const slider = document.querySelector('[class*="landing-slider"]');
      if (!countries || !boosts || !slider) return false;
      const countriesFirst = Boolean(
        countries.compareDocumentPosition(boosts) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      const boostsFirst = Boolean(
        boosts.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      return countriesFirst && boostsFirst;
    });
    expect(orderOk).toBe(true);
  });

  test('badge Sponsorisé et liens vers les chambres', async ({ page }) => {
    await mockApi(page, { boosts: twoBoosts });

    await page.goto('/');

    const section = page.locator('section.landing-boosts');
    await expect(section.locator('.stay-card__badge')).toHaveText([
      'Sponsorisé',
      'Sponsorisé',
    ]);
    await expect(section.locator('.landing-boosts__item a').first()).toHaveAttribute(
      'href',
      '/ci/chambre/rm-1',
    );
    await expect(section.getByRole('heading', { name: 'Appartement Plateau Vue Mer' })).toBeVisible();
  });

  test("masque la section quand aucune campagne n'est servie", async ({ page }) => {
    await mockApi(page);

    await page.goto('/');

    // Chargement puis réponse vide : la section disparaît du DOM.
    await expect(page.locator('section.landing-boosts')).toHaveCount(0);
  });

  test('signale une impression quand les cartes deviennent visibles', async ({ page }) => {
    const impressions: { boostId: string; visitorId: string }[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/boosts/impression')) {
        const body = request.postDataJSON() as { boost_id?: string; visitor_id?: string };
        impressions.push({ boostId: body.boost_id ?? '', visitorId: body.visitor_id ?? '' });
      }
    });
    await mockApi(page, { boosts: twoBoosts });

    await page.goto('/');
    const section = page.locator('section.landing-boosts');
    await section.scrollIntoViewIfNeeded();

    await expect.poll(() => impressions.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(impressions[0].boostId).toBeTruthy();
    expect(impressions[0].visitorId).toBeTruthy();
  });

  test('signale le clic sur une carte vers le serveur', async ({ page }) => {
    await mockApi(page, { boosts: twoBoosts });
    const clickRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' && request.url().includes('/api/boosts/click'),
    );

    await page.goto('/');
    const section = page.locator('section.landing-boosts');
    await section.locator('.landing-boosts__item').first().click();

    const request = await clickRequest;
    const body = request.postDataJSON() as { boost_id?: string; visitor_id?: string };
    expect(body.boost_id).toBe('boost-e2e-1');
    expect(body.visitor_id).toBeTruthy();
  });
});
