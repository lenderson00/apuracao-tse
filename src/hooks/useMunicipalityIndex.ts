import { useEffect, useState } from 'react';
import { fetchMunicipalityIndex } from '../lib/tse/client';
import type { MunicipalityRef, Round } from '../lib/tse/types';
import { officeForRound } from '../lib/tse/config';

let globalIndex: MunicipalityRef[] | null = null;

function flattenIndex(raw: Awaited<ReturnType<typeof fetchMunicipalityIndex>>): MunicipalityRef[] {
  const list: MunicipalityRef[] = [];
  for (const uf of raw.abr ?? []) {
    for (const mu of uf.mu ?? []) {
      list.push({
        tseCode: mu.cd,
        ibgeCode: mu.cdi,
        name: mu.nm,
        uf: uf.cd.toUpperCase(),
        capital: mu.c === 's',
        zones: mu.z ?? [],
      });
    }
  }
  return list;
}

export function useMunicipalityIndex(round: Round) {
  const [items, setItems] = useState<MunicipalityRef[]>(globalIndex ?? []);
  const [loading, setLoading] = useState(!globalIndex);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const office = officeForRound('1', round);
    if (!office) return;
    const electionId = office.electionCode(round);
    if (globalIndex) {
      setItems(globalIndex);
      setLoading(false);
      return;
    }
    fetchMunicipalityIndex(electionId)
      .then((raw) => {
        globalIndex = flattenIndex(raw);
        setItems(globalIndex);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Índice de municípios indisponível'))
      .finally(() => setLoading(false));
  }, [round]);

  return { items, loading, error };
}

export function municipalitiesForUf(items: MunicipalityRef[], ufSlug: string): MunicipalityRef[] {
  const uf = ufSlug.toUpperCase();
  return items.filter((m) => m.uf === uf);
}
