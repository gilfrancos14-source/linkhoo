import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4180';
const path = process.argv[3] ?? '/ci';

const browser = await chromium.launch();

async function run(mode) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.route('**/api/**', async (route) => {
    if (mode === 'abort') return route.abort();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const res = performance.getEntriesByType('resource');
    const js = res.filter((r) => r.name.endsWith('.js')).reduce((a, r) => a + (r.transferSize || 0), 0);
    return {
      fcp: Math.round(paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? 0),
      lcp: Math.round(window.__lcp),
      dcl: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      load: Math.round(nav?.loadEventEnd ?? 0),
      jsKB: Math.round(js / 1024),
      text: document.body.innerText.slice(0, 60).replace(/\s+/g, ' '),
    };
  });
  await page.close();
  return { mode, path, ...data };
}

const out = [];
for (const mode of ['mock', 'abort']) out.push(await run(mode));
console.log(JSON.stringify(out, null, 2));
await browser.close();
