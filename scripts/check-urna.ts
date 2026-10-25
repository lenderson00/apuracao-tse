/** Testa zona, índice de seções e decodificação do BU contra o TSE real. `npx tsx scripts/check-urna.ts` */
import { readFileSync } from 'node:fs';
const realFetch = globalThis.fetch;
globalThis.fetch = ((u: string, init?: RequestInit) =>
  realFetch(String(u).replace(/^\/api\/tse/, 'https://resultados.tse.jus.br'), init)) as typeof fetch;

const { fetchZoneResult } = await import('../src/lib/tse/client');
const { parseResult } = await import('../src/lib/tse/parse');
const { fetchSectionIndex, fetchSectionFiles, fetchBoletim } = await import('../src/lib/tse/urna');
const { decodeBoletim } = await import('../src/lib/tse/bu');

const z = parseResult(await fetchZoneResult(1, '1', 'ac', '01066', '0004'), { round: 1, officeId: '1', scopeLabel: 'z4' });
console.log('zona', z.scope, z.scopeCode, z.turnout.electorate, z.candidates.slice(0, 3).map((c) => `${c.number}:${c.votes}`));

const idx = await fetchSectionIndex(1, 'ac');
const secs = idx.get('01066')!.get('0004')!;
console.log('seções Porto Walter z4', secs.length, secs[0]);

const files = await fetchSectionFiles(1, 'ac', '01066', '0004', secs[0].ns);
console.log('aux', files);
const bu = await fetchBoletim(files!.bu!);
console.log(JSON.stringify(bu, null, 0).slice(0, 1500));
const pres = bu.elections.find((e) => e.electionId === 6257)!.offices[0];
console.log('soma', pres.votes.reduce((s, v) => s + v.votes, 0), 'comparecimento', pres.turnout);

const r2 = await fetchSectionFiles(2, 'ac', '01066', '0004', secs[0].ns);
console.log('2º turno aux', r2);
if (process.argv[2]) console.log(decodeBoletim(readFileSync(process.argv[2])));
