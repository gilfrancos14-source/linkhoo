import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const a = await readFile('C:/Users/USER/AppData/Local/Temp/opencode/recheck-ref-1440.png');
const b = await readFile('C:/Users/USER/AppData/Local/Temp/opencode/recheck-harness-1440.png');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
const data = await page.evaluate(async ({ a, b }) => {
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
  const out = ctx.createImageData(width, height);
  for (let i = 0; i < out.data.length; i += 4) {
    const d = Math.max(
      Math.abs(da[i] - db[i]),
      Math.abs(da[i + 1] - db[i + 1]),
      Math.abs(da[i + 2] - db[i + 2]),
      Math.abs(da[i + 3] - db[i + 3]),
    );
    if (d !== 0) {
      out.data[i] = 255;
      out.data[i + 1] = 0;
      out.data[i + 2] = 0;
      out.data[i + 3] = 255;
    } else {
      out.data[i] = 255;
      out.data[i + 1] = 255;
      out.data[i + 2] = 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}, {
  a: `data:image/png;base64,${a.toString('base64')}`,
  b: `data:image/png;base64,${b.toString('base64')}`,
});
await writeFile('C:/Users/USER/AppData/Local/Temp/opencode/recheck-diff-1440.png', Buffer.from(data.split(',')[1], 'base64'));
await browser.close();
