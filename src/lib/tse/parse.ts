import { candidateColor } from './config';
import type {
  CandidateRow,
  OfficeId,
  ParsedResult,
  Round,
  TseResultFile,
  TurnoutStats,
} from './types';

function num(s: string | undefined): number {
  if (!s) return 0;
  return Number(s.replace(/\./g, '').replace(',', '.')) || Number(s) || 0;
}

function pctFromField(pstn: string | undefined, pst: string | undefined): number {
  /* campos "n" já vêm em % com precisão cheia e vírgula decimal ("47,027772356") */
  if (pstn) {
    const v = Number(pstn.replace(',', '.'));
    if (Number.isFinite(v)) return v;
  }
  return num(pst);
}

export function parseTurnout(raw: TseResultFile): TurnoutStats {
  const sectionsTotal = num(raw.s?.ts);
  const sectionsCounted = num(raw.s?.st);
  const sectionsPct = pctFromField(raw.s?.pstn, raw.s?.pst);
  const electorate = num(raw.e?.te);
  const abstentions = num(raw.e?.a);
  const comparecimento = num(raw.e?.c);
  const validVotes = num(raw.v?.vv);
  const blank = num(raw.v?.vb);
  const nullVotes = num(raw.v?.vn);

  /** TSE só publica comparecimento/abstenção úteis após início da apuração. */
  const apurationStarted =
    sectionsCounted > 0 || validVotes > 0 || comparecimento > 0;

  let turnoutPct: number | null = null;
  let abstentionPct: number | null = null;
  let blankPct: number | null = null;
  let nullPct: number | null = null;

  if (apurationStarted) {
    abstentionPct = pctFromField(raw.e?.pan, raw.e?.pa);
    turnoutPct = pctFromField(raw.e?.pcn, raw.e?.pc);
    if (turnoutPct === 0 && comparecimento > 0 && electorate > 0) {
      turnoutPct = (comparecimento / electorate) * 100;
    }
    blankPct = pctFromField(undefined, raw.v?.pvb);
    /* ptvn = nulos sobre o total de votos; pvn é a fatia dentro dos nulos */
    nullPct = pctFromField(raw.v?.ptvnn, raw.v?.ptvn ?? raw.v?.pvn);
  }

  const turnout = comparecimento > 0 ? comparecimento : electorate - abstentions;

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
    apurationStarted,
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
          percent: pctFromField(c.pvapn, c.pvap),
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

export function leadingCandidate(candidates: CandidateRow[]): CandidateRow | undefined {
  return resolveMapLeader(candidates).leader;
}

export function marginPct(candidates: CandidateRow[]): number {
  return resolveMapLeader(candidates).margin;
}

export interface MapLeaderResult {
  leader?: CandidateRow;
  margin: number;
  hasLeader: boolean;
}

/** Líder para cor do mapa: sem votos ou empate no topo → neutro (aguardando). */
export function resolveMapLeader(candidates: CandidateRow[]): MapLeaderResult {
  if (candidates.length === 0) {
    return { margin: 0, hasLeader: false };
  }
  const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
  if (totalVotes === 0) {
    return { margin: 0, hasLeader: false };
  }
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  const top = sorted[0];
  const second = sorted[1];
  if (second && top.votes === second.votes) {
    return { margin: 0, hasLeader: false };
  }
  const margin = second ? Math.max(0, top.percent - second.percent) : 0;
  return { leader: top, margin, hasLeader: true };
}
