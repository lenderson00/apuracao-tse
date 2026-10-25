import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchResult } from '../lib/tse/client';
import { parseResult } from '../lib/tse/parse';
import type { OfficeId, ParsedResult, Round } from '../lib/tse/types';

const REFRESH_MS = 60_000;

export function useElectionResult(
  round: Round,
  officeId: OfficeId,
  scope: 'br' | 'uf' | 'mu',
  code: string,
  scopeLabel: string,
  enabled = true,
) {
  const [data, setData] = useState<ParsedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !code) return;
    try {
      const raw = await fetchResult(round, officeId, scope, code);
      setData(parseResult(raw, { round, officeId, scopeLabel }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar dados do TSE');
    } finally {
      setLoading(false);
    }
  }, [round, officeId, scope, code, scopeLabel, enabled]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    timer.current = setInterval(() => void load(), REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load, enabled]);

  return { data, error, loading, refresh: load };
}
