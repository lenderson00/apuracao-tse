/**
 * Camada de rede para o TSE.
 *
 * - Busca direto em resultados.tse.jus.br (o TSE libera CORS). Cada visitante usa o
 *   próprio IP, então o limite de acessos do TSE não é compartilhado entre todos.
 * - Se a busca direta falhar por rede/CORS, tenta uma vez pelo proxy da Vercel
 *   (/api/tse), que tem cache na borda.
 * - 429/503: espera e tenta de novo a MESMA URL (sem cache-buster), com backoff
 *   exponencial + jitter. Quem chama continua mostrando os últimos números bons.
 * - No máximo MAX_ACTIVE requisições ao mesmo tempo, por prioridade
 *   (recorte aberto > estados > municípios/zonas).
 * - Arquivos do 1º turno (6257/6259) são finais: ficam em memória a sessão inteira.
 */

export const TSE_ORIGIN = 'https://resultados.tse.jus.br';
export const PROXY_BASE = '/api/tse';

/** Prioridade: 0 = recorte aberto no painel, 1 = mapa de estados, 2 = municípios/zonas. */
export type Priority = 0 | 1 | 2;

const MAX_ACTIVE = 6;
const RETRY_STATUSES = new Set([429, 503]);
const BACKOFF_BASE_MS = 20_000;
const BACKOFF_CAP_MS = 160_000;
const MAX_RETRIES = 4;
/** eleições já encerradas (1º turno): o arquivo não muda mais */
const FINAL_ELECTION = /\/oficial\/ele2026\/(6257\/|6259\/|arquivo-urna\/3220\/)/;
const FINAL_CONFIG = /\/oficial\/(comum\/config\/|ele2026\/\d+\/config\/)/;

export class TseHttpError extends Error {
  status: number;
  url: string;
  constructor(status: number, url: string) {
    super(`TSE ${status}: ${url}`);
    this.status = status;
    this.url = url;
  }
}

export function isFinalUrl(url: string): boolean {
  return FINAL_ELECTION.test(url);
}

/* ------------------------------------------------------------ status global */

type Listener = () => void;
const listeners = new Set<Listener>();
let waitingRetries = 0;
let usingProxy = false;
let snapshot = { throttled: false, usingProxy: false };

function emit() {
  const next = { throttled: waitingRetries > 0, usingProxy };
  if (next.throttled === snapshot.throttled && next.usingProxy === snapshot.usingProxy) return;
  snapshot = next;
  for (const l of listeners) l();
}

export function subscribeNet(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getNetStatus() {
  return snapshot;
}

/* -------------------------------------------------------------- fila global */

interface Task {
  priority: Priority;
  seq: number;
  run: () => void;
  signal?: AbortSignal;
}

let active = 0;
let seq = 0;
const queue: Task[] = [];
/** depois de um 429, os pedidos de baixa prioridade esperam até aqui */
let lowPausedUntil = 0;
let pumpTimer: number | undefined;

function pump() {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].signal?.aborted) queue.splice(i, 1);
  while (active < MAX_ACTIVE && queue.length) {
    queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    const next = queue[0];
    const now = Date.now();
    if (next.priority === 2 && now < lowPausedUntil) {
      if (pumpTimer === undefined) {
        pumpTimer = window.setTimeout(() => {
          pumpTimer = undefined;
          pump();
        }, lowPausedUntil - now);
      }
      return;
    }
    queue.shift();
    active++;
    next.run();
  }
}

function withSlot<T>(priority: Priority, signal: AbortSignal | undefined, job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    queue.push({
      priority,
      seq: seq++,
      signal,
      run: () => {
        signal?.removeEventListener('abort', onAbort);
        job()
          .then(resolve, reject)
          .finally(() => {
            active--;
            pump();
          });
      },
    });
    pump();
  });
}

