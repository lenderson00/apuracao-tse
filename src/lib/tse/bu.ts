/**
 * Decodificador do boletim de urna (arquivo -bu.dat) publicado pelo TSE.
 * Estrutura: EntidadeEnvelopeGenerico { ..., conteudo OCTET STRING } cujo conteúdo
 * é a EntidadeBoletimUrna em DER (especificação ASN.1 "bu.asn1" do TSE).
 * Em 2026 o TSE acrescentou campos no topo do BU, então os resultados são achados
 * pela forma (assinatura estrutural) e não por posição fixa.
 */
import {
  isContext,
  isUniversal,
  readTlvs,
  tlvInt,
  tlvText,
  U_ENUM,
  U_GENERALSTRING,
  U_INTEGER,
  U_OCTETS,
  U_SEQ,
  type Tlv,
} from './ber';

export type BuVoteKind = 'nominal' | 'branco' | 'nulo' | 'legenda' | 'semCandidato';

export interface BuVote {
  kind: BuVoteKind;
  /** Número do votável (candidato ou legenda). Ausente em branco/nulo. */
  number?: number;
  party?: number;
  votes: number;
}

export interface BuOffice {
  /** Código do cargo do TSE: 1 presidente, 3 governador, 5 senador, 6 dep. federal, 7 dep. estadual, 8 distrital. */
  officeCode: number;
  majoritarian: boolean;
  turnout: number;
  votes: BuVote[];
}

export interface BuElection {
  electionId: number;
  electorate: number;
  offices: BuOffice[];
}

export interface BoletimUrna {
  municipio?: number;
  zona?: number;
  secao?: number;
  local?: number;
  emittedAt?: string;
  elections: BuElection[];
}

const KIND: Record<number, BuVoteKind> = {
  1: 'nominal',
  2: 'branco',
  3: 'nulo',
  4: 'legenda',
  5: 'semCandidato',
};

const kids = (t: Tlv) => t.children ?? [];
const isSeq = (t: Tlv) => t.constructed && isUniversal(t, U_SEQ);

function parseVote(buf: Uint8Array, t: Tlv): BuVote | null {
  let kind: BuVoteKind | undefined;
  let votes = 0;
  let number: number | undefined;
  let party: number | undefined;
  for (const c of kids(t)) {
    if (isContext(c, 1) && !c.constructed) kind = KIND[tlvInt(buf, c)];
    else if (isContext(c, 2) && !c.constructed) votes = tlvInt(buf, c);
    else if (isContext(c, 3) && c.constructed) {
      const ints = kids(c).filter((x) => isUniversal(x, U_INTEGER));
      if (ints[0]) party = tlvInt(buf, ints[0]);
      if (ints[1]) number = tlvInt(buf, ints[1]);
    }
  }
  if (!kind) return null;
  return { kind, votes, number, party };
}

function parseOfficeTotals(buf: Uint8Array, t: Tlv): { officeCode: number; votes: BuVote[] } | null {
  let officeCode = 0;
  const votes: BuVote[] = [];
  for (const c of kids(t)) {
    // codigoCargo: CHOICE { cargoConstitucional [1], numeroCargoConsultaLivre [2] }
    if ((isContext(c, 1) || isContext(c, 2)) && !c.constructed) officeCode = tlvInt(buf, c);
    else if (isSeq(c)) {
      for (const v of kids(c)) {
        const vote = isSeq(v) ? parseVote(buf, v) : null;
        if (vote) votes.push(vote);
      }
    }
  }
  return officeCode ? { officeCode, votes } : null;
}

/** ResultadoVotacao { tipoCargo ENUM, qtdComparecimento INT, totaisVotosCargo SEQ OF } */
function parseResultadoVotacao(buf: Uint8Array, t: Tlv): BuOffice[] {
  const c = kids(t);
  const tipo = c.find((x) => isUniversal(x, U_ENUM));
  const comp = c.find((x) => isUniversal(x, U_INTEGER));
  const totals = c.find(isSeq);
  if (!tipo || !comp || !totals) return [];
  const turnout = tlvInt(buf, comp);
  const majoritarian = tlvInt(buf, tipo) === 1;
  const out: BuOffice[] = [];
  for (const tv of kids(totals)) {
    const o = isSeq(tv) ? parseOfficeTotals(buf, tv) : null;
    if (o) out.push({ ...o, turnout, majoritarian });
  }
  return out;
}

