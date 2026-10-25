/**
 * Confere o parser com arquivos reais do TSE (1º turno, já totalizado).
 * Uso: npm run test:parse
 */
import assert from 'node:assert/strict';
import { parseResult, resolveMapLeader } from '../src/lib/tse/parse';
import type { OfficeId, Round, TseResultFile } from '../src/lib/tse/types';

const BASE = 'https://resultados.tse.jus.br/oficial/ele2026';

async function load(path: string, officeId: OfficeId, round: Round = 1) {
  const res = await fetch(`${BASE}/${path}`, { headers: { Accept: 'application/json' } });
  assert.equal(res.ok, true, `${path}: HTTP ${res.status}`);
  const raw = (await res.json()) as TseResultFile;
  return parseResult(raw, { round, officeId, scopeLabel: path });
}

const close = (actual: number, expected: number, label: string) => {
  assert.ok(Number.isFinite(actual), `${label}: ${actual} não é número`);
  assert.ok(Math.abs(actual - expected) < 0.01, `${label}: esperado ${expected}, veio ${actual}`);
  console.log(`  ok  ${label}: ${actual.toFixed(2)}%`);
};

console.log('Presidente 1T, Brasil');
const br = await load('6257/dados/br/br-c0001-e006257-u.json', '1');
const flavio = br.candidates.find((c) => c.shortName.includes('FLAVIO'));
const lula = br.candidates.find((c) => c.shortName.includes('LULA'));
assert.ok(flavio && lula, 'Flávio e Lula no arquivo');
close(flavio.percent, 47.03, 'Flávio');
close(lula.percent, 45.16, 'Lula');
close(br.turnout.sectionsPct, 100, 'Urnas apuradas');
close(br.turnout.abstentionPct, 21.08, 'Abstenção');
close(br.turnout.turnoutPct, 78.92, 'Comparecimento');
close(br.turnout.blankPct, 1.84, 'Brancos');
close(br.turnout.nullPct, 2.93, 'Nulos');
assert.equal(br.turnout.nullVotes, 3674249);
assert.equal(resolveMapLeader(br.candidates).leader?.shortName, flavio.shortName);

console.log('Presidente 1T, RJ');
const rj = await load('6257/dados/rj/rj-c0001-e006257-u.json', '1');
close(rj.turnout.nullPct, 2.92, 'Nulos');
close(rj.turnout.blankPct, 2.05, 'Brancos');

console.log('Presidente 1T, Angra dos Reis');
const angra = await load('6257/dados/rj/rj58017-c0001-e006257-u.json', '1');
close(angra.turnout.nullPct, 2.3, 'Nulos');

console.log('Governador 1T, RJ');
const gov = await load('6259/dados/rj/rj-c0003-e006259-u.json', '3');
close(gov.turnout.nullPct, 9.65, 'Nulos');
close(gov.turnout.blankPct, 5.09, 'Brancos');
close(gov.turnout.sectionsPct, 100, 'Urnas apuradas');
for (const c of gov.candidates) assert.ok(Number.isFinite(c.percent), `${c.shortName} sem NaN`);

console.log('Presidente 2T, Brasil (arquivo zerado antes das 17h, ou já com votos)');
const br2 = await load('6258/dados/br/br-c0001-e006258-u.json', '1', 2);
for (const c of br2.candidates) assert.ok(Number.isFinite(c.percent), `${c.shortName} sem NaN`);
const total2 = br2.candidates.reduce((s, c) => s + c.votes, 0);
if (total2 === 0) {
  assert.equal(resolveMapLeader(br2.candidates).leader, undefined, 'sem votos: sem líder');
  assert.equal(br2.turnout.turnoutPct, 0, 'sem votos: comparecimento 0%');
  console.log('  ok  sem votos: líder nulo, comparecimento 0,00%');
} else {
  console.log(`  ok  com votos: ${br2.turnout.sectionsPct.toFixed(2)}% das urnas`);
}

console.log('Empate e zero (sintético)');
const mk = (votes: number) => ({ sqcand: String(votes), name: '', shortName: '', party: '', number: '', votes, percent: 0, status: '', color: '' });
assert.equal(resolveMapLeader([mk(0), mk(0)]).reason, 'sem-votos');
assert.equal(resolveMapLeader([mk(10), mk(10)]).reason, 'empate');
assert.equal(resolveMapLeader([mk(9), mk(10)]).leader?.votes, 10);
console.log('  ok');
console.log('\nTudo certo.');
