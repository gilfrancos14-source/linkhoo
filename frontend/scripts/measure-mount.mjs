import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4180';
const path = process.argv[3] ?? '/ci';
const runs = Number(process.argv[4] ?? 3);

const browser = await chromium.launch();
const out = [];

for (let i = 0; i < runs; i += 1) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto(base + path, { waitUntil: 'commit' });
  const t0 = Date.now();
  await page.waitForSelector('[data-purpose="hero-section"]', { timeout: 20000 });
  const mountMs = Date.now() - t0;
  await page.waitForTimeout(400);
  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const res = performance.getEntriesByType('resource');
    const slow = res
      .map((r) => ({ n: r.name.replace(location.origin, '').split('?')[0], end: Math.round(r.responseEnd), size: Math.round(r.transferSize / 1024) }))
      .sort((a, b) => b.end - a.end)
      .slice(0, 6);
    return {
      fcp: Math.round(paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? 0),
      lcp: Math.round(window.__lcp),
      dcl: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      load: Math.round(nav?.loadEventEnd ?? 0),
      slow,
    };
  });
  out.push({ run: i, mountMs, ...data });
  await context.close();
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
