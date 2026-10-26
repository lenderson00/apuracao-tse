import { useSyncExternalStore } from 'react';

/**
 * "N acompanhando agora" — presença amostrada (Cloudflare Worker + Durable Object).
 *
 * - Leitura: GET /api/presenca/agora.csv a cada 60 s (cacheado na Cloudflare e na
 *   Vercel, então o custo não cresce com a audiência). Em dev, lê direto do Worker.
 * - Pulso: só as abas sorteadas (u < p) mandam um POST a cada ~90 s. O servidor
 *   ajusta p para manter ~75 abas pulsando e estima o total; com p = 1 é exato.
 * - Aba escondida: para de ler e de pulsar. Volta ao ficar visível.
 * - Sem cookies e sem PII: id aleatório por aba (sessionStorage), nada mais.
 * - Qualquer falha, dado velho ou servidor desligado: retorna null e o contador some.
 */

const PULSO_URL =
  (import.meta.env.VITE_PRESENCA_PULSO as string | undefined) ??
  'https://apuracao-presenca.plugandship.workers.dev/pulso';
const LEITURA_URL =
  (import.meta.env.VITE_PRESENCA_LEITURA as string | undefined) ??
  (import.meta.env.DEV ? PULSO_URL.replace(/\/pulso$/, '/agora') : '/api/presenca/agora.csv');

const LEITURA_MS = 60_000;
const PULSO_MS = 90_000;
const VELHO_MS = 4 * 60_000; // dado mais velho que isso não aparece
const MAX_FALHAS = 3;

export interface Presence {
  /** abas abertas agora (exato) ou estimativa */
  count: number;
  /** true quando é estimativa por amostragem */
  estimated: boolean;
}

function idDaAba(): { id: string; u: number } {
  try {
    const salvo = sessionStorage.getItem('presenca');
    if (salvo) {
      const [id, u] = salvo.split(',');
      if (/^[a-z0-9]{16}$/.test(id) && Number(u) >= 0 && Number(u) < 1) return { id, u: Number(u) };
    }
  } catch {
    /* sessionStorage bloqueado: id só em memória */
  }
  const b = crypto.getRandomValues(new Uint32Array(3));
  const id = (b[0].toString(36) + b[1].toString(36)).padEnd(16, '0').slice(0, 16);
  const u = b[2] / 2 ** 32;
  try {
    sessionStorage.setItem('presenca', `${id},${u}`);
  } catch {
    /* ignora */
  }
  return { id, u };
}

function lerCsv(txt: string) {
  const linha = txt.trim().split('\n')[1];
  if (!linha) return null;
  const [n, exato, p, t, on] = linha.split(',').map(Number);
  if (![n, exato, p, t, on].every(Number.isFinite)) return null;
  return { n, exato: exato === 1, p, t, on: on === 1 };
}

/*
 * Uma única instância por aba, não importa quantos <LiveCount /> estejam
 * montados (desktop, dock, modo live): o primeiro inscrito liga, o último desliga.
 */
let atual: Presence | null = null;
const ouvintes = new Set<() => void>();
let parar: (() => void) | null = null;

function publicar(v: Presence | null) {
  if (v?.count === atual?.count && v?.estimated === atual?.estimated) return;
  atual = v;
  ouvintes.forEach((f) => f());
}

function inscrever(f: () => void) {
  ouvintes.add(f);
  if (!parar) parar = iniciar();
  return () => {
    ouvintes.delete(f);
    if (!ouvintes.size && parar) {
      parar();
      parar = null;
      atual = null;
    }
  };
}

function iniciar(): () => void {
if (typeof window === 'undefined' || !window.fetch || !window.crypto?.getRandomValues) return () => {};
  const { id, u } = idDaAba();
  let p = 0; // só pulsa depois de saber o p do servidor
  let ligado = false;
  let falhasLeitura = 0;
  let falhasPulso = 0;
  let parado = false; // desistiu de vez (servidor desligado ou falhando)
  let tLeitura: ReturnType<typeof setTimeout> | undefined;
  let tPulso: ReturnType<typeof setTimeout> | undefined;
  let ultimo: { n: number; exato: boolean; t: number } | null = null;

  const mostrar = () => {
    if (!ligado || !ultimo || Date.now() - ultimo.t > VELHO_MS || ultimo.n < 2) publicar(null);
    else publicar({ count: ultimo.n, estimated: !ultimo.exato });
  };

  const ler = async () => {
    if (parado || document.hidden) return;
    try {
      const r = await fetch(LEITURA_URL, { cache: 'no-cache' });
      const d = r.ok ? lerCsv(await r.text()) : null;
      if (!d) throw new Error('leitura');
      falhasLeitura = 0;
      ligado = d.on;
      p = d.on ? d.p : 0;
      ultimo = { n: d.n, exato: d.exato, t: d.t };
      if (!d.on) {
        clearTimeout(tPulso);
        tPulso = undefined;
      }
    } catch {
      if (++falhasLeitura >= MAX_FALHAS) ligado = false;
    }
    mostrar();
    if (ligado && u < p && !tPulso) agendarPulso(Math.random() * 30_000);
    tLeitura = setTimeout(ler, LEITURA_MS * (0.9 + Math.random() * 0.2));
  };

  const pulsar = async () => {
    tPulso = undefined;
    if (parado || document.hidden || !ligado || !(u < p)) return;
    try {
      const r = await fetch(PULSO_URL, {
        method: 'POST',
        body: `${id},${u}`, // text/plain: requisição simples, sem preflight
        keepalive: true,
        credentials: 'omit',
      });
      if (!r.ok) throw new Error('pulso');
      const j = (await r.json()) as { p: number; on: boolean };
      falhasPulso = 0;
      p = j.on ? j.p : 0;
      if (!j.on) ligado = false;
    } catch {
      // estourou o limite grátis ou rede ruim: para de pulsar nesta aba
      if (++falhasPulso >= MAX_FALHAS) p = 0;
    }
    mostrar();
    if (ligado && u < p) agendarPulso(PULSO_MS * (0.9 + Math.random() * 0.2));
  };

  const agendarPulso = (ms: number) => {
    clearTimeout(tPulso);
    tPulso = setTimeout(pulsar, ms);
  };

  const visibilidade = () => {
    clearTimeout(tLeitura);
    clearTimeout(tPulso);
    tLeitura = tPulso = undefined;
    if (!document.hidden) ler();
  };

  document.addEventListener('visibilitychange', visibilidade);
  ler();
  return () => {
    parado = true;
    clearTimeout(tLeitura);
    clearTimeout(tPulso);
    document.removeEventListener('visibilitychange', visibilidade);
  };
}

export function usePresence(): Presence | null {
  return useSyncExternalStore(inscrever, () => atual, () => null);
}
