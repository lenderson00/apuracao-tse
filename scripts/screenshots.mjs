import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const base = 'http://127.0.0.1:4321';
const out = '/opt/cursor/artifacts/screenshots';
const docs = join(process.cwd(), 'docs');
await mkdir(out, { recursive: true });
await mkdir(docs, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function clickUf(sigla) {
  const region = page.locator(`path.map-region[data-uf="${sigla}"]`);
  await region.scrollIntoViewIfNeeded();
  await region.click();
}

async function clickMunicipality() {
  await page.waitForSelector('path.map-region[data-kind="mun"]', { timeout: 30000 });
  const muns = page.locator('path.map-region[data-kind="mun"]');
  const n = await muns.count();
  await muns.nth(Math.floor(n / 2)).click({ force: true });
}

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('path.map-region', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/desktop-main.png`, fullPage: true });

await clickUf('sp');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/desktop-state.png`, fullPage: true });

await clickMunicipality();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/desktop-municipality.png`, fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('path.map-region', { timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/mobile-main.png`, fullPage: true });
await clickUf('sp');
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/mobile-state.png`, fullPage: true });

const names = [
  'desktop-main.png',
  'desktop-state.png',
  'desktop-municipality.png',
  'mobile-main.png',
  'mobile-state.png',
];
for (const name of names) {
  await copyFile(`${out}/${name}`, join(docs, name));
}

await browser.close();
console.log('Saved screenshots to', out, 'and', docs);
