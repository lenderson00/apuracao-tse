// Teste de carga leve: simula N abas seguindo o mesmo protocolo do usePresence.
// Uso: node teste-carga.mjs [abas=400] [minutos=4] [pulsoSeg=90]
const W = process.env.W ?? 'https://apuracao-presenca.plugandship.workers.dev';
const ORIGEM = 'https://apuracao.lenderson.com.br';
const N = Number(process.argv[2] ?? 400);
const MIN = Number(process.argv[3] ?? 4);
const PULSO = Number(process.argv[4] ?? 90) * 1000;
const fim = Date.now() + MIN * 60_000;
let pulsos = 0, leituras = 0, erros = 0;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
let p = 1;

async function ler() {
  leituras++;
  const r = await fetch(W + '/agora', { signal: AbortSignal.timeout(10000) });
  const [, linha] = (await r.text()).trim().split('\n');
  const c = linha.split(','); const [n, exato, pp, t, on] = c.map(Number); const inst = c[5];
  p = pp;
  return { n, exato, p: pp, on, inst };
}

async function aba(i) {
  const id = 'sim' + i.toString(36) + Math.random().toString(36).slice(2, 10);
  const u = Math.random();
  await dorme(Math.random() * 30_000);
  while (Date.now() < fim) {
    if (u < p) {
      try {
        pulsos++;
        const r = await fetch(W + '/pulso', { method: 'POST', headers: { origin: ORIGEM, 'content-type': 'text/plain' }, body: `${id},${u}`, signal: AbortSignal.timeout(10000) });
        if (!r.ok) erros++;
        else { const j = await r.json(); if (j.on) p = Math.min(p, j.p); }
      } catch { erros++; }
    }
    await dorme(PULSO * (0.9 + Math.random() * 0.2));
  }
}

const t0 = Date.now();
const relatorio = async () => {
  try {
    const s = await ler();
    console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  estimativa=${s.n} exato=${s.exato} p=${s.p} on=${s.on} i=${s.inst}  pulsos=${pulsos} erros=${erros}`);
  } catch (e) {
    console.log('leitura falhou', String(e));
  }
};
relatorio();
const timer = setInterval(relatorio, 15_000);
await Promise.all(Array.from({ length: N }, (_, i) => aba(i)));
clearInterval(timer);
await relatorio();
console.log(`FIM: abas=${N} pulsos=${pulsos} leituras=${leituras} erros=${erros} pulsos/min=${(pulsos / MIN).toFixed(1)}`);
