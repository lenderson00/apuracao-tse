import { useEffect, useState } from 'react';

/**
 * Histórico da apuração (snapshots reais do TSE a cada 10 min), publicado num repo
 * público do GitHub por um coletor externo. Nada passa pela Vercel.
 */
export const HISTORY_BASE = 'https://raw.githubusercontent.com/lenderson00/apuracao-dados/main/history';
const POLL_MS = 120_000;

export interface HistoryCandidate {
  n: string;
  nm: string;
  pvap: number;
  vap: number;
}

export interface HistoryPoint {
  /** data/hora da totalização do TSE (ISO, -03:00) */
  t: string;
  collectedAt: string;
  pctSecoesTotalizadas: number;
  candidates: HistoryCandidate[];
}

export interface HistoryFile {
  abrangencia: string;
  inicioColeta: string | null;
  atualizadoEm: string;
  intervaloMin: number;
  points: HistoryPoint[];
}

export function useHistory(key: string | null) {
  const [state, setState] = useState<{ key: string | null; file: HistoryFile | null; error: boolean }>({ key: null, file: null, error: false });

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = async () => {
      try {
        const v = Math.floor(Date.now() / POLL_MS);
        const res = await fetch(`${HISTORY_BASE}/${key}.json?v=${v}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const file = (await res.json()) as HistoryFile;
        if (alive) setState({ key, file, error: false });
      } catch {
        if (alive) setState((s) => (s.key === key ? { ...s, error: true } : { key, file: null, error: true }));
      }
    };
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const onVis = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [key]);

  const file = state.key === key ? state.file : null;
  /* só pontos com votos: antes da primeira urna o TSE publica zeros */
  const points = (file?.points ?? []).filter((p) => p.candidates.some((c) => c.vap > 0));
  return { file, points, loading: !!key && state.key !== key, error: state.key === key && state.error && !file };
}
