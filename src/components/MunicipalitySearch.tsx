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
    <div className="relative w-full max-w-sm">
      <label className="sr-only" htmlFor="mun-search">Buscar município</label>
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--color-muted)]"
        aria-hidden
      >
        /
      </span>
      <input
        id="mun-search"
        type="search"
        placeholder="município ou UF"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="input-field"
      />
      {open && results.length > 0 && (
        <ul
          className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-1 shadow-lg"
        >
          {results.map((m) => (
            <li key={`${m.uf}-${m.tseCode}`}>
              <button
                type="button"
                className="flex w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-muted)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(m);
                  setQ('');
                  setOpen(false);
                }}
              >
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">{m.uf}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
