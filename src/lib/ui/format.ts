const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1Fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export const fmtPct = (n: number) => `${pctFmt.format(n)}%`;
export const fmtPct1 = (n: number) => `${pct1Fmt.format(n)}%`;
export const fmtPctNumber = (n: number) => pctFmt.format(n);
export const fmtInt = (n: number) => intFmt.format(Math.round(n));
export const fmtCompact = (n: number) => compactFmt.format(n);

/** "24/10/2026 19:19:13" (horário de Brasília, como o TSE publica) → Date */
export function parseTseDate(raw: string): Date | null {
  const [d, t] = raw.split(' ');
  if (!d || !t) return null;
  const [dd, mm, yyyy] = d.split('/');
  const dt = new Date(`${yyyy}-${mm}-${dd}T${t}-03:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function fmtUpdatedAt(raw: string | undefined): string {
  if (!raw) return '—';
  const dt = parseTseDate(raw);
  if (!dt) return raw;
  const day = dt.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  });
  const time = dt.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} às ${time}`;
}

/** Nome em caixa alta do TSE → "Flavio Bolsonaro" */
export function titleCase(name: string): string {
  const small = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return name
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1)))
    .join(' ');
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter((p) => p.length > 2);
  const list = parts.length ? parts : name.split(/\s+/);
  return (list[0]?.[0] ?? '') + (list.length > 1 ? (list[list.length - 1]?.[0] ?? '') : '');
}
