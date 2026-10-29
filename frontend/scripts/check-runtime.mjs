import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4180';
const paths = (process.argv[3] ?? '/,/ci,/ci/recherche').split(',');

const browser = await chromium.launch();
const results = [];

for (const path of paths) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const resources = performance.getEntriesByType('resource');
    const external = resources.filter((r) => !r.name.startsWith(location.origin)).map((r) => r.name);
    const fonts = resources.filter((r) => r.name.includes('/fonts/')).map((r) => r.name.split('/').pop());
    const hero = document.querySelector('[data-purpose="hero-section"] img');
    const icons = [...document.querySelectorAll('i[class*="fa-"]')].slice(0, 6).map((el) => {
      const s = getComputedStyle(el, '::before');
      return { cls: el.className, content: s.content, family: s.fontFamily, w: el.getBoundingClientRect().width };
    });
    const h1 = document.querySelector('h1');
    return {
      fcp: Math.round(paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? 0),
      lcp: Math.round(window.__lcp),
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      load: Math.round(nav?.loadEventEnd ?? 0),
      h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
      bodyFont: getComputedStyle(document.body).fontFamily,
      heroCurrentSrc: hero ? hero.currentSrc.replace(location.origin, '') : null,
      heroComplete: hero ? hero.complete : null,
      fonts,
      external,
      icons,
      text: document.body.innerText.slice(0, 90).replace(/\s+/g, ' '),
    };
  });

  results.push({ path, ...data, errors });
  await page.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
