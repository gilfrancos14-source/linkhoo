import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const REF = 'file:///C:/Dossier%20personelle/Projet-it/ilehya_location/ilehya-react/maquette/maq4.html';
const HARNESS = 'file:///C:/Users/USER/AppData/Local/Temp/opencode/maq4-harness-fresh.html';

const browser = await chromium.launch({ headless: true });
for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1100 }]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const ref = await context.newPage();
  const harness = await context.newPage();
  await ref.goto(REF, { waitUntil: 'networkidle' });
  await harness.goto(HARNESS, { waitUntil: 'networkidle' });
  await ref.evaluate(() => document.fonts.ready);
  await harness.evaluate(() => document.fonts.ready);
  const logoHtml = await harness.evaluate(() => document.querySelector('.gerant-maq4 aside > a')?.outerHTML);
  await ref.evaluate((html) => {
    const current = document.querySelector('aside > a');
    if (current && html) current.outerHTML = html;
  }, logoHtml);
  for (const page of [ref, harness]) {
    await page.evaluate(() => Promise.all(Array.from(document.images, (img) => (
      img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
    ))));
  }
  await ref.waitForTimeout(250);
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
  await writeFile(`C:/Users/USER/AppData/Local/Temp/opencode/recheck-ref-${viewport.width}.png`, a);
  await writeFile(`C:/Users/USER/AppData/Local/Temp/opencode/recheck-harness-${viewport.width}.png`, b);
  console.log(`${viewport.width}x${viewport.height}`, JSON.stringify(result));
  await context.close();
}
await browser.close();

