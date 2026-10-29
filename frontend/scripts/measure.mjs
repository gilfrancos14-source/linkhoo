import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.addInitScript(() => {
  window.__lcp = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__lcp = entry.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
});

const started = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const metrics = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  const resources = performance.getEntriesByType('resource');
  const byType = {};
  let total = 0;
  for (const r of resources) {
    const ext = (r.name.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? 'other').toLowerCase();
    byType[ext] = (byType[ext] ?? 0) + (r.transferSize || 0);
    total += r.transferSize || 0;
  }
  return {
    domContentLoaded: nav?.domContentLoadedEventEnd,
    load: nav?.loadEventEnd,
    fcp: paint.find((p) => p.name === 'first-contentful-paint')?.startTime,
    lcp: window.__lcp,
    totalTransferKB: Math.round(total / 1024),
    byTypeKB: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)]),
    ),
    title: document.title,
    text: document.body.innerText.slice(0, 120),
  };
});

console.log(JSON.stringify({ url, wallMs: Date.now() - started, ...metrics, consoleErrors }, null, 2));
await browser.close();
