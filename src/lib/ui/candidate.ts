import { interpolateRgb } from 'd3';
import type { CandidateRow } from '../tse/types';
import type { RegionView } from './regions';
export const heatColor = (color: string, percent: number) =>
  interpolateRgb('#23232b', color)([0.12, 0.32, 0.52, 0.72, 1][[20, 35, 50, 65].filter((n) => percent >= n).length]);
export function candidateView(view: RegionView, rows: CandidateRow[] | undefined, c: CandidateRow): RegionView {
  if (!rows) return view;
  const row = rows.find((r) => r.sqcand === c.sqcand);
  if (!rows.some((r) => r.votes > 0)) return { ...view, status: 'neutral', note: 'Sem votos apurados' };
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
