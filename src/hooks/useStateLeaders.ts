import { useCallback, useEffect, useState } from 'react';
import { fetchResult } from '../lib/tse/client';
import { parseResult, resolveMapLeader } from '../lib/tse/parse';
import { UF_LIST } from '../lib/tse/config';
import type { OfficeId, Round } from '../lib/tse/types';

export interface StateLeader {
  slug: string;
  sigla: string;
  name: string;
  leaderColor: string;
  leaderPct: number;
  margin: number;
  leaderName?: string;
  hasLeader: boolean;
  loading: boolean;
}

export function useStateLeaders(round: Round, officeId: OfficeId, enabled: boolean) {
  const [map, setMap] = useState<Record<string, StateLeader>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const base: Record<string, StateLeader> = {};
    for (const uf of UF_LIST) {
      base[uf.slug] = {
        slug: uf.slug,
        sigla: uf.sigla,
        name: uf.name,
        leaderColor: '#3f3f46',
        leaderPct: 0,
        margin: 0,
        hasLeader: false,
        loading: true,
      };
    }
    setMap(base);

    await Promise.all(
      UF_LIST.map(async (uf) => {
        try {
          const raw = await fetchResult(round, officeId, 'uf', uf.slug);
          const parsed = parseResult(raw, { round, officeId, scopeLabel: uf.name });
          const resolved = resolveMapLeader(parsed.candidates);
          setMap((prev) => ({
            ...prev,
            [uf.slug]: {
              slug: uf.slug,
              sigla: uf.sigla,
              name: uf.name,
              leaderColor: resolved.leader?.color ?? '#3f3f46',
              leaderPct: resolved.leader?.percent ?? 0,
              margin: resolved.margin,
              leaderName: resolved.leader?.shortName,
              hasLeader: resolved.hasLeader,
              loading: false,
            },
          }));
        } catch {
          setMap((prev) => ({
            ...prev,
            [uf.slug]: { ...prev[uf.slug], loading: false, leaderColor: '#27272a' },
          }));
        }
      }),
    );
    setLoading(false);
  }, [round, officeId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { map, loading, reload: load };
}
