import type { MunLeader } from '../../hooks/useMunicipalityResults';
import type { StateLeader } from '../../hooks/useStateLeaders';
import { mapFill } from './color';

export type RegionStatus = 'leader' | 'neutral' | 'loading' | 'error';

export interface RegionView {
  status: RegionStatus;
  fill: string;
  leaderName?: string;
  leaderId?: string;
  color?: string;
  votes?: number;
  rank?: number;
  pct: number;
  margin: number;
  note?: string;
}

const FILL: Record<Exclude<RegionStatus, 'leader'>, string> = {
  neutral: 'var(--map-neutral)',
  loading: 'url(#map-shimmer)',
  error: 'url(#map-hatch)',
};

/** Estado → visão do mapa. Sem líder: nota (sem votos/empate) ou falha. */
export function stateView(s: StateLeader | undefined): RegionView {
  if (!s || s.loading) return { status: 'loading', fill: FILL.loading, pct: 0, margin: 0 };
  if (s.leaderName) {
    return {
      status: 'leader',
      fill: mapFill(s.leaderColor, s.margin),
      leaderName: s.leaderName,
      color: s.leaderColor,
      pct: s.leaderPct,
      margin: s.margin,
    };
  }
  if (s.note) return { status: 'neutral', fill: FILL.neutral, pct: 0, margin: 0, note: s.note };
  return { status: 'error', fill: FILL.error, pct: 0, margin: 0, note: 'Sem resposta do TSE' };
}

export function munView(
  m: MunLeader | undefined,
  names: Record<string, { name: string; color: string }>,
): RegionView {
  if (!m || m.loading) return { status: 'loading', fill: FILL.loading, pct: 0, margin: 0 };
  if (m.leaderId) {
    return {
      status: 'leader',
      fill: mapFill(m.leaderColor, m.margin),
      leaderName: names[m.leaderId]?.name,
      leaderId: m.leaderId,
      color: m.leaderColor,
      pct: m.leaderPct,
      margin: m.margin,
    };
  }
  if (m.note) return { status: 'neutral', fill: FILL.neutral, pct: 0, margin: 0, note: m.note };
  return { status: 'error', fill: FILL.error, pct: 0, margin: 0, note: 'Sem resposta do TSE' };
}
