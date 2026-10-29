import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.argv[2] ?? 'http://localhost:4173/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
const rows = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({name:r.name.replace(location.origin,''), type:r.initiatorType, start:Math.round(r.startTime), dur:Math.round(r.duration), size:Math.round((r.transferSize||0)/1024)})).sort((a,b)=>b.dur-a.dur).slice(0,20));
console.table(rows);
await browser.close();
