#!/usr/bin/env node
/**
 * Downloads simplified municipality GeoJSON per UF from geodata-br (IBGE codes in id).
 * Run: node scripts/download-geo.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { get } from 'node:https';

const UF_IBGE = {
  ac: 12, al: 27, am: 13, ap: 16, ba: 29, ce: 23, df: 53, es: 32, go: 52,
  ma: 21, mg: 31, ms: 50, mt: 51, pa: 15, pb: 25, pe: 26, pi: 22, pr: 41,
  rj: 33, rn: 24, ro: 11, rr: 14, rs: 43, sc: 42, se: 28, sp: 35, to: 17,
};

const outDir = new URL('../public/geo/mun/', import.meta.url);

async function download(url, dest) {
  await new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        get(res.headers.location, (res2) => {
          pipeline(res2, createWriteStream(dest)).then(resolve).catch(reject);
        }).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`${url} -> ${res.statusCode}`));
        return;
      }
      pipeline(res, createWriteStream(dest)).then(resolve).catch(reject);
    }).on('error', reject);
  });
}

await mkdir(outDir, { recursive: true });

for (const [uf, ibge] of Object.entries(UF_IBGE)) {
  const url = `https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-${ibge}-mun.json`;
  const dest = new URL(`${uf}.json`, outDir);
  try {
    await download(url, dest);
    process.stdout.write(`ok ${uf}\n`);
  } catch (e) {
    process.stderr.write(`fail ${uf}: ${e.message}\n`);
  }
}
