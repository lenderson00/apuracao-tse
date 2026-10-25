/**
 * Leitor mínimo de ASN.1 BER/DER, suficiente para o boletim de urna (.bu) do TSE.
 * Só comprimentos definidos (o TSE grava DER).
 */
export interface Tlv {
  cls: number; // 0 universal, 1 application, 2 context, 3 private
  constructed: boolean;
  tag: number;
  start: number; // início do conteúdo
  len: number;
  children?: Tlv[];
}

const MAX_DEPTH = 24;

export function readTlvs(buf: Uint8Array, from = 0, to = buf.length, depth = 0): Tlv[] {
  const out: Tlv[] = [];
  let i = from;
  while (i < to) {
    const first = buf[i++];
    const cls = first >> 6;
    const constructed = ((first >> 5) & 1) === 1;
    let tag = first & 31;
    if (tag === 31) {
      tag = 0;
      let b: number;
      do {
        b = buf[i++];
        tag = (tag << 7) | (b & 127);
      } while (b & 128);
    }
    let len = buf[i++];
    if (len & 128) {
      const n = len & 127;
      if (n === 0 || n > 4) throw new Error('BER: comprimento não suportado');
      len = 0;
      for (let k = 0; k < n; k++) len = len * 256 + buf[i++];
    }
    if (i + len > to) throw new Error('BER: arquivo truncado');
    const node: Tlv = { cls, constructed, tag, start: i, len };
    if (constructed && depth < MAX_DEPTH) node.children = readTlvs(buf, i, i + len, depth + 1);
    out.push(node);
    i += len;
  }
  return out;
}

export function tlvInt(buf: Uint8Array, t: Tlv): number {
  let v = 0;
  for (let k = 0; k < t.len; k++) v = v * 256 + buf[t.start + k];
  // inteiros com sinal: o BU só usa positivos, mas respeita o bit de sinal
  if (t.len > 0 && buf[t.start] & 0x80) v -= 2 ** (8 * t.len);
  return v;
}

export function tlvText(buf: Uint8Array, t: Tlv): string {
  return new TextDecoder('latin1').decode(buf.subarray(t.start, t.start + t.len));
}

export const isUniversal = (t: Tlv, tag: number) => t.cls === 0 && t.tag === tag;
export const isContext = (t: Tlv, tag: number) => t.cls === 2 && t.tag === tag;
export const U_INTEGER = 2;
export const U_OCTETS = 4;
export const U_ENUM = 10;
export const U_SEQ = 16;
export const U_GENERALSTRING = 27;
