/**
 * Presença amostrada para "N acompanhando agora".
 *
 * Por que amostragem: no Workers Free a conta tem 100 mil requisições/dia (Worker)
 * e 100 mil/dia no Durable Object. Um pulso por aba não cabe com dezenas de
 * milhares de abas. Então cada aba sorteia um número fixo u ∈ [0,1) e só manda
 * pulso se u < p. O DO ajusta p para manter ~ALVO_AMOSTRA abas pulsando e estima
 * o total como (abas amostradas ativas) / p. Com p = 1 a contagem é exata.
 *
 * A leitura (GET /agora) é cacheada na borda da Vercel e da Cloudflare
 * (/api/presenca/agora.csv no site), então o custo não cresce com a audiência.
 *
 * Sem cookies, sem PII: id aleatório por aba. O IP vira um hash truncado com sal
 * aleatório (para limitar ids por IP) e some junto com a aba, em até 2,5 min.
 */

export interface Env {
  SALA: DurableObjectNamespace<Sala>;
  ATIVO: string;
  ALVO_AMOSTRA: string;
  ORCAMENTO_DIA: string;
  ORIGENS: string;
  /** ids distintos por IP na janela (CGNAT de celular divide IP) */
  MAX_POR_IP?: string;
}

const PULSO_MS = 90_000; // intervalo do pulso no cliente
const JANELA_MS = 225_000; // aba conta como ativa até 2,5 pulsos sem notícia
const P_MIN = 1 / 20_000; // com K=75 dá conta de ~1,5 milhão de abas

function origemPermitida(env: Env, origin: string | null): string | null {
  if (!origin) return null;
  const lista = env.ORIGENS.split(',').map((s) => s.trim());
  if (lista.includes(origin)) return origin;
  // previews da Vercel do projeto apuracao-tse
  if (/^https:\/\/apuracao-[a-z0-9-]+-lenderson1\.vercel\.app$/.test(origin)) return origin;
  return null;
}

