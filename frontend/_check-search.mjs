import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'http://localhost:5173', serviceWorkers: 'block', locale: 'fr-FR' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
await page.goto('/ci/recherche');
await page.fill('#sp-arrivee', '2026-11-01');
await page.fill('#sp-depart', '2026-11-05');
for (let i = 0; i < 5; i++) {
  const box = await page.locator('.search-page__dates-btn').boundingBox();
  console.log('BOX', i, JSON.stringify(box));
  await page.waitForTimeout(200);
}
const anims = await page.evaluate(() => document.getAnimations().map((a) => ({ name: a.animationName || a.transitionProperty, state: a.playState, target: a.effect?.target?.className })));
console.log('ANIMS', JSON.stringify(anims));
await page.locator('.search-page__dates-btn').click({ force: true });
console.log('URL', page.url());
await page.waitForTimeout(2000);
console.log('TITLE', await page.locator('h1').innerText());
await browser.close();
console.log('DONE');
