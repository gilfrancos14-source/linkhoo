import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**/*clerk*/**', (route) => route.abort());
await page.addInitScript(() => {
  window.__lcp = 0;
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
});
await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForTimeout(800);
const m = await page.evaluate(() => {
  const p = performance.getEntriesByType('paint');
  return { fcp: p.find(x=>x.name==='first-contentful-paint')?.startTime, lcp: window.__lcp, text: document.body.innerText.slice(0,80) };
});
console.log(m);
await browser.close();
