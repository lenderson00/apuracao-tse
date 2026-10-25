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
  if (pstn) return Number(pstn) / 100;
  return num(pst);
}

export function parseTurnout(raw: TseResultFile): TurnoutStats {
  const sectionsTotal = num(raw.s?.ts);
  const sectionsCounted = num(raw.s?.st);
  const sectionsPct = pctFromField(raw.s?.pstn, raw.s?.pst);
  const electorate = num(raw.e?.te);
  const abstentions = num(raw.e?.a);
  const abstentionPct = pctFromField(raw.e?.pan, raw.e?.pa);
  const turnout = electorate - abstentions;
  const turnoutPct = electorate > 0 ? (turnout / electorate) * 100 : 0;
  const validVotes = num(raw.v?.vv);
  const blank = num(raw.v?.vb);
  const blankPct = pctFromField(undefined, raw.v?.pvb);
  const nullVotes = num(raw.v?.vn);
  const nullPct = pctFromField(undefined, raw.v?.pvn);

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
  return candidates[0];
}

export function marginPct(candidates: CandidateRow[]): number {
  if (candidates.length < 2) return 0;
  return Math.max(0, candidates[0].percent - candidates[1].percent);
}
