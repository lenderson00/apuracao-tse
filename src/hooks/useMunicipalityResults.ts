import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchResult } from '../lib/tse/client';
import { parseResult, resolveMapLeader } from '../lib/tse/parse';
import { MAP_NOTE, NEUTRAL_COLOR } from './useStateLeaders';
import type { MunicipalityRef, CandidateRow, OfficeId, Round } from '../lib/tse/types';

export interface MunLeader {
  ibgeCode: string;
  tseCode: string;
  name: string;
  leaderId?: string;
  leaderColor: string;
  leaderPct: number;
  margin: number;
  note?: string;
  candidates?: CandidateRow[];
  loading: boolean;
}

/**
 * Líder de cada município da UF. As requisições passam pela fila global do TSE
 * (baixa prioridade): o recorte aberto no painel sempre fura a fila. Capitais e
 * municípios maiores (mais zonas) vêm primeiro.
 */
export function useMunicipalityResults(
  round: Round,
  officeId: OfficeId,
  ufSlug: string,
  municipalities: MunicipalityRef[],
  enabled: boolean,
) {
  const [leaders, setLeaders] = useState<Record<string, MunLeader>>({});
  const [progress, setProgress] = useState(0);
  const ctrl = useRef<AbortController | null>(null);

  const loadAll = useCallback(async () => {
    if (!enabled || municipalities.length === 0) return;
    ctrl.current?.abort();
    const ac = new AbortController();
    ctrl.current = ac;
    setLeaders((prev) => {
      const next: Record<string, MunLeader> = {};
      for (const m of municipalities) {
        next[m.ibgeCode] = prev[m.ibgeCode]
          ? { ...prev[m.ibgeCode], loading: true }
          : {
              ibgeCode: m.ibgeCode,
              tseCode: m.tseCode,
              name: m.name,
              leaderColor: '#3f3f46',
              leaderPct: 0,
              margin: 0,
              loading: true,
            };
      }
      return next;
    });
    setProgress(0);

    const ordered = [...municipalities].sort(
      (a, b) => Number(b.capital) - Number(a.capital) || b.zones.length - a.zones.length,
    );
    let done = 0;
    await Promise.all(
      ordered.map(async (m) => {
        const code = `${ufSlug}${m.tseCode}`;
        try {
          const raw = await fetchResult(round, officeId, 'mu', code, { priority: 2, signal: ac.signal });
          if (ac.signal.aborted) return;
          const parsed = parseResult(raw, { round, officeId, scopeLabel: m.name });
          const { leader: top, margin, reason } = resolveMapLeader(parsed.candidates);
          setLeaders((prev) => ({
            ...prev,
            [m.ibgeCode]: {
              ibgeCode: m.ibgeCode,
              tseCode: m.tseCode,
              name: m.name,
              leaderId: top?.sqcand,
              candidates: parsed.candidates,
              leaderColor: top?.color ?? NEUTRAL_COLOR,
              leaderPct: top?.percent ?? 0,
              margin,
              note: reason ? MAP_NOTE[reason] : undefined,
              loading: false,
            },
          }));
        } catch {
          if (ac.signal.aborted) return;
          // falhou: mantém os números anteriores, se houver
          setLeaders((prev) => ({
            ...prev,
            [m.ibgeCode]: prev[m.ibgeCode]?.candidates
              ? { ...prev[m.ibgeCode], loading: false }
              : { ...prev[m.ibgeCode], loading: false, leaderColor: '#27272a' },
          }));
        } finally {
          if (!ac.signal.aborted) {
            done++;
            if (done % 12 === 0 || done === ordered.length) {
              setProgress(Math.min(100, Math.round((done / ordered.length) * 100)));
            }
          }
        }
      }),
    );
  }, [enabled, municipalities, officeId, round, ufSlug]);

  useEffect(() => {
    void loadAll();
    return () => {
      ctrl.current?.abort();
    };
  }, [loadAll]);

  return { leaders, progress, reload: loadAll };
}

export function leaderForIbge(leaders: Record<string, MunLeader>, ibge: string): MunLeader | undefined {
  return leaders[ibge];
}
