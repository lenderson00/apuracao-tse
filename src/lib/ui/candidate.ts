import { hcl } from 'd3';
import type { CandidateRow } from '../tse/types';
import type { RegionView } from './regions';
export const heatColor = (color: string, percent: number) => {
  const step = [20, 35, 50, 65].filter((n) => percent >= n).length;
  const c = hcl(color);
  c.l = [15, 30, 46, 63, 79][step];
  c.c = (Number.isNaN(c.c) ? 0 : c.c) * [0.16, 0.55, 0.85, 1, 1][step];
  return c.rgb().clamp().formatHex();
};
export function candidateView(view: RegionView, rows: CandidateRow[] | undefined, c: CandidateRow): RegionView {
  if (!rows) return { ...view, fill: 'url(#candidate-missing)' };
  const row = rows.find((r) => r.sqcand === c.sqcand);
  if (!rows.some((r) => r.votes > 0)) return { ...view, fill: 'url(#candidate-missing)', status: 'neutral', note: 'Sem votos apurados' };
  return {
    status: 'leader',
    fill: heatColor(c.color, row?.percent ?? 0),
    color: c.color,
    leaderName: c.shortName,
    pct: row?.percent ?? 0,
    margin: 0,
    votes: row?.votes ?? 0,
    rank: row ? rows.filter((r) => r.votes > row.votes).length + 1 : undefined,
  };
}
