import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:4321';
const out = '/opt/cursor/artifacts/screenshots';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function clickUf(sigla) {
  await page.evaluate((uf) => {
    const paths = [...document.querySelectorAll('path.map-region')];
    const features = paths;
    // Match by firing click on path - we stored sigla in feature properties only in d3 data, not DOM
    // Use bbox: find path whose centroid label matches - instead click via script reading last rendered titles
    return null;
  }, sigla);
  const box = await page.locator('svg').boundingBox();
  if (!box) return;
  const coords = {
    sp: { x: box.x + box.width * 0.55, y: box.y + box.height * 0.72 },
    mg: { x: box.x + box.width * 0.62, y: box.y + box.height * 0.58 },
  };
  const c = coords[sigla] ?? coords.sp;
  await page.mouse.click(c.x, c.y);
}

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('path.map-region', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/desktop-main.png`, fullPage: true });

await clickUf('sp');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/desktop-state.png`, fullPage: true });

await page.mouse.click(640, 360);
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/desktop-municipality.png`, fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/mobile-main.png`, fullPage: true });
await clickUf('sp');
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/mobile-state.png`, fullPage: true });

await browser.close();
console.log('Saved screenshots to', out);
