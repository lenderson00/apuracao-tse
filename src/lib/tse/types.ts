export type Round = 1 | 2;
export type OfficeId = '1' | '3' | '5' | '6' | '7' | '8';

export interface OfficeOption {
  id: OfficeId;
  label: string;
  electionCode: (round: Round) => string;
  /** Folder for president is always `br` at national level; at municipal level use UF */
  scope: 'federal' | 'state';
}

export interface MunicipalityRef {
  tseCode: string;
  ibgeCode: string;
  name: string;
  uf: string;
  capital: boolean;
}

export interface CandidateRow {
  sqcand: string;
  name: string;
  shortName: string;
  party: string;
  number: string;
  votes: number;
  percent: number;
  status: string;
  color: string;
}

export interface TurnoutStats {
  sectionsTotal: number;
  sectionsCounted: number;
  sectionsPct: number;
  electorate: number;
  abstentions: number;
  abstentionPct: number;
  turnout: number;
  turnoutPct: number;
  blank: number;
  blankPct: number;
  nullVotes: number;
  nullPct: number;
  validVotes: number;
}

export interface ParsedResult {
  electionId: string;
  round: Round;
  officeId: OfficeId;
  scope: 'br' | 'uf' | 'mu';
  scopeCode: string;
  scopeLabel: string;
  finished: boolean;
  updatedAt: string;
  turnout: TurnoutStats;
  candidates: CandidateRow[];
}

export interface TseMunConfig {
  abr: Array<{
    cd: string;
    ds: string;
    mu: Array<{ cd: string; cdi: string; nm: string; c: string }>;
  }>;
}

export interface TseResultFile {
  ele: string;
  t: string;
  dg: string;
  hg: string;
  and: string;
  tpabr: string;
  cdabr: string;
  carg: Array<{
    cd: string;
    agr?: TseAlliance[];
    par?: TseParty[];
  }>;
  s: {
    ts: string;
    st: string;
    pst: string;
    pstn: string;
  };
  e: {
    te: string;
    a: string;
    pa: string;
    pan: string;
    c: string;
    pc: string;
    pcn: string;
  };
  v: {
    vv: string;
    vb: string;
    pvb: string;
    vn: string;
    pvn: string;
  };
}

interface TseAlliance {
  tp: string;
  com: string;
  par: TseParty[];
}

interface TseParty {
  sg: string;
  cand: TseCand[];
}

interface TseCand {
  sqcand: string;
  nm: string;
  nmu: string;
  n: string;
  st: string;
  vap: string;
  pvap: string;
  pvapn: string;
}
