import { useMemo, useState } from 'react';
import type { MunicipalityRef } from '../lib/tse/types';

interface Props {
  items: MunicipalityRef[];
  onPick: (m: MunicipalityRef) => void;
}

export function MunicipalitySearch({ items, onPick }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return items
      .filter((m) => m.name.toLowerCase().includes(term) || m.uf.toLowerCase() === term)
      .slice(0, 8);
  }, [q, items]);

  return (
    <div className="relative w-full max-w-md">
      <label className="sr-only" htmlFor="mun-search">Buscar município</label>
      <input
        id="mun-search"
        type="search"
        placeholder="Buscar município…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-2.5 text-sm outline-none ring-[var(--color-accent)] focus:ring-2"
      />
      {open && results.length > 0 && (
        <ul
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-1 shadow-xl"
        >
          {results.map((m) => (
            <li key={`${m.uf}-${m.tseCode}`}>
              <button
                type="button"
                className="flex w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-border)]/40"
                onClick={() => {
                  onPick(m);
                  setQ('');
                  setOpen(false);
                }}
              >
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 text-[var(--color-muted)]">{m.uf}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
