import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const t0 = Date.now();
await page.goto('http://localhost:4173/', { waitUntil: 'commit' });
for (const wait of [0, 100, 200, 300, 500, 800, 1200, 1600, 2000]) {
  const elapsed = Date.now() - t0;
  if (wait > 0) await page.waitForTimeout(wait - (Date.now() - t0 - 0));
  const s = await page.evaluate(() => ({
    root: document.getElementById('root')?.innerHTML.length ?? -1,
    text: document.body.innerText.replace(/\s+/g,' ').slice(0,50),
    fonts: document.fonts.status,
    fcp: performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint')?.startTime ?? null,
  }));
  console.log(elapsed, JSON.stringify(s));
}
await browser.close();
