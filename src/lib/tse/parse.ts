import { candidateColor } from './config';
import type {
  CandidateRow,
  OfficeId,
  ParsedResult,
  Round,
  TseResultFile,
  TurnoutStats,
} from './types';

/** Converte número do TSE ("47,027772356", "100", "0,00") para number. */
export function num(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Percentual do TSE, já em escala 0–100. Usa o campo de precisão total
 * (sufixo "n", ex.: pvapn) e cai para o campo arredondado (ex.: pvap).
 */
function pct(full: string | undefined, rounded: string | undefined): number {
  return num(full || rounded);
}

export function parseTurnout(raw: TseResultFile): TurnoutStats {
  const sectionsTotal = num(raw.s?.ts);
  const sectionsCounted = num(raw.s?.st);
  const sectionsPct = pct(raw.s?.pstn, raw.s?.pst);
  const electorate = num(raw.e?.te);
  const abstentions = num(raw.e?.a);
  const abstentionPct = pct(raw.e?.pan, raw.e?.pa);
  // Comparecimento vem do próprio TSE (c/pc). Antes da apuração ele é 0,
  // e não "eleitorado - abstenção" (que daria 100%).
  const turnout = num(raw.e?.c);
  const turnoutPct = pct(raw.e?.pcn, raw.e?.pc);
  const validVotes = num(raw.v?.vv);
  // pvb já é sobre o total de votos.
  const blank = num(raw.v?.vb);
  const blankPct = pct(raw.v?.pvbn, raw.v?.pvb);
  // Nulos: tvn/ptvn = nulos + nulos técnicos sobre o total de votos.
  // (vn/pvn é a fatia dos nulos comuns dentro de tvn, ~99%.)
  const nullVotes = num(raw.v?.tvn ?? raw.v?.vn);
  const nullPct = pct(raw.v?.ptvnn, raw.v?.ptvn);

  return {
    sectionsTotal,
    sectionsCounted,
    sectionsPct,
    electorate,
    abstentions,
    abstentionPct,
    turnout,
    turnoutPct,
    blank,
    blankPct,
    nullVotes,
    nullPct,
    validVotes,
  };
}

export function extractCandidates(raw: TseResultFile, officeId: OfficeId): CandidateRow[] {
  const cargo = raw.carg?.find((c) => c.cd === officeId);
  if (!cargo) return [];

  const rows: CandidateRow[] = [];

  const fromParty = (
    par: Array<{ sg: string; cand?: Array<{ sqcand: string; nm: string; nmu: string; n: string; st?: string; vap: string; pvap: string; pvapn: string }> }>,
  ) => {
    for (const p of par) {
      for (const c of p.cand ?? []) {
        rows.push({
          sqcand: c.sqcand,
          name: c.nm,
          shortName: c.nmu,
          party: p.sg,
          number: c.n,
          votes: num(c.vap),
          percent: pct(c.pvapn, c.pvap),
          status: c.st ?? '',
          color: candidateColor(p.sg, c.n),
        });
      }
    }
  };

  if (cargo.agr) {
    for (const ag of cargo.agr) {
      fromParty(ag.par ?? []);
    }
  }
  if (cargo.par) {
    fromParty(cargo.par);
  }

  return rows.sort((a, b) => b.votes - a.votes);
}

export function parseResult(
  raw: TseResultFile,
  meta: {
    round: Round;
    officeId: OfficeId;
    scopeLabel: string;
  },
): ParsedResult {
  return {
    electionId: raw.ele,
    round: meta.round,
    officeId: meta.officeId,
    scope: raw.tpabr as 'br' | 'uf' | 'mu',
    scopeCode: raw.cdabr,
    scopeLabel: meta.scopeLabel,
    finished: raw.and === 'f',
    updatedAt: `${raw.dg} ${raw.hg}`,
    turnout: parseTurnout(raw),
    candidates: extractCandidates(raw, meta.officeId),
  };
}

export interface MapLeaderResult {
  leader?: CandidateRow;
  margin: number;
  /** Motivo de não haver líder: sem votos apurados ou empate no topo. */
  reason?: 'sem-votos' | 'empate';
}

/** Líder para o mapa. Sem votos ou com empate no topo, não há líder (cor neutra). */
export function resolveMapLeader(candidates: CandidateRow[]): MapLeaderResult {
  const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
  if (totalVotes === 0) return { margin: 0, reason: 'sem-votos' };
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  const [top, second] = sorted;
  if (second && top.votes === second.votes) return { margin: 0, reason: 'empate' };
  const margin = second ? Math.max(0, top.percent - second.percent) : 0;
  return { leader: top, margin };
}

export function leadingCandidate(candidates: CandidateRow[]): CandidateRow | undefined {
  return resolveMapLeader(candidates).leader;
}

export function marginPct(candidates: CandidateRow[]): number {
  return resolveMapLeader(candidates).margin;
}
