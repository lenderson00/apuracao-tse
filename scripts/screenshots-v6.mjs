import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const output = '/workspace/apuracao-shots/v6';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
for (const mobile of process.env.SHOT_MODE === 'mobile' ? [true] : [false, true]) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  const errors = [];
  const pendingZones = new Set();
  let zonePeak = 0,
    zoneRequests = 0,
    indexRequests = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/-z\d+-c\d+/.test(r.url())) {
      zoneRequests++;
      pendingZones.add(r);
      zonePeak = Math.max(zonePeak, pendingZones.size);
    }
    if (r.url().endsWith('-cs.json')) indexRequests++;
  });
  // Mede requisições aguardando resposta. requestfinished pode ser entregue depois
  // de o navegador consumir o JSON e iniciar o próximo item da fila.
  page.on('response', (response) => pendingZones.delete(response.request()));
  page.on('requestfailed', (request) => pendingZones.delete(request));
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:4321');
  await page.getByRole('tab', { name: '1º turno', exact: true }).click();
  await page.waitForTimeout(6000);
  const shot = async (name) => {
    await page.screenshot({
      path: `${output}/${mobile ? 'mobile' : 'desktop'}-${name}.png`,
    });
  };
  const search = async (term) => {
    if (mobile) await page.getByRole('button', { name: 'Buscar município', exact: true }).click();
    const input = page.getByRole('combobox');
    await input.fill(term);
    await page.waitForTimeout(600);
  };
  await search('Lula');
  await shot('busca-candidato');
  await page.getByRole('option').filter({ hasText: 'Lula' }).first().getByRole('button').click();
  if (mobile) await page.getByRole('button', { name: 'Expandir painel' }).click();
  await page.getByRole('tab', { name: 'Lula 13', exact: true }).click();
  await page.waitForTimeout(1000);
  await shot('candidato-pais');
  if (mobile) await page.getByRole('button', { name: 'Recolher painel' }).click();
  await search('São Paulo');
  await page.getByRole('option').filter({ hasText: 'São Paulo' }).first().getByRole('button').click();
  await page.waitForTimeout(12000);
  // O breadcrumb da UF volta ao mapa municipal sem município fixado.
  const stateCrumb = page.getByRole('button', { name: mobile ? 'SP' : 'São Paulo', exact: true }).first();
  await stateCrumb.click().catch(async (error) => {
    console.error('Navegação:', await page.title(), (await page.locator('body').innerText()).slice(-2200));
    await page.screenshot({ path: `${output}/debug-navegacao-${mobile ? 'mobile' : 'desktop'}.png` });
    throw error;
  });
  await page.waitForTimeout(4000);
  if (mobile) await page.getByRole('button', { name: 'Expandir painel' }).click();
  await page.getByRole('tab', { name: 'Lula 13', exact: true }).click();
  await shot('candidato-uf');
  if (mobile) await page.getByRole('button', { name: 'Recolher painel' }).click();
  await search('São Paulo');
  await page.getByRole('option').filter({ hasText: 'São Paulo' }).first().getByRole('button').click();
  await page.waitForTimeout(2500);
  if (mobile) await page.getByRole('button', { name: 'Expandir painel' }).click();
  assert.equal(zoneRequests, 0, 'Zonas devem carregar sob demanda');
  assert.equal(indexRequests, 0, 'Índice deve carregar sob demanda');
  await page.getByRole('tab', { name: 'Zonas', exact: true }).click();
  await page.waitForTimeout(7000);
  await shot('zonas');
  await page
    .getByRole('button')
    .filter({ hasText: /Zona 0001/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Seções', exact: true }).click();
  await page.waitForTimeout(5000);
  await page
    .getByRole('button', { name: /^Seção / })
    .first()
    .click();
  await page.waitForTimeout(5000);
  const original = page.getByRole('link', { name: 'Arquivo original no TSE' });
  await original.waitFor({ state: 'attached' }).catch(async (e) => {
    await page.screenshot({ path: `${output}/debug-${mobile ? 'mobile' : 'desktop'}.png` });
    console.error((await page.locator('body').innerText()).slice(-2500));
    throw e;
  });
  assert.match(await original.getAttribute('href'), /^https:\/\/resultados\.tse\.jus\.br\/oficial\//);
  const linkBox = await original.boundingBox();
  assert.ok(linkBox && linkBox.y >= 0 && linkBox.y + linkBox.height <= (mobile ? 844 : 900), 'Link original visível');
  assert.equal(await page.getByRole('button', { name: 'Seção 0001', exact: true }).getAttribute('aria-pressed'), 'true');
  await shot('boletim');
  if (!mobile) await shot('secoes');
  await page.getByRole('button', { name: 'Próxima seção', exact: true }).click();
  await page.getByRole('heading', { name: 'Boletim · Seção 0002', exact: true }).waitFor();
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('heading', { name: 'Boletim · Seção 0001', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Zona 0001', exact: true }).click();
  await page.getByRole('button', { name: 'Seções', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Zonas', exact: true }).click();
  await page.getByRole('button', { name: 'Zona 0002', exact: true }).waitFor();
  assert.ok(zonePeak <= 6, `Concorrência de zonas: ${zonePeak}`);
  assert.equal(indexRequests, 1);
  assert.deepEqual(errors, []);
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth),
    'Página deve caber no viewport',
  );
  console.log(`${mobile ? 'Mobile' : 'Desktop'}: fluxo completo validado, pico de ${zonePeak} zonas simultâneas.`);
  await page.close();
}
await browser.close();
