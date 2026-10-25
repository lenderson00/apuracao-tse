import { useCallback, useEffect, useRef, useState } from 'react';
import { buildResultPath, fetchResult } from '../lib/tse/client';
import { isFinalElection } from '../lib/tse/net';
import { parseResult } from '../lib/tse/parse';
import type { OfficeId, ParsedResult, Round } from '../lib/tse/types';

/** 2º turno: no máximo uma busca por minuto. 1º turno é final e não é recarregado. */
const REFRESH_MS = 60_000;

interface KeyedState {
  key: string;
  data: ParsedResult | null;
  error: string | null;
  /** a última atualização falhou, mas ainda mostramos os números anteriores */
  outdated: boolean;
  loading: boolean;
}

/**
 * Resultado de um recorte (turno, cargo, abrangência, código).
 * O estado fica atrelado à chave do recorte: ao trocar de recorte, os números
 * antigos somem na hora, e respostas atrasadas de outro recorte são descartadas.
 * Se uma atualização falhar, os últimos números bons continuam na tela.
 */
export function useElectionResult(
  round: Round,
  officeId: OfficeId,
  scope: 'br' | 'uf' | 'mu',
  code: string,
  scopeLabel: string,
  enabled = true,
) {
  const key = `${round}|${officeId}|${scope}|${code}|${enabled ? 1 : 0}`;
  const [state, setState] = useState<KeyedState>({ key, data: null, error: null, outdated: false, loading: true });
  const currentKey = useRef(key);
  const hasData = useRef(false);
  useEffect(() => {
    currentKey.current = key;
    hasData.current = false;
  }, [key]);
  const final = isFinalElection(buildResultPath(round, officeId, scope, code)?.electionId);

  const load = useCallback(async () => {
    if (!enabled || !code) return;
    const requestKey = key;
    try {
      const raw = await fetchResult(round, officeId, scope, code, { priority: 0 });
      if (currentKey.current !== requestKey) return;
      hasData.current = true;
      setState({
        key: requestKey,
        data: parseResult(raw, { round, officeId, scopeLabel }),
        error: null,
        outdated: false,
        loading: false,
      });
    } catch (e) {
      if (currentKey.current !== requestKey) return;
      console.warn('[tse]', e);
      setState((prev) => {
        const data = prev.key === requestKey ? prev.data : null;
        return {
          key: requestKey,
          data,
          error: data ? null : 'Não foi possível carregar os dados do TSE para este recorte.',
          outdated: !!data,
          loading: false,
        };
      });
    }
  }, [key, round, officeId, scope, code, scopeLabel, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      // 1º turno: só tenta de novo se ainda não temos os números
      if (final && hasData.current) return;
      if (document.hidden) return;
      void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, enabled, final]);

  const fresh = state.key === key;
  return {
    data: enabled && fresh ? state.data : null,
    error: enabled && fresh ? state.error : null,
    outdated: enabled && fresh && state.outdated,
    loading: enabled && (!fresh || state.loading),
    refresh: load,
  };
}
