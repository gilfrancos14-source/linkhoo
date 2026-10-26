import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = 'C:/Dossier personelle/Projet-it/ilehya_location/ilehya-react';
const REF = `${ROOT}/maquette/habici-verification.html`;
const HARNESS = 'C:/Users/USER/AppData/Local/Temp/opencode/verification-harness.html';

const html = readFileSync(REF, 'utf8');
const bodyStart = html.indexOf('<body');
const bodyOpenEnd = html.indexOf('>', bodyStart) + 1;
const bodyEnd = html.lastIndexOf('</body>');

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { default: Page } = await server.ssrLoadModule(
    '/src/pages/gerant/verification/VerificationStaticSection.tsx',
  );
  const markup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/ci/gerant/verification'] },
      React.createElement(Page, { gerantPath: '/ci/gerant' }),
    ),
  );
  const fresh = `${html.slice(0, bodyOpenEnd)}\n${markup}\n${html.slice(bodyEnd)}`;
  writeFileSync(HARNESS, fresh);
  console.log(HARNESS);
} finally {
  await server.close();
}

const browser = await chromium.launch({ headless: true });
for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 1100 }]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const ref = await context.newPage();
  const harness = await context.newPage();
  await ref.goto(`file:///${REF.replace(/ /g, '%20')}`, { waitUntil: 'networkidle' });
  await harness.goto(`file:///${HARNESS.replace(/ /g, '%20')}`, { waitUntil: 'networkidle' });
  await ref.evaluate(() => document.fonts.ready);
  await harness.evaluate(() => document.fonts.ready);
  await ref.waitForTimeout(300);
  await harness.waitForTimeout(300);

  const a = await ref.screenshot({ fullPage: true, animations: 'disabled' });
  const b = await harness.screenshot({ fullPage: true, animations: 'disabled' });
  const diffPage = await context.newPage();
  await diffPage.setContent('<canvas id="c"></canvas>');
  const result = await diffPage.evaluate(async ({ a, b }) => {
    const load = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const width = Math.max(ia.width, ib.width);
    const height = Math.max(ia.height, ib.height);
    const canvas = document.getElementById('c');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(ia, 0, 0);
    const da = ctx.getImageData(0, 0, width, height).data;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(ib, 0, 0);
    const db = ctx.getImageData(0, 0, width, height).data;
    let count = 0;
    let maxDelta = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(
        Math.abs(da[i] - db[i]),
        Math.abs(da[i + 1] - db[i + 1]),
        Math.abs(da[i + 2] - db[i + 2]),
        Math.abs(da[i + 3] - db[i + 3]),
      );
      if (d !== 0) {
        count += 1;
        if (d > maxDelta) maxDelta = d;
        const p = i / 4;
        const x = p % width;
        const y = Math.floor(p / width);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return {
      refSize: [ia.width, ia.height],
      harnessSize: [ib.width, ib.height],
      count,
      maxDelta,
      bbox: maxX >= 0 ? [minX, minY, maxX, maxY] : null,
    };
  }, { a: `data:image/png;base64,${a.toString('base64')}`, b: `data:image/png;base64,${b.toString('base64')}` });
  writeFileSync(`C:/Users/USER/AppData/Local/Temp/opencode/verification-ref-${viewport.width}.png`, a);
  writeFileSync(`C:/Users/USER/AppData/Local/Temp/opencode/verification-harness-${viewport.width}.png`, b);
  console.log(`${viewport.width}x${viewport.height}`, JSON.stringify(result));
  await context.close();
}
await browser.close();