function cors(origin: string | null): Record<string, string> {
  return origin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = origemPermitida(env, req.headers.get('origin'));

    if (url.pathname === '/agora' && req.method === 'GET') {
      const sala = env.SALA.get(env.SALA.idFromName('sala-v2'));
      const r = await sala.agora(env.ATIVO === '1', Number(env.ALVO_AMOSTRA), Number(env.ORCAMENTO_DIA));
      const csv = `n,exato,p,t,on,i\n${r.n},${r.exato ? 1 : 0},${r.p},${r.t},${r.on ? 1 : 0},${r.i}\n`;
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'cache-control': 'public, max-age=10',
          'cdn-cache-control': 'public, s-maxage=10',
          ...cors(origin),
        },
      });
    }

    if (url.pathname === '/pulso' && req.method === 'POST') {
      // Só o site manda pulso. Sem Origin válido nem chega ao DO.
      if (!origin) return new Response('origem', { status: 403 });
      const corpo = (await req.text()).slice(0, 80);
      const [id, uTxt] = corpo.split(',');
      const u = Number(uTxt);
      if (!/^[a-z0-9]{8,32}$/.test(id ?? '') || !(u >= 0 && u < 1)) {
        return new Response('formato', { status: 400, headers: cors(origin) });
      }
      const ip = req.headers.get('cf-connecting-ip') ?? '';
      const sala = env.SALA.get(env.SALA.idFromName('sala-v2'));
      const r = await sala.pulso(id, u, ip, env.ATIVO === '1', Number(env.ALVO_AMOSTRA), Number(env.ORCAMENTO_DIA), Number(env.MAX_POR_IP ?? 8));
      return Response.json(r, { headers: { 'cache-control': 'no-store', ...cors(origin) } });
    }

    if (url.pathname === '/' && req.method === 'GET') {
      return new Response('apuracao-presenca: GET /agora, POST /pulso\n', { headers: { 'content-type': 'text/plain' } });
    }
    return new Response('não encontrado', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export interface Agora {
  n: number;
  exato: boolean;
  p: number;
  t: number;
  on: boolean;
  /** id da instância do DO (diagnóstico; muda a cada reinício) */
  i: string;
}

import { DurableObject } from 'cloudflare:workers';

interface Estado {
  dia: string;
  uso: number;
  p: number;
  sal: string;
  aumento: number;
  /** p antes do último aumento */
  pAntes: number;
}

/**
 * Um único DO guarda a amostra em SQLite: o DO ocioso é despejado da memória
 * em segundos, então nada importante fica só em memória. Com p ajustado a
 * tabela tem ~ALVO_AMOSTRA linhas, e cada pulso grava 1 linha (o free dá
 * 100 mil linhas gravadas/dia, o orçamento do dia é bem menor que isso).
 */
export class Sala extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  private readonly instancia = crypto.randomUUID().slice(0, 8);
  private e: Estado | null = null;
  private gravado = '';
  private ultimaGravacao = 0;
  private ultimaLimpeza = 0;
  private ultimoAjuste = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS abas (id TEXT PRIMARY KEY, u REAL NOT NULL, ip TEXT NOT NULL, visto INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS abas_ip ON abas(ip);`);
  }

  private async estado(): Promise<Estado> {
    if (this.e) return this.e;
    const s = await this.ctx.storage.get<Estado>('estado');
    this.e = { dia: '', uso: 0, p: 1, sal: crypto.randomUUID(), aumento: 0, pAntes: 1, ...s };
    this.gravado = JSON.stringify(this.e);
    return this.e;
  }

  /** grava estado no máx. a cada 10 s, ou na hora se p mudou */
  private async gravar(agora: number, e: Estado, pMudou: boolean) {
    if (!pMudou && agora - this.ultimaGravacao < 10_000) return;
    const j = JSON.stringify(e);
    if (j === this.gravado) return;
    this.ultimaGravacao = agora;
    this.gravado = j;
    await this.ctx.storage.put('estado', e);
  }

  /** conta 1 requisição no orçamento do dia (UTC) */
  private contar(e: Estado): number {
    const hoje = new Date().toISOString().slice(0, 10);
    if (hoje !== e.dia) {
      e.dia = hoje;
      e.uso = 0;
    }
    return ++e.uso;
  }

  /** apaga abas sem pulso na janela e as que saíram da amostra (u >= p) */
  private limpar(agora: number, e: Estado, forcar = false) {
    if (!forcar && agora - this.ultimaLimpeza < 10_000) return;
    this.ultimaLimpeza = agora;
    this.sql.exec('DELETE FROM abas WHERE visto < ? OR u >= ?', agora - JANELA_MS, e.p);
  }

  private amostra(agora: number, p: number): number {
    return this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM abas WHERE visto >= ? AND u < ?', agora - JANELA_MS, p).one().c;
  }

  /**
   * Total estimado. Logo após um aumento de p as abas recém-sorteadas ainda não
   * pulsaram, então por uma janela de pulso estima só com a amostra antiga.
   */
  private estimar(agora: number, e: Estado): number {
    const p = agora - e.aumento < PULSO_MS + 15_000 ? Math.min(e.pAntes, e.p) : e.p;
    return this.amostra(agora, p) / p;
  }

  /**
   * Ajusta p para manter ~alvo abas na amostra. Desce na hora (numa enxurrada
   * com p alto, as abas novas entram na tabela, então a estimativa já reflete a
   * audiência); sobe no máx. 2x a cada 2 min. Retorna true se p mudou.
   */
  private ajustar(agora: number, e: Estado, alvo: number): boolean {
    if (agora - this.ultimoAjuste < 3_000) return false;
    this.ultimoAjuste = agora;
    const est = Math.max(this.estimar(agora, e), 1);
    const ideal = Math.max(P_MIN, Math.min(1, alvo / est));
    if (ideal < e.p * 0.8) {
      e.p = ideal;
      this.limpar(agora, e, true);
      return true;
    }
    if (ideal > e.p * 1.25 && agora - e.aumento > 120_000) {
      e.pAntes = e.p;
      e.p = Math.min(ideal, e.p * 2);
      e.aumento = agora;
      return true;
    }
    return false;
  }

  async agora(ativo: boolean, alvo: number, orcamento: number): Promise<Agora> {
    const e = await this.estado();
    const uso = this.contar(e);
    const agora = Date.now();
    this.limpar(agora, e);
    const mudou = this.ajustar(agora, e, alvo);
    await this.gravar(agora, e, mudou);
    const n = Math.round(this.estimar(agora, e));
    return { n, exato: e.p >= 1, p: Number(e.p.toPrecision(4)), t: agora, on: ativo && uso < orcamento, i: this.instancia };
  }

  async pulso(id: string, u: number, ip: string, ativo: boolean, alvo: number, orcamento: number, maxPorIp: number) {
    const e = await this.estado();
    const uso = this.contar(e);
    const agora = Date.now();
    if (!(ativo && uso < orcamento)) {
      await this.gravar(agora, e, false);
      return { p: 0, on: false };
    }
    this.limpar(agora, e);
    if (u < e.p) {
      const ipH = await hashIp(ip, e.sal);
      const existe = this.sql.exec('SELECT 1 FROM abas WHERE id = ?', id).toArray().length > 0;
      if (existe) this.sql.exec('UPDATE abas SET visto = ? WHERE id = ?', agora, id);
      else {
        const doIp = this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM abas WHERE ip = ?', ipH).one().c;
        if (doIp < maxPorIp) this.sql.exec('INSERT INTO abas (id, u, ip, visto) VALUES (?, ?, ?, ?)', id, u, ipH, agora);
      }
    }
    const mudou = this.ajustar(agora, e, alvo);
    await this.gravar(agora, e, mudou);
    return { p: Number(e.p.toPrecision(4)), on: true };
  }
}

async function hashIp(ip: string, sal: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sal + ip));
  return btoa(String.fromCharCode(...new Uint8Array(d).slice(0, 8)));
}
