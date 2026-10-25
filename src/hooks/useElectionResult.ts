import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchResult } from '../lib/tse/client';
import { parseResult } from '../lib/tse/parse';
import type { OfficeId, ParsedResult, Round } from '../lib/tse/types';

const REFRESH_MS = 60_000;

interface KeyedState {
  key: string;
  data: ParsedResult | null;
  error: string | null;
  loading: boolean;
}

/**
 * Resultado de um recorte (turno, cargo, abrangência, código).
 * O estado fica atrelado à chave do recorte: ao trocar de recorte, os números
 * antigos somem na hora, e respostas atrasadas de outro recorte são descartadas.
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
  const [state, setState] = useState<KeyedState>({ key, data: null, error: null, loading: true });
  const currentKey = useRef(key);
  useEffect(() => {
    currentKey.current = key;
  }, [key]);

  const load = useCallback(async () => {
    if (!enabled || !code) return;
    const requestKey = key;
    try {
      const raw = await fetchResult(round, officeId, scope, code);
      if (currentKey.current !== requestKey) return;
      setState({
        key: requestKey,
        data: parseResult(raw, { round, officeId, scopeLabel }),
        error: null,
        loading: false,
      });
    } catch (e) {
      if (currentKey.current !== requestKey) return;
      console.error('[tse]', e);
      setState((prev) => {
        const sameKey = prev.key === requestKey;
        const data = sameKey ? prev.data : null;
        return {
          key: requestKey,
          data,
          error: data
            ? 'Não conseguimos atualizar com o TSE agora. Os números abaixo são da última atualização. Vamos tentar de novo em 1 minuto.'
            : 'Não foi possível carregar os dados do TSE para este recorte. Vamos tentar de novo em 1 minuto.',
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
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, enabled]);

  const fresh = state.key === key;
  return {
    data: enabled && fresh ? state.data : null,
    error: enabled && fresh ? state.error : null,
    loading: enabled && (!fresh || state.loading),
    refresh: load,
  };
}
