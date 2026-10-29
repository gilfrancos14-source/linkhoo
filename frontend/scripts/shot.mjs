import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4173/', { waitUntil: 'commit' });
await page.waitForTimeout(600);
await page.screenshot({ path: 'scripts/shot-600.png', fullPage: false });
await page.waitForTimeout(800);
await page.screenshot({ path: 'scripts/shot-1400.png', fullPage: false });
console.log(await page.evaluate(() => {
  const el = document.querySelector('.acc-topbar, .landing, header, h1');
  const cs = el ? getComputedStyle(el) : null;
  return { tag: el?.tagName, cls: el?.className, display: cs?.display, visibility: cs?.visibility, opacity: cs?.opacity, color: cs?.color, font: cs?.fontFamily };
}));
await browser.close();