function abortError() {
  return new DOMException('Aborted', 'AbortError');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/* ------------------------------------------------------------- uma tentativa */

let directNetworkFailures = 0;
let proxyUntil = 0;

function proxyUrl(url: string): string {
  return url.startsWith(TSE_ORIGIN) ? PROXY_BASE + url.slice(TSE_ORIGIN.length) : url;
}

async function attempt(url: string, signal?: AbortSignal): Promise<Response> {
  const direct = url.startsWith(TSE_ORIGIN);
  const preferProxy = direct && Date.now() < proxyUntil;
  if (direct && !preferProxy) {
    try {
      // sem cabeçalhos extras: a requisição continua "simples" e não gera preflight
      const res = await fetch(url, { signal });
      directNetworkFailures = 0;
      return res;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      // rede/CORS: cai para o proxy da Vercel; se repetir, usa o proxy por 5 min
      if (++directNetworkFailures >= 3) {
        proxyUntil = Date.now() + 5 * 60_000;
        usingProxy = true;
        emit();
      }
      return fetch(proxyUrl(url), { signal });
    }
  }
  if (usingProxy && Date.now() >= proxyUntil) {
    usingProxy = false;
    emit();
  }
  return fetch(preferProxy ? proxyUrl(url) : url, { signal });
}

/* ---------------------------------------------------------------- pública */

export interface TseFetchOptions {
  priority?: Priority;
  signal?: AbortSignal;
}

async function load<T>(url: string, read: (r: Response) => Promise<T>, opts: TseFetchOptions): Promise<T> {
  const priority = opts.priority ?? 1;
  for (let retry = 0; ; retry++) {
    const res = await withSlot(priority, opts.signal, () => attempt(url, opts.signal));
    if (res.ok) return read(res);
    if (!RETRY_STATUSES.has(res.status) || retry >= MAX_RETRIES) throw new TseHttpError(res.status, url);
    const base = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** retry);
    const delay = Math.round(base * (0.75 + Math.random() * 0.5));
    lowPausedUntil = Math.max(lowPausedUntil, Date.now() + Math.min(delay, 30_000));
    waitingRetries++;
    emit();
    try {
      await sleep(delay, opts.signal);
    } finally {
      waitingRetries--;
      emit();
    }
  }
}

const inflight = new Map<string, Promise<unknown>>();
const finalCache = new Map<string, Promise<unknown>>();

function shared<T>(key: string, url: string, make: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const keep = isFinalUrl(url) || FINAL_CONFIG.test(url);
  const cached = (keep ? finalCache.get(key) : undefined) ?? inflight.get(key);
  if (cached) return raceAbort(cached as Promise<T>, signal);
  const p = make();
  inflight.set(key, p);
  if (keep) finalCache.set(key, p);
  p.then(
    () => inflight.delete(key),
    () => {
      inflight.delete(key);
      finalCache.delete(key);
    },
  );
  return p;
}

function raceAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(abortError()), { once: true });
    p.then(resolve, reject);
  });
}

export function tseJson<T>(url: string, opts: TseFetchOptions = {}): Promise<T> {
  // com signal, a requisição é só de quem pediu (pode ser cancelada); sem signal, é compartilhada
  if (opts.signal) {
    const cached = finalCache.get(`j|${url}`);
    if (cached) return raceAbort(cached as Promise<T>, opts.signal);
    const p = load(url, (r) => r.json() as Promise<T>, opts);
    if (isFinalUrl(url)) {
      p.then(
        () => finalCache.set(`j|${url}`, p),
        () => undefined,
      );
    }
    return p;
  }
  return shared(`j|${url}`, url, () => load(url, (r) => r.json() as Promise<T>, opts));
}

export function tseBuffer(url: string, opts: TseFetchOptions = {}): Promise<ArrayBuffer> {
  return shared(`b|${url}`, url, () => load(url, (r) => r.arrayBuffer(), opts), opts.signal);
}

/** Para 404/403 tratados como "ainda não publicado". */
export function isNotPublished(e: unknown): boolean {
  return e instanceof TseHttpError && (e.status === 404 || e.status === 403);
}

/** 1º turno (6257 presidente, 6259 estaduais): resultado final, não precisa de polling. */
export function isFinalElection(electionId: string | undefined): boolean {
  return electionId === '6257' || electionId === '6259';
}
