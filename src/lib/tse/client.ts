import type { OfficeId, Round, TseMunConfig, TseResultFile } from './types';
import { officeForRound } from './config';

/** TSE não envia CORS; use `/api/tse` (proxy Vite local ou rewrite na Vercel). */
export const TSE_BASE = '/api/tse';

export function resultUrl(params: {
  electionId: string;
  ufFolder: string;
  fileStem: string;
  officeId: OfficeId;
}): string {
  const cargo = params.officeId.padStart(4, '0');
  const ele = params.electionId.padStart(6, '0');
  return `${TSE_BASE}/oficial/ele2026/${params.electionId}/dados/${params.ufFolder}/${params.fileStem}-c${cargo}-e${ele}-u.json`;
}

export function munConfigUrl(electionId: string): string {
  const ele = electionId.padStart(6, '0');
  return `${TSE_BASE}/oficial/ele2026/${electionId}/config/mun-e${ele}-cm.json`;
}

export function photoUrl(electionId: string, uf: string, sqcand: string): string {
  return `${TSE_BASE}/oficial/ele2026/${electionId}/fotos/${uf}/${sqcand}.jpeg`;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`TSE ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

export function buildResultPath(
  round: Round,
  officeId: OfficeId,
  scope: 'br' | 'uf' | 'mu',
  code: string,
): { electionId: string; ufFolder: string; fileStem: string; photoUf: string } | null {
  const office = officeForRound(officeId, round);
  if (!office) return null;
  const electionId = office.electionCode(round);
  const slug = code.toLowerCase();

  if (scope === 'br') {
    return { electionId, ufFolder: 'br', fileStem: 'br', photoUf: 'br' };
  }
  if (scope === 'uf') {
    const folder = office.scope === 'federal' ? slug : slug;
    const stem = office.scope === 'federal' ? slug : slug;
    return { electionId, ufFolder: folder, fileStem: stem, photoUf: slug };
  }
  // municipality: presidente usa pasta UF + código TSE 5 dígitos
  const uf = slug.slice(0, 2);
  const mun = slug.slice(2);
  return {
    electionId,
    ufFolder: uf,
    fileStem: `${uf}${mun}`,
    photoUf: uf,
  };
}

export async function fetchResult(
  round: Round,
  officeId: OfficeId,
  scope: 'br' | 'uf' | 'mu',
  code: string,
): Promise<TseResultFile> {
  const path = buildResultPath(round, officeId, scope, code);
  if (!path) throw new Error('Cargo indisponível neste turno');
  const url = resultUrl({
    electionId: path.electionId,
    ufFolder: path.ufFolder,
    fileStem: path.fileStem,
    officeId,
  });
  return fetchJson<TseResultFile>(url);
}

let munCache: Promise<TseMunConfig> | null = null;

export function fetchMunicipalityIndex(electionId: string): Promise<TseMunConfig> {
  if (!munCache) {
    munCache = fetchJson<TseMunConfig>(munConfigUrl(electionId));
  }
  return munCache;
}

export async function fetchEleConfig(): Promise<unknown> {
  return fetchJson(`${TSE_BASE}/oficial/comum/config/ele-c.json`);
}
