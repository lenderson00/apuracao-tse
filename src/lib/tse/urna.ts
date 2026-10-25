/**
 * Arquivos de urna do TSE (por seção): índice de seções por UF, arquivo auxiliar
 * da seção e o boletim de urna (.bu) decodificado no navegador.
 *
 * Caminhos (descritos em oficial/comum/config/ele-c.json):
 *   cs : oficial/ele2026/arquivo-urna/<pleito>/config/<uf>/<uf>-p<pleito6>-cs.json
 *   aux: oficial/ele2026/arquivo-urna/<pleito>/dados/<uf>/<mun>/<zona>/<secao>/p<pleito6>-<uf>-m<mun>-z<zona>-s<secao>-aux.json
 *   bu : .../<secao>/<hash>/<nome do arquivo listado no aux>
 */
import { TSE_BASE, fetchJson } from './client';
import { decodeBoletim, type BoletimUrna } from './bu';
import type { Round } from './types';

/** Pleito de 2026 por turno (ele-c.json: 3220 = 04/10, 3221 = 25/10). */
export const PLEITO: Record<Round, string> = { 1: '3220', 2: '3221' };

export interface SectionRef {
  /** número da seção, 4 dígitos */
  ns: string;
  /** data/hora em que o arquivo da urna foi recebido; ausente = ainda não publicado */
  receivedAt?: string;
}

/** mun (5 dígitos) -> zona (4 dígitos) -> seções */
export type SectionIndex = Map<string, Map<string, SectionRef[]>>;

interface CsFile {
  dg: string;
  hg: string;
  abr: Array<{
    cd: string;
    mu: Array<{ cd: string; nm: string; zon: Array<{ cd: string; sec: Array<{ ns: string; da?: string; ha?: string }> }> }>;
  }>;
}

const p6 = (p: string) => p.padStart(6, '0');

export function sectionIndexUrl(round: Round, uf: string): string {
  const p = PLEITO[round];
  return `${TSE_BASE}/oficial/ele2026/arquivo-urna/${p}/config/${uf}/${uf}-p${p6(p)}-cs.json`;
}

const indexCache = new Map<string, Promise<SectionIndex>>();

/** Índice de seções da UF inteira (o TSE só publica por UF). Baixado uma vez por sessão. */
export function fetchSectionIndex(round: Round, uf: string): Promise<SectionIndex> {
  const key = `${round}|${uf}`;
  let p = indexCache.get(key);
  if (!p) {
    p = fetchJson<CsFile>(sectionIndexUrl(round, uf)).then((raw) => {
      const idx: SectionIndex = new Map();
      for (const a of raw.abr ?? []) {
        for (const mu of a.mu ?? []) {
          const zones = new Map<string, SectionRef[]>();
          for (const z of mu.zon ?? []) {
            zones.set(
              z.cd,
              (z.sec ?? []).map((s) => ({ ns: s.ns, receivedAt: s.da && s.ha ? `${s.da} ${s.ha}` : undefined })),
            );
          }
          idx.set(mu.cd, zones);
        }
      }
      return idx;
    });
    p.catch(() => indexCache.delete(key));
    indexCache.set(key, p);
  }
  return p;
}

interface AuxFile {
  dg: string;
  hg: string;
  st: string;
  hashes?: Array<{ hash: string; dr: string; hr: string; st: string; arq: Array<{ nm: string; tp: string }> }>;
}

export interface SectionFiles {
  status: string;
  receivedAt: string;
  bu?: string;
  rdv?: string;
  log?: string;
}

export function sectionDir(round: Round, uf: string, mun: string, zona: string, secao: string): string {
  return `${TSE_BASE}/oficial/ele2026/arquivo-urna/${PLEITO[round]}/dados/${uf}/${mun}/${zona}/${secao}`;
}

export function sectionAuxUrl(round: Round, uf: string, mun: string, zona: string, secao: string): string {
  const p = PLEITO[round];
  return `${sectionDir(round, uf, mun, zona, secao)}/p${p6(p)}-${uf}-m${mun}-z${zona}-s${secao}-aux.json`;
}

/** Arquivos publicados de uma seção. `null` quando o TSE ainda não publicou (404). */
export async function fetchSectionFiles(
  round: Round,
  uf: string,
  mun: string,
  zona: string,
  secao: string,
): Promise<SectionFiles | null> {
  const res = await fetch(sectionAuxUrl(round, uf, mun, zona, secao), { headers: { Accept: 'application/json' } });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`TSE ${res.status}`);
  const aux = (await res.json()) as AuxFile;
  const hashes = aux.hashes ?? [];
  // o TSE pode listar mais de um envio; vale o totalizado, senão o mais recente
  const h = hashes.find((x) => /totaliz/i.test(x.st)) ?? hashes[hashes.length - 1];
  if (!h) return { status: aux.st, receivedAt: '' };
  const dir = `${sectionDir(round, uf, mun, zona, secao)}/${h.hash}`;
  const file = (tp: string) => {
    const f = h.arq.find((a) => a.tp === tp);
    return f ? `${dir}/${f.nm}` : undefined;
  };
  return { status: aux.st || h.st, receivedAt: `${h.dr} ${h.hr}`, bu: file('bu'), rdv: file('rdv'), log: file('log') };
}

const buCache = new Map<string, Promise<BoletimUrna>>();

export function fetchBoletim(url: string): Promise<BoletimUrna> {
  let p = buCache.get(url);
  if (!p) {
    p = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`TSE ${res.status}`);
      return decodeBoletim(await res.arrayBuffer());
    });
    p.catch(() => buCache.delete(url));
    buCache.set(url, p);
  }
  return p;
}
