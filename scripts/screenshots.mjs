/**
 * Gera as capturas do README em ./docs.
 * Uso: com o dev server rodando (npm run dev, porta 4321), `node scripts/screenshots.mjs`.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const docs = join(process.cwd(), 'docs');
await mkdir(docs, { recursive: true });

const browser = await chromium.launch();

async function ready(page) {
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForSelector('path.map-region[data-uf]', { timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function focusState(page, uf, { touch = false } = {}) {
  const region = page.locator(`path.map-region[data-uf="${uf}"]`);
  if (touch) {
    const box = await region.boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.45);
  } else {
    await region.click({ force: true });
  }
  await page.waitForSelector('path.map-region[data-kind="mun"]', { timeout: 30000 });
  await page.waitForTimeout(5000);
}

async function focusMunicipality(page, ibge, { touch = false } = {}) {
  const region = page.locator(`path.map-region[data-kind="mun"][data-id="${ibge}"]`);
  if (touch) {
    const box = await region.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await region.click({ force: true });
  }
  await page.waitForTimeout(2500);
}

// Desktop 1440x900: Brasil, zoom em SP, zoom em Campinas (IBGE 3509502)
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await ready(page);
  await page.mouse.move(10, 450);
  await page.screenshot({ path: join(docs, 'desktop-main.png') });
  await focusState(page, 'sp');
  await page.mouse.move(10, 450);
  await page.screenshot({ path: join(docs, 'desktop-state.png') });
  await focusMunicipality(page, '3509502');
  await page.mouse.move(10, 450);
  await page.screenshot({ path: join(docs, 'desktop-municipality.png') });
  await page.close();
}

// Mobile 390x844
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await ready(page);
  await page.screenshot({ path: join(docs, 'mobile-main.png') });
  await focusState(page, 'sp', { touch: true });
  await page.screenshot({ path: join(docs, 'mobile-state.png') });
  await ctx.close();
}

await browser.close();
console.log('Capturas salvas em', docs);