/** Forma de ResultadoVotacaoPorEleicao: SEQ { INT idEleicao, INT aptos, ..., SEQ OF SEQ{ENUM, INT, SEQ} } */
function asElection(buf: Uint8Array, t: Tlv): BuElection | null {
  if (!isSeq(t)) return null;
  const c = kids(t);
  const ints = c.filter((x) => isUniversal(x, U_INTEGER));
  const resList = c.find(
    (x) => isSeq(x) && kids(x).length > 0 && kids(x).every((r) => isSeq(r) && kids(r).some((k) => isUniversal(k, U_ENUM))),
  );
  if (ints.length < 2 || !resList) return null;
  const offices = kids(resList).flatMap((r) => parseResultadoVotacao(buf, r));
  if (offices.length === 0) return null;
  return { electionId: tlvInt(buf, ints[0]), electorate: tlvInt(buf, ints[1]), offices };
}

function looksLikeIdent(t: Tlv): boolean {
  const c = kids(t);
  return (
    c.length === 3 &&
    isSeq(c[0]) &&
    kids(c[0]).length === 2 &&
    kids(c[0]).every((x) => isUniversal(x, U_INTEGER)) &&
    isUniversal(c[1], U_INTEGER) &&
    isUniversal(c[2], U_INTEGER)
  );
}

function parseIdent(buf: Uint8Array, t: Tlv, into: BoletimUrna) {
  // IdentificacaoSecaoEleitoral [0] { municipioZona SEQ{municipio, zona}, local INT, secao INT }
  const c = kids(t);
  const mz = c.find(isSeq);
  if (mz) {
    const [m, z] = kids(mz).filter((x) => isUniversal(x, U_INTEGER));
    if (m) into.municipio = tlvInt(buf, m);
    if (z) into.zona = tlvInt(buf, z);
  }
  const ints = c.filter((x) => isUniversal(x, U_INTEGER));
  if (ints[0]) into.local = tlvInt(buf, ints[0]);
  if (ints[1]) into.secao = tlvInt(buf, ints[1]);
}

export function decodeBoletim(input: ArrayBuffer | Uint8Array): BoletimUrna {
  const outer = input instanceof Uint8Array ? input : new Uint8Array(input);
  const env = readTlvs(outer)[0];
  if (!env || !isSeq(env)) throw new Error('BU: envelope inválido');
  const content = kids(env).find((x) => isUniversal(x, U_OCTETS) && x.len > 64);
  if (!content) throw new Error('BU: conteúdo ausente');
  const buf = outer.subarray(content.start, content.start + content.len);
  const bu = readTlvs(buf)[0];
  if (!bu || !isSeq(bu)) throw new Error('BU: entidade inválida');

  const result: BoletimUrna = { elections: [] };
  // identificação da seção: no envelope vem como [0] { SEQ{mun, zona}, local, secao }
  const envIdent = kids(env).find((x) => isContext(x, 0) && x.constructed && looksLikeIdent(x));
  if (envIdent) parseIdent(outer, envIdent, result);
  let sawDate = false;
  for (const c of kids(bu)) {
    if (!result.secao && c.constructed && looksLikeIdent(c)) parseIdent(buf, c, result);
    else if (!sawDate && isUniversal(c, U_GENERALSTRING) && c.len === 15) {
      // o 1º texto de 15 caracteres fora do cabeçalho é a emissão do BU
      result.emittedAt = tlvText(buf, c);
      sawDate = true;
    } else if (c.constructed && kids(c).length > 0) {
      const els = kids(c).map((x) => asElection(buf, x));
      if (els.length > 0 && els.every(Boolean)) result.elections.push(...(els as BuElection[]));
    }
  }
  if (result.elections.length === 0) throw new Error('BU: resultados não encontrados');
  return result;
}

/** "20261004T154409" -> "04/10/2026 15:44" */
export function fmtBuDate(s?: string): string {
  if (!s || s.length < 13) return '';
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)} ${s.slice(9, 11)}:${s.slice(11, 13)}`;
}
