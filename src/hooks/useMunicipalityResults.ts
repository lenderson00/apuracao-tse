import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchResult } from '../lib/tse/client';
import { parseResult, resolveMapLeader } from '../lib/tse/parse';
import { MAP_NOTE, NEUTRAL_COLOR } from './useStateLeaders';
import type { MunicipalityRef, OfficeId, Round } from '../lib/tse/types';

export interface MunLeader {
  ibgeCode: string;
  tseCode: string;
  name: string;
  leaderId?: string;
  leaderColor: string;
  leaderPct: number;
  margin: number;
  note?: string;
  loading: boolean;
}

const BATCH = 24;

export function useMunicipalityResults(
  round: Round,
  officeId: OfficeId,
  ufSlug: string,
  municipalities: MunicipalityRef[],
  enabled: boolean,
) {
  const [leaders, setLeaders] = useState<Record<string, MunLeader>>({});
  const [progress, setProgress] = useState(0);
  const abort = useRef(false);

  const loadAll = useCallback(async () => {
    if (!enabled || municipalities.length === 0) return;
    abort.current = false;
    const initial: Record<string, MunLeader> = {};
    for (const m of municipalities) {
      initial[m.ibgeCode] = {
        ibgeCode: m.ibgeCode,
        tseCode: m.tseCode,
        name: m.name,
        leaderColor: '#3f3f46',
        leaderPct: 0,
        margin: 0,
        loading: true,
      };
    }
    setLeaders(initial);
    setProgress(0);

    for (let i = 0; i < municipalities.length; i += BATCH) {
      if (abort.current) break;
      const chunk = municipalities.slice(i, i + BATCH);
      await Promise.all(
        chunk.map(async (m) => {
          const code = `${ufSlug}${m.tseCode}`;
          try {
            const raw = await fetchResult(round, officeId, 'mu', code);
            const parsed = parseResult(raw, {
              round,
              officeId,
              scopeLabel: m.name,
            });
            const { leader: top, margin, reason } = resolveMapLeader(parsed.candidates);
            setLeaders((prev) => ({
              ...prev,
              [m.ibgeCode]: {
                ibgeCode: m.ibgeCode,
                tseCode: m.tseCode,
                name: m.name,
                leaderId: top?.sqcand,
                leaderColor: top?.color ?? NEUTRAL_COLOR,
                leaderPct: top?.percent ?? 0,
                margin,
                note: reason ? MAP_NOTE[reason] : undefined,
                loading: false,
              },
            }));
          } catch {
            setLeaders((prev) => ({
              ...prev,
              [m.ibgeCode]: {
                ...prev[m.ibgeCode],
                loading: false,
                leaderColor: '#27272a',
              },
            }));
          }
        }),
      );
      setProgress(Math.min(100, Math.round(((i + chunk.length) / municipalities.length) * 100)));
    }
  }, [enabled, municipalities, officeId, round, ufSlug]);

  useEffect(() => {
    void loadAll();
    return () => {
      abort.current = true;
    };
  }, [loadAll]);

  return { leaders, progress, reload: loadAll };
}

export function leaderForIbge(leaders: Record<string, MunLeader>, ibge: string): MunLeader | undefined {
  return leaders[ibge];
}
